import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};

export async function GET() {
  const sb = getSupabaseServer();

  // Parallel: total, analyzed, platform counts
  const [totalRes, analyzedRes, ...platformResults] = await Promise.all([
    sb.from("conversations").select("*", { count: "exact", head: true }),
    sb.from("conversations").select("*", { count: "exact", head: true }).not("intent", "is", null),
    ...PLATFORMS.map((p) =>
      sb.from("conversations").select("*", { count: "exact", head: true }).eq("metadata->>platform", p)
    ),
  ]);

  // Date range
  const [{ data: dateStart }, { data: dateEnd }] = await Promise.all([
    sb.from("conversations").select("created_at").order("created_at", { ascending: true }).limit(1),
    sb.from("conversations").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const total = totalRes.count ?? 0;
  const analyzedCount = analyzedRes.count ?? 0;
  const activePlatforms = PLATFORMS.filter((_, i) => (platformResults[i].count ?? 0) > 0);

  // Analyzed data for aggregations
  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, metadata")
    .not("intent", "is", null)
    .limit(100000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Aggregate ────────────────────────────────────────────────────────────────
  let qualitySum = 0, qualityCount = 0, completedCount = 0, failedCount = 0, abandonedCount = 0;
  const byIntent: Record<string, {
    count: number; qualitySum: number; qualityCount: number;
    completed: number; failed: number; abandoned: number;
    platformCounts: Record<string, number>;
  }> = {};
  const byPlatformQuality: Record<string, { scores: number[]; completed: number; total: number }> = {};

  for (const row of rows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const p = (meta?.platform as string) ?? "unknown";
    const q = row.quality_score as number | null;
    const status = row.completion_status as string | null;
    const intent = row.intent as string;

    if (q !== null) { qualitySum += q; qualityCount++; }
    if (status === "completed") completedCount++;
    if (status === "failed")    failedCount++;
    if (status === "abandoned") abandonedCount++;

    byIntent[intent] ??= { count: 0, qualitySum: 0, qualityCount: 0, completed: 0, failed: 0, abandoned: 0, platformCounts: {} };
    const ig = byIntent[intent];
    ig.count++;
    if (q !== null) { ig.qualitySum += q; ig.qualityCount++; }
    if (status === "completed") ig.completed++;
    if (status === "failed")    ig.failed++;
    if (status === "abandoned") ig.abandoned++;
    ig.platformCounts[p] = (ig.platformCounts[p] ?? 0) + 1;

    byPlatformQuality[p] ??= { scores: [], completed: 0, total: 0 };
    byPlatformQuality[p].total++;
    if (q !== null) byPlatformQuality[p].scores.push(q);
    if (status === "completed") byPlatformQuality[p].completed++;
  }

  const overallQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null;
  const overallCompletion = rows?.length
    ? Math.round((completedCount / rows.length) * 1000) / 10
    : null;
  const overallFailure = rows?.length
    ? Math.round(((failedCount + abandonedCount) / rows.length) * 1000) / 10
    : null;

  // ── Intent summary ───────────────────────────────────────────────────────────
  const intentSummaries = Object.entries(byIntent).map(([intent, g]) => {
    const avgQuality = g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null;
    const completionRate = g.count > 0 ? Math.round((g.completed / g.count) * 1000) / 10 : 0;
    const failureRate = g.count > 0 ? Math.round(((g.failed + g.abandoned) / g.count) * 1000) / 10 : 0;
    const qualityGap = avgQuality !== null ? 100 - avgQuality : 50;
    const impactScore = Math.round(g.count * (failureRate / 100) * (qualityGap / 100) * 1000);
    const topPlatform = Object.entries(g.platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { intent, count: g.count, avgQuality, completionRate, failureRate, impactScore, topPlatform };
  });

  // Top 10 topics by volume
  const topTopics = [...intentSummaries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top 5 failures by impact
  const topFailures = [...intentSummaries]
    .filter((x) => x.failureRate > 0)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5);

  // Fetch examples for top failures
  const failureExamples: Record<string, string[]> = {};
  if (topFailures.length > 0) {
    const { data: exRows } = await sb
      .from("conversations")
      .select("intent, messages")
      .in("intent", topFailures.map((x) => x.intent))
      .in("completion_status", ["failed", "abandoned"])
      .limit(25);
    for (const conv of exRows ?? []) {
      const intent = conv.intent as string;
      failureExamples[intent] ??= [];
      if (failureExamples[intent].length >= 2) continue;
      const messages = conv.messages as { role: string; content: string }[] | null;
      const firstUser = messages?.find((m) => m.role === "user")?.content ?? "";
      if (firstUser) failureExamples[intent].push(firstUser.slice(0, 180));
    }
  }

  // Best performer (lowest failure + highest quality)
  const bestTopic = intentSummaries
    .filter((x) => x.count >= 10 && x.avgQuality !== null)
    .sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0))[0] ?? null;

  // Worst failure topic
  const worstTopic = intentSummaries
    .filter((x) => x.count >= 5)
    .sort((a, b) => b.failureRate - a.failureRate)[0] ?? null;

  // Platform specialization (only if multi-platform)
  const platformSpecialization: { platform: string; bestTopic: string }[] = [];
  if (activePlatforms.length > 1) {
    for (const p of activePlatforms) {
      const pTopics = intentSummaries
        .filter((x) => {
          const g = byIntent[x.intent];
          return g && (g.platformCounts[p] ?? 0) > 0;
        })
        .map((x) => ({
          intent: x.intent,
          pct: byIntent[x.intent].count > 0
            ? (byIntent[x.intent].platformCounts[p] ?? 0) / byIntent[x.intent].count
            : 0,
        }))
        .sort((a, b) => b.pct - a.pct);
      if (pTopics[0]) {
        platformSpecialization.push({ platform: p, bestTopic: formatLabel(pTopics[0].intent) });
      }
    }
  }

  // ── Platform quality comparison ──────────────────────────────────────────────
  const platformComparison = PLATFORMS
    .filter((p) => (byPlatformQuality[p]?.total ?? 0) > 0)
    .map((p) => {
      const g = byPlatformQuality[p];
      return {
        platform: p,
        label: PLATFORM_LABELS[p],
        avgQuality: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
        completionRate: g.total ? Math.round((g.completed / g.total) * 1000) / 10 : null,
        count: g.total,
      };
    });

  const bestPlatform = platformComparison
    .filter((p) => p.avgQuality !== null)
    .sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0))[0] ?? null;

  // ── Health score ─────────────────────────────────────────────────────────────
  const healthScore =
    overallQuality !== null && overallCompletion !== null && overallFailure !== null
      ? Math.round((overallQuality / 100) * (overallCompletion / 100) * (1 - overallFailure / 100) * 100)
      : null;

  // ── Key findings (auto-generated) ────────────────────────────────────────────
  const topThreeTopics = topTopics.slice(0, 3).map((x) => formatLabel(x.intent)).join(", ");
  const keyFindings: string[] = [];
  if (topThreeTopics) keyFindings.push(`Users primarily ask about: ${topThreeTopics}.`);
  if (overallCompletion !== null) keyFindings.push(`AI succeeds ${overallCompletion}% of the time overall.`);
  if (worstTopic) {
    keyFindings.push(`The #1 failure point is "${formatLabel(worstTopic.intent)}" with a ${worstTopic.failureRate}% failure rate affecting ${worstTopic.count.toLocaleString()} conversations.`);
  }
  if (bestPlatform && activePlatforms.length > 1) {
    keyFindings.push(`${bestPlatform.label} leads in quality with an average score of ${bestPlatform.avgQuality}/100.`);
  }
  if (bestTopic) {
    keyFindings.push(`The strongest topic is "${formatLabel(bestTopic.intent)}" with ${bestTopic.completionRate}% completion and quality ${bestTopic.avgQuality}/100.`);
  }

  // ── Recommendations ──────────────────────────────────────────────────────────
  const recommendations: { priority: number; title: string; description: string; metric: string }[] = [];
  topFailures.slice(0, 3).forEach((topic, i) => {
    recommendations.push({
      priority: i + 1,
      title: `Improve "${formatLabel(topic.intent)}"`,
      description: `${topic.failureRate}% failure rate with ${topic.count.toLocaleString()} conversations affected. Focus on training data and response quality for this topic.`,
      metric: `${topic.failureRate}% failure rate`,
    });
  });

  return NextResponse.json({
    summary: {
      totalConversations: total,
      analyzedCount,
      platformCount: activePlatforms.length,
      platforms: activePlatforms.map((p) => PLATFORM_LABELS[p] ?? p),
      overallQuality,
      overallCompletion,
      overallFailure,
      healthScore,
      topFailureIntent: worstTopic?.intent ?? null,
      topFailureRate: worstTopic?.failureRate ?? null,
      bestIntent: bestTopic?.intent ?? null,
      bestCompletion: bestTopic?.completionRate ?? null,
      bestPlatform: bestPlatform?.label ?? null,
      bestPlatformQuality: bestPlatform?.avgQuality ?? null,
    },
    keyFindings,
    topTopics: topTopics.map((t) => ({
      ...t,
      intentLabel: formatLabel(t.intent),
    })),
    topFailures: topFailures.map((t) => ({
      ...t,
      intentLabel: formatLabel(t.intent),
      examples: failureExamples[t.intent] ?? [],
    })),
    recommendations,
    platformComparison,
    platformSpecialization,
    dateRange: {
      start: (dateStart?.[0] as { created_at?: string } | undefined)?.created_at ?? null,
      end:   (dateEnd?.[0]   as { created_at?: string } | undefined)?.created_at ?? null,
    },
    generatedAt: new Date().toISOString(),
    isMultiPlatform: activePlatforms.length > 1,
  });
}
