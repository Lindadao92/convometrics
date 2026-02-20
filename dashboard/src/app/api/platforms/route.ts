import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET() {
  const sb = getSupabaseServer();

  // Fetch all analyzed rows — lightweight (no messages)
  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, metadata")
    .not("intent", "is", null)
    .limit(100000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Per-platform total counts (including unanalyzed)
  const totalCounts = await Promise.all(
    PLATFORMS.map((p) =>
      sb
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("metadata->>platform", p)
        .then((r) => ({ platform: p, count: r.count ?? 0 }))
    )
  );
  const totalByPlatform = Object.fromEntries(totalCounts.map((x) => [x.platform, x.count]));

  // Total analyzed count
  const { count: totalAnalyzed } = await sb
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .not("intent", "is", null);

  // Aggregate by platform
  const stats: Record<string, {
    analyzed: number;
    qualityScores: number[];
    statuses: Record<string, number>;
    intentCounts: Record<string, number>;
    turnsSum: number;
    turnsCount: number;
  }> = {};

  for (const row of rows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    stats[platform] ??= {
      analyzed: 0, qualityScores: [], statuses: {}, intentCounts: {}, turnsSum: 0, turnsCount: 0,
    };
    const g = stats[platform];
    g.analyzed++;
    if (row.quality_score !== null) g.qualityScores.push(row.quality_score);
    if (row.completion_status) g.statuses[row.completion_status] = (g.statuses[row.completion_status] || 0) + 1;
    if (row.intent) g.intentCounts[row.intent] = (g.intentCounts[row.intent] || 0) + 1;
    const turns = meta?.turns_count as number | undefined;
    if (typeof turns === "number" && turns > 0) { g.turnsSum += turns; g.turnsCount++; }
  }

  const platforms = PLATFORMS.map((p) => {
    const g = stats[p];
    const total = totalByPlatform[p] ?? 0;
    if (!g) return { platform: p, total, analyzed: 0, avgQuality: null, completionRate: null, topIntent: null, avgTurns: null, statuses: {} };

    const avgQuality = g.qualityScores.length
      ? Math.round(g.qualityScores.reduce((a, b) => a + b, 0) / g.qualityScores.length)
      : null;
    const completed = g.statuses["completed"] ?? 0;
    const completionRate = g.analyzed > 0 ? Math.round((completed / g.analyzed) * 100) : null;
    const topIntent = Object.entries(g.intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const avgTurns = g.turnsCount > 0 ? Math.round((g.turnsSum / g.turnsCount) * 10) / 10 : null;

    return { platform: p, total, analyzed: g.analyzed, avgQuality, completionRate, topIntent, avgTurns, statuses: g.statuses };
  });

  const grandTotal = PLATFORMS.reduce((s, p) => s + (totalByPlatform[p] ?? 0), 0);
  const pending = Math.max(0, grandTotal - (totalAnalyzed ?? 0));

  return NextResponse.json({ platforms, pending });
}
