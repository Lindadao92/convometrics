import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

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

  // Count unanalyzed (pending)
  const { count: pending } = await sb
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .is("intent", null);

  // Group by intent
  const byIntent: Record<string, {
    failed: number; abandoned: number; total: number;
    scores: number[]; platformCounts: Record<string, number>;
  }> = {};

  for (const row of rows ?? []) {
    const intent = row.intent!;
    byIntent[intent] ??= { failed: 0, abandoned: 0, total: 0, scores: [], platformCounts: {} };
    const g = byIntent[intent];
    g.total++;
    if (row.completion_status === "failed") g.failed++;
    if (row.completion_status === "abandoned") g.abandoned++;
    if (row.quality_score !== null) g.scores.push(row.quality_score);
    const p = (row.metadata as Record<string, unknown>)?.platform as string ?? "unknown";
    g.platformCounts[p] = (g.platformCounts[p] ?? 0) + 1;
  }

  // Where AI Fails: sorted by failed+abandoned count
  const byFailure = Object.entries(byIntent)
    .map(([intent, g]) => ({
      intent,
      failedCount: g.failed,
      abandonedCount: g.abandoned,
      failureTotal: g.failed + g.abandoned,
      total: g.total,
      failureRate: g.total > 0 ? Math.round(((g.failed + g.abandoned) / g.total) * 100) : 0,
      avgQuality: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
      topPlatform: Object.entries(g.platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .filter((x) => x.failureTotal > 0)
    .sort((a, b) => b.failureTotal - a.failureTotal)
    .slice(0, 20);

  // Lowest Quality: avg score < 50 (min 3 conversations)
  const lowQuality = Object.entries(byIntent)
    .filter(([, g]) => g.scores.length >= 3 && g.scores.reduce((a, b) => a + b, 0) / g.scores.length < 50)
    .map(([intent, g]) => ({
      intent,
      avgQuality: Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length),
      count: g.total,
    }))
    .sort((a, b) => a.avgQuality - b.avgQuality)
    .slice(0, 10);

  // Fix First: impact = volume × failure_rate × (1 - quality/100)
  const fixFirst = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgQ = g.scores.length ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 75;
      const failRate = g.total > 0 ? (g.failed + g.abandoned) / g.total : 0;
      const impactScore = Math.round(g.total * failRate * (1 - avgQ / 100));
      return {
        intent,
        impactScore,
        avgQuality: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
        failureRate: Math.round(failRate * 100),
        count: g.total,
      };
    })
    .filter((x) => x.impactScore > 0)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 10);

  return NextResponse.json({ byFailure, lowQuality, fixFirst, pending: pending ?? 0 });
}
