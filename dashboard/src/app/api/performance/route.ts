import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const platform = req.nextUrl.searchParams.get("platform");

  let query = sb
    .from("conversations")
    .select("intent, quality_score, completion_status, metadata")
    .not("intent", "is", null)
    .limit(100000);

  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Aggregation accumulators ────────────────────────────────────────────────
  const qualityBuckets: Record<string, number> = {
    "0–20": 0, "21–40": 0, "41–60": 0, "61–80": 0, "81–100": 0,
  };
  const statusCounts: Record<string, number> = {};
  const byIntent: Record<string, {
    count: number; scores: number[]; completed: number;
    failed: number; abandoned: number;
  }> = {};
  const byPlatformData: Record<string, { scores: number[]; completed: number; total: number }> = {};
  // turns group → quality scores (for "quality by length" line chart)
  const byTurnsGroup: Record<string, number[]> = {
    "1": [], "2–3": [], "4–6": [], "7–10": [], "10+": [],
  };
  // abandoned conversations: at which turn did they stop?
  const abandonedByTurns: Record<number, number> = {};

  for (const row of rows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const p = (meta?.platform as string) ?? "unknown";
    const turns = meta?.turns_count as number | null;
    const q = row.quality_score as number | null;
    const status = row.completion_status as string | null;
    const intent = row.intent as string;

    // Status counts
    if (status) statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    // Quality histogram
    if (q !== null) {
      if      (q <= 20) qualityBuckets["0–20"]++;
      else if (q <= 40) qualityBuckets["21–40"]++;
      else if (q <= 60) qualityBuckets["41–60"]++;
      else if (q <= 80) qualityBuckets["61–80"]++;
      else              qualityBuckets["81–100"]++;
    }

    // By intent
    byIntent[intent] ??= { count: 0, scores: [], completed: 0, failed: 0, abandoned: 0 };
    const ig = byIntent[intent];
    ig.count++;
    if (q !== null) ig.scores.push(q);
    if (status === "completed") ig.completed++;
    if (status === "failed")    ig.failed++;
    if (status === "abandoned") ig.abandoned++;

    // By platform
    byPlatformData[p] ??= { scores: [], completed: 0, total: 0 };
    byPlatformData[p].total++;
    if (q !== null) byPlatformData[p].scores.push(q);
    if (status === "completed") byPlatformData[p].completed++;

    // Quality by turns group (line chart)
    if (q !== null && typeof turns === "number" && turns > 0) {
      const tg = turns === 1 ? "1" : turns <= 3 ? "2–3" : turns <= 6 ? "4–6" : turns <= 10 ? "7–10" : "10+";
      byTurnsGroup[tg].push(q);
    }

    // Abandonment by turn number
    if (status === "abandoned" && typeof turns === "number" && turns > 0) {
      abandonedByTurns[turns] = (abandonedByTurns[turns] ?? 0) + 1;
    }
  }

  // ── Build intent summaries ──────────────────────────────────────────────────
  const intentArr = Object.entries(byIntent).map(([intent, g]) => {
    const avgQuality = g.scores.length
      ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
      : null;
    const failureRate = g.count > 0 ? Math.round(((g.failed + g.abandoned) / g.count) * 1000) / 10 : 0;
    const completionRate = g.count > 0 ? Math.round((g.completed / g.count) * 1000) / 10 : 0;
    const qualityGap = avgQuality !== null ? 100 - avgQuality : 50;
    const impactScore = Math.round(g.count * (failureRate / 100) * (qualityGap / 100) * 1000);
    return {
      intent, count: g.count, avgQuality, failureRate, completionRate,
      failedCount: g.failed, abandonedCount: g.abandoned, qualityGap, impactScore,
    };
  });

  // Quality by topic: bottom 30, sorted worst to best (for horizontal bar)
  const qualityByTopic = intentArr
    .filter((x) => x.avgQuality !== null && x.count >= 3)
    .sort((a, b) => (a.avgQuality ?? 0) - (b.avgQuality ?? 0))
    .slice(0, 30)
    .map(({ intent, avgQuality, count }) => ({ intent, avgQuality: avgQuality!, count }));

  // Completion by topic: sorted worst to best
  const completionByTopic = intentArr
    .filter((x) => x.count >= 3)
    .sort((a, b) => a.completionRate - b.completionRate)
    .slice(0, 30)
    .map(({ intent, completionRate, count }) => ({ intent, completionRate, count }));

  // Quality by platform
  const qualityByPlatform = PLATFORMS.map((p) => {
    const g = byPlatformData[p];
    return {
      platform: p,
      avgQuality: g?.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null,
      completionRate: g?.total ? Math.round((g.completed / g.total) * 1000) / 10 : null,
      count: g?.total ?? 0,
    };
  }).filter((p) => p.count > 0);

  // Quality by turns group (ordered)
  const turnsOrder = ["1", "2–3", "4–6", "7–10", "10+"];
  const qualityByTurns = turnsOrder.map((group) => {
    const scores = byTurnsGroup[group] ?? [];
    return {
      group,
      avgQuality: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
      count: scores.length,
    };
  }).filter((x) => x.count > 0);

  // Status breakdown for donut
  const statusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  // Abandonment histogram: sort by turn number, cap at turn 15
  const abandonmentHistogram = Object.entries(abandonedByTurns)
    .map(([turn, count]) => ({ turn: parseInt(turn), count }))
    .sort((a, b) => a.turn - b.turn)
    .slice(0, 15);

  // Impact matrix + fix priorities (top 50 by impact)
  const impactMatrix = intentArr
    .filter((x) => x.count >= 3)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 50)
    .map(({ intent, count, failureRate, avgQuality, qualityGap, impactScore }) => ({
      intent, count, failureRate, avgQuality, qualityGap, impactScore,
    }));

  // Fetch example failed messages for top 10 fix-first items
  const topIntentsForExamples = impactMatrix.slice(0, 10).map((x) => x.intent);
  const intentExamples: Record<string, string[]> = {};

  if (topIntentsForExamples.length > 0) {
    let exQuery = sb
      .from("conversations")
      .select("intent, messages")
      .in("intent", topIntentsForExamples)
      .in("completion_status", ["failed", "abandoned"])
      .limit(60);
    if (platform && platform !== "all") {
      exQuery = exQuery.eq("metadata->>platform", platform);
    }
    const { data: failedConvs } = await exQuery;
    for (const conv of failedConvs ?? []) {
      const intent = conv.intent as string;
      intentExamples[intent] ??= [];
      if (intentExamples[intent].length >= 2) continue;
      const messages = conv.messages as { role: string; content: string }[] | null;
      const firstUser = messages?.find((m) => m.role === "user")?.content ?? "";
      if (firstUser) intentExamples[intent].push(firstUser.slice(0, 200));
    }
  }

  const fixFirst = impactMatrix.slice(0, 10).map((item) => ({
    ...item,
    examples: intentExamples[item.intent] ?? [],
  }));

  // Auto-insight: quality drop after long conversations
  const longConvoQuality = qualityByTurns.find((x) => x.group === "10+");
  const shortConvoQuality = qualityByTurns.find((x) => x.group === "1");
  const qualityDropInsight =
    longConvoQuality?.avgQuality && shortConvoQuality?.avgQuality
      ? `Quality averages ${shortConvoQuality.avgQuality}/100 for 1-turn conversations vs ${longConvoQuality.avgQuality}/100 for 10+ turns — longer conversations are harder for AI.`
      : null;

  // Auto-insight: abandonment peak
  const peakAbandonment = abandonmentHistogram.sort((a, b) => b.count - a.count)[0];
  const abandonmentInsight = peakAbandonment
    ? `Most abandonments (${peakAbandonment.count.toLocaleString()}) happen at turn ${peakAbandonment.turn} — users give the AI ${peakAbandonment.turn} exchanges before giving up.`
    : null;

  // Auto-insight: fix priority
  const topFix = fixFirst[0];
  const fixInsight = topFix
    ? `Fixing "${topFix.intent.replace(/_/g, " ")}" (${topFix.failureRate}% failure rate, ${topFix.count.toLocaleString()} conversations) would have the highest impact on overall quality.`
    : null;

  return NextResponse.json({
    qualityDistribution: Object.entries(qualityBuckets).map(([label, count]) => ({ label, count })),
    qualityByTopic,
    qualityByPlatform,
    qualityByTurns,
    statusBreakdown,
    completionByTopic,
    abandonmentHistogram: abandonmentHistogram.sort((a, b) => a.turn - b.turn),
    impactMatrix,
    fixFirst,
    total: rows?.length ?? 0,
    insights: {
      qualityDrop: qualityDropInsight,
      abandonment: abandonmentInsight,
      topFix: fixInsight,
    },
  });
}
