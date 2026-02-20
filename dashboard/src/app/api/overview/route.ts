import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET() {
  const sb = getSupabaseServer();

  // Total conversation count
  const { count: total, error: totalErr } = await sb
    .from("conversations")
    .select("*", { count: "exact", head: true });
  if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 });

  // All analyzed rows — lightweight (no messages column)
  const { data: rows, error } = await sb
    .from("conversations")
    .select("id, intent, quality_score, completion_status, created_at, metadata")
    .not("intent", "is", null)
    .limit(100000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const analyzed = rows ?? [];

  // Per-platform total counts (5 parallel count queries)
  const platformTotals = await Promise.all(
    PLATFORMS.map((p) =>
      sb
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("metadata->>platform", p)
        .then((r) => ({ platform: p, count: r.count ?? 0 }))
    )
  );
  const totalByPlatform = Object.fromEntries(platformTotals.map((x) => [x.platform, x.count]));

  // Aggregate stats from analyzed rows
  let qualitySum = 0, qualityCount = 0, completedCount = 0, turnsSum = 0, turnsCount = 0;
  const platformStats: Record<string, {
    analyzed: number; qualitySum: number; qualityCount: number; completed: number;
  }> = {};

  for (const row of analyzed) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    platformStats[platform] ??= { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    const g = platformStats[platform];
    g.analyzed++;

    if (row.quality_score !== null) {
      qualitySum += row.quality_score;
      qualityCount++;
      g.qualitySum += row.quality_score;
      g.qualityCount++;
    }
    if (row.completion_status === "completed") {
      completedCount++;
      g.completed++;
    }
    const turns = meta?.turns_count as number | null;
    if (typeof turns === "number" && turns > 0) {
      turnsSum += turns;
      turnsCount++;
    }
  }

  const byPlatform = PLATFORMS.map((p) => {
    const g = platformStats[p] ?? { analyzed: 0, qualitySum: 0, qualityCount: 0, completed: 0 };
    return {
      platform: p,
      total: totalByPlatform[p] ?? 0,
      analyzed: g.analyzed,
      avgQuality: g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null,
      completionRate: g.analyzed > 0 ? Math.round((g.completed / g.analyzed) * 100) : null,
    };
  });

  // Recent 10 analyzed conversations
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
      total: total ?? 0,
      analyzed: analyzed.length,
      avgQuality: qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null,
      completionRate: analyzed.length > 0 ? Math.round((completedCount / analyzed.length) * 100) : null,
      avgTurns: turnsCount > 0 ? Math.round((turnsSum / turnsCount) * 10) / 10 : null,
    },
    byPlatform,
    recentAnalyzed,
  });
}
