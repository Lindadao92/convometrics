import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET() {
  const sb = getSupabaseServer();

  // All raw rows — metadata only (lightweight, ~150B/row)
  const { data: allMeta, error: allErr } = await sb
    .from("conversations")
    .select("metadata")
    .limit(200000);
  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  // All analyzed rows — no messages column
  const { data: analyzedRows, error: analyzedErr } = await sb
    .from("conversations")
    .select("id, intent, quality_score, completion_status, created_at, metadata")
    .not("intent", "is", null)
    .limit(100000);
  if (analyzedErr) return NextResponse.json({ error: analyzedErr.message }, { status: 500 });

  const all = allMeta ?? [];
  const analyzed = analyzedRows ?? [];

  // ── Raw stats from ALL conversations ──────────────────────────────────────────
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

      if (turns === 1)       turnBuckets["1"]++;
      else if (turns <= 3)   turnBuckets["2-3"]++;
      else if (turns <= 6)   turnBuckets["4-6"]++;
      else if (turns <= 10)  turnBuckets["7-10"]++;
      else                   turnBuckets["10+"]++;
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

  // ── Analyzed stats ────────────────────────────────────────────────────────────
  let qualitySum = 0, qualityCount = 0, completedCount = 0;
  const platformAnalyzed: Record<string, {
    analyzed: number; qualitySum: number; qualityCount: number; completed: number;
  }> = {};
  const intentCounts: Record<string, { count: number; failCount: number }> = {};

  for (const row of analyzed) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    platformAnalyzed[platform] ??= { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    const g = platformAnalyzed[platform];
    g.analyzed++;

    if (row.quality_score !== null) {
      qualitySum += row.quality_score;
      qualityCount++;
      g.qualitySum += row.quality_score;
      g.qualityCount++;
    }
    if (row.completion_status === "completed") { completedCount++; g.completed++; }

    if (row.intent) {
      intentCounts[row.intent] ??= { count: 0, failCount: 0 };
      intentCounts[row.intent].count++;
      if (row.completion_status === "failed" || row.completion_status === "abandoned") {
        intentCounts[row.intent].failCount++;
      }
    }
  }

  const byPlatform = PLATFORMS.map((p) => {
    const raw = platformRaw[p] ?? { total: 0, turnsSum: 0, turnsCount: 0 };
    const ai = platformAnalyzed[p] ?? { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    return {
      platform: p,
      total: raw.total,
      analyzed: ai.analyzed,
      avgQuality: ai.qualityCount > 0 ? Math.round(ai.qualitySum / ai.qualityCount) : null,
      completionRate: ai.analyzed > 0 ? Math.round((ai.completed / ai.analyzed) * 1000) / 10 : null,
    };
  });

  // Top intents by volume + worst by failure rate
  const intentArr = Object.entries(intentCounts).map(([intent, { count, failCount }]) => ({
    intent, count, failRate: count > 0 ? Math.round((failCount / count) * 1000) / 10 : 0,
  }));
  const topIntents = [...intentArr].sort((a, b) => b.count - a.count).slice(0, 3);
  const worstIntents = intentArr
    .filter((x) => x.count >= 5)
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 3);

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
      total: all.length,
      analyzed: analyzed.length,
      avgQuality: qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null,
      completionRate: analyzed.length > 0 ? Math.round((completedCount / analyzed.length) * 1000) / 10 : null,
      avgTurns: avgTurnsAll,
      totalMessages,
    },
    byPlatform,
    turnDistribution,
    avgTurnsByPlatform,
    topIntents,
    worstIntents,
    recentAnalyzed,
  });
}
