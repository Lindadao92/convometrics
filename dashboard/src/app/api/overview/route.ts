import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabaseServer();

  // Total count
  const { count, error: countErr } = await sb
    .from("conversations")
    .select("*", { count: "exact", head: true });

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  // All rows for aggregation
  const { data: rows, error: rowsErr } = await sb
    .from("conversations")
    .select("quality_score, completion_status, intent, created_at");

  if (rowsErr) {
    return NextResponse.json({ error: rowsErr.message }, { status: 500 });
  }

  // Average quality score
  const scored = rows.filter((r) => r.quality_score !== null);
  const avgQuality =
    scored.length > 0
      ? Math.round(scored.reduce((s, r) => s + r.quality_score, 0) / scored.length)
      : 0;

  // Completion status counts
  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    const s = row.completion_status;
    if (s) statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // Top 10 intents
  const intentCounts: Record<string, number> = {};
  for (const row of rows) {
    const i = row.intent;
    if (i) intentCounts[i] = (intentCounts[i] || 0) + 1;
  }
  const topIntents = Object.entries(intentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([intent, count]) => ({ intent, count }));

  // Quality trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyScores: Record<string, { sum: number; count: number }> = {};
  for (const row of scored) {
    const date = row.created_at?.slice(0, 10);
    if (!date || new Date(date) < thirtyDaysAgo) continue;
    if (!dailyScores[date]) dailyScores[date] = { sum: 0, count: 0 };
    dailyScores[date].sum += row.quality_score;
    dailyScores[date].count += 1;
  }
  const trend = Object.entries(dailyScores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date: date.slice(5),
      avg_score: Math.round(sum / count),
    }));

  return NextResponse.json({
    totalConversations: count ?? 0,
    avgQuality,
    completionStatus: statusCounts,
    topIntents,
    qualityTrend: trend,
  });
}
