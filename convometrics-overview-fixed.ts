import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { computeMockOverviewStats } from "@/lib/mockSegmentData";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  // Demo mode: return mock segment data
  if (segment) {
    return NextResponse.json(computeMockOverviewStats(segment, days));
  }

  const sb = getSupabaseServer();

  // Calculate date filter for better performance and accuracy
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffISO = cutoffDate.toISOString();

  try {
    // True counts via parallel HEAD requests (no rows fetched) with date filtering
    const [totalCountResult, ...platformCountResults] = await Promise.all([
      sb.from("conversations").select("*", { count: "exact", head: true }).gte("created_at", cutoffISO),
      ...PLATFORMS.map((p) =>
        sb.from("conversations").select("*", { count: "exact", head: true })
          .eq("metadata->>platform", p)
          .gte("created_at", cutoffISO)
      ),
    ]);
    
    if (totalCountResult.error) {
      console.error("Error fetching total count:", totalCountResult.error);
      return NextResponse.json({ error: totalCountResult.error.message }, { status: 500 });
    }

    const totalCount = totalCountResult.count ?? 0;
    const truePlatformTotals: Record<string, number> = {};
    for (let i = 0; i < PLATFORMS.length; i++) {
      const result = platformCountResults[i];
      if (result.error) {
        console.warn(`Error fetching count for platform ${PLATFORMS[i]}:`, result.error);
        truePlatformTotals[PLATFORMS[i]] = 0;
      } else {
        truePlatformTotals[PLATFORMS[i]] = result.count ?? 0;
      }
    }

    // Sample rows for aggregation — metadata only, filtered by date
    const { data: allMeta, error: allErr } = await sb
      .from("conversations")
      .select("metadata")
      .gte("created_at", cutoffISO)
      .limit(200000);
    if (allErr) {
      console.error("Error fetching metadata:", allErr);
      return NextResponse.json({ error: allErr.message }, { status: 500 });
    }

    // All analyzed rows — no messages column, filtered by date
    const { data: analyzedRows, error: analyzedErr } = await sb
      .from("conversations")
      .select("id, intent, quality_score, completion_status, created_at, metadata")
      .not("intent", "is", null)
      .gte("created_at", cutoffISO)
      .limit(100000);
    if (analyzedErr) {
      console.error("Error fetching analyzed rows:", analyzedErr);
      return NextResponse.json({ error: analyzedErr.message }, { status: 500 });
    }

  const all = allMeta ?? [];
  const analyzed = analyzedRows ?? [];

  // ── Raw stats from ALL conversations ────────────────────────────────────────
  let totalMessages = 0;
  let turnsSum = 0, turnsCount = 0;
  const platformRaw: Record<string, { total: number; turnsSum: number; turnsCount: number }> = {};
  const turnBuckets: Record<string, number> = { "1": 0, "2-3": 0, "4-6": 0, "7-10": 0, "10+": 0 };

  for (const row of all) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    const turns = meta?.turns_count as number | null;

    platformRaw[platform] ??= { total: 0, turnsSum: 0, turnsCount: 0 };
    platformRaw[platform].total++;

    if (typeof turns === "number" && turns > 0) {
      totalMessages += turns;
      turnsSum += turns;
      turnsCount++;
      platformRaw[platform].turnsSum += turns;
      platformRaw[platform].turnsCount++;

      if (turns === 1)      turnBuckets["1"]++;
      else if (turns <= 3)  turnBuckets["2-3"]++;
      else if (turns <= 6)  turnBuckets["4-6"]++;
      else if (turns <= 10) turnBuckets["7-10"]++;
      else                  turnBuckets["10+"]++;
    }
  }

  const avgTurnsAll = turnsCount > 0 ? Math.round((turnsSum / turnsCount) * 10) / 10 : null;

  const avgTurnsByPlatform = PLATFORMS.map((p) => {
    const g = platformRaw[p];
    return {
      platform: p,
      total: g?.total ?? 0,
      avgTurns: g && g.turnsCount > 0 ? Math.round((g.turnsSum / g.turnsCount) * 10) / 10 : null,
    };
  });

  const turnDistribution = [
    { label: "1",    count: turnBuckets["1"] },
    { label: "2–3",  count: turnBuckets["2-3"] },
    { label: "4–6",  count: turnBuckets["4-6"] },
    { label: "7–10", count: turnBuckets["7-10"] },
    { label: "10+",  count: turnBuckets["10+"] },
  ];

  // ── Analyzed stats ───────────────────────────────────────────────────────────
  let qualitySum = 0, qualityCount = 0, completedCount = 0, failedCount = 0, abandonedCount = 0;
  const platformAnalyzed: Record<string, {
    analyzed: number; qualitySum: number; qualityCount: number; completed: number;
  }> = {};
  const intentCounts: Record<string, { count: number; failCount: number; completeCount: number; qualitySum: number; qualityCount: number }> = {};
  const statusCounts: Record<string, number> = {};
  const qualityBuckets: Record<string, number> = { "0–20": 0, "21–40": 0, "41–60": 0, "61–80": 0, "81–100": 0 };

  for (const row of analyzed) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    platformAnalyzed[platform] ??= { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    const g = platformAnalyzed[platform];
    g.analyzed++;

    // Status tracking
    const st = row.completion_status as string | null;
    if (st) statusCounts[st] = (statusCounts[st] ?? 0) + 1;
    if (row.quality_score !== null) {
      qualitySum += row.quality_score;
      qualityCount++;
      g.qualitySum += row.quality_score;
      g.qualityCount++;
      const q = row.quality_score;
      if      (q <= 20) qualityBuckets["0–20"]++;
      else if (q <= 40) qualityBuckets["21–40"]++;
      else if (q <= 60) qualityBuckets["41–60"]++;
      else if (q <= 80) qualityBuckets["61–80"]++;
      else              qualityBuckets["81–100"]++;
    }
    if (st === "completed") { completedCount++; g.completed++; }
    if (st === "failed")    failedCount++;
    if (st === "abandoned") abandonedCount++;

    if (row.intent) {
      intentCounts[row.intent] ??= { count: 0, failCount: 0, completeCount: 0, qualitySum: 0, qualityCount: 0 };
      const ic = intentCounts[row.intent];
      ic.count++;
      if (st === "failed" || st === "abandoned") ic.failCount++;
      if (st === "completed") ic.completeCount++;
      if (row.quality_score !== null) { ic.qualitySum += row.quality_score; ic.qualityCount++; }
    }
  }

  const byPlatform = PLATFORMS.map((p) => {
    const raw = platformRaw[p] ?? { total: 0, turnsSum: 0, turnsCount: 0 };
    const ai = platformAnalyzed[p] ?? { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    return {
      platform: p,
      total: truePlatformTotals[p] ?? raw.total,
      analyzed: ai.analyzed,
      avgQuality: ai.qualityCount > 0 ? Math.round(ai.qualitySum / ai.qualityCount) : null,
      completionRate: ai.analyzed > 0 ? Math.round((ai.completed / ai.analyzed) * 1000) / 10 : null,
    };
  });

  // Intent arrays for performance insights
  const intentArr = Object.entries(intentCounts).map(([intent, g]) => ({
    intent,
    count: g.count,
    failRate: g.count > 0 ? Math.round((g.failCount / g.count) * 1000) / 10 : 0,
    avgQuality: g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null,
    completionRate: g.count > 0 ? Math.round((g.completeCount / g.count) * 1000) / 10 : 0,
  }));

  // Top 3 highest quality (min 5 convos)
  const topPerformingTopics = intentArr
    .filter((x) => x.avgQuality !== null && x.count >= 5)
    .sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0))
    .slice(0, 3)
    .map(({ intent, avgQuality, count, completionRate }) => ({ intent, avgQuality: avgQuality!, count, completionRate }));

  // Bottom 3 worst quality (min 5 convos)
  const worstPerformingTopics = intentArr
    .filter((x) => x.avgQuality !== null && x.count >= 5)
    .sort((a, b) => (a.avgQuality ?? 100) - (b.avgQuality ?? 100))
    .slice(0, 3)
    .map(({ intent, avgQuality, count, failRate }) => ({ intent, avgQuality: avgQuality!, count, failRate }));

  // Top topic by volume
  const topTopic = intentArr.length > 0
    ? [...intentArr].sort((a, b) => b.count - a.count)[0].intent
    : null;

  // Health score: avgQuality/100 × completionRate/100 × (1 - failureRate/100)
  const overallFailureRate = analyzed.length > 0
    ? (failedCount + abandonedCount) / analyzed.length
    : null;
  const overallCompletionRate = analyzed.length > 0 ? completedCount / analyzed.length : null;
  const overallAvgQuality = qualityCount > 0 ? qualitySum / qualityCount : null;

  const healthScore =
    overallAvgQuality !== null && overallCompletionRate !== null && overallFailureRate !== null
      ? Math.round((overallAvgQuality / 100) * overallCompletionRate * (1 - overallFailureRate) * 100)
      : null;

  // Status breakdown for completion funnel
  const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

  // Quality distribution histogram
  const qualityDistribution = Object.entries(qualityBuckets).map(([label, count]) => ({ label, count }));

  // Recent 10 analyzed
  const recentAnalyzed = [...analyzed]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((r) => {
      const meta = r.metadata as Record<string, unknown> | null;
      return {
        id: r.id,
        intent: r.intent,
        quality_score: r.quality_score,
        completion_status: r.completion_status,
        created_at: r.created_at,
        platform: (meta?.platform as string) ?? "unknown",
      };
    });

  return NextResponse.json({
    stats: {
      total: totalCount,
      analyzed: analyzed.length,
      avgQuality: qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null,
      completionRate: analyzed.length > 0 ? Math.round((completedCount / analyzed.length) * 1000) / 10 : null,
      failureRate: analyzed.length > 0 ? Math.round(((failedCount + abandonedCount) / analyzed.length) * 1000) / 10 : null,
      avgTurns: avgTurnsAll,
      totalMessages,
      topTopic,
    },
    healthScore,
    byPlatform,
    turnDistribution,
    avgTurnsByPlatform,
    qualityDistribution,
    statusBreakdown,
    topPerformingTopics,
    worstPerformingTopics,
    recentAnalyzed,
  });

  } catch (error) {
    console.error("Unexpected error in overview API:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching overview data" },
      { status: 500 }
    );
  }
}
