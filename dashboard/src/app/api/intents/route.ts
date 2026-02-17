import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const selected = req.nextUrl.searchParams.get("intent");

  // Fetch all conversations (only the fields we need)
  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, created_at, user_id, messages, conversation_id, id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by intent
  const byIntent: Record<
    string,
    {
      count: number;
      scores: number[];
      statuses: Record<string, number>;
      recent: number[];
      older: number[];
    }
  > = {};

  const now = Date.now();
  const sevenDays = 7 * 24 * 3600 * 1000;
  const fourteenDays = 14 * 24 * 3600 * 1000;

  for (const row of rows) {
    const intent = row.intent;
    if (!intent) continue;

    if (!byIntent[intent]) {
      byIntent[intent] = { count: 0, scores: [], statuses: {}, recent: [], older: [] };
    }
    const g = byIntent[intent];
    g.count++;

    if (row.quality_score !== null) {
      g.scores.push(row.quality_score);
      const age = now - new Date(row.created_at).getTime();
      if (age <= sevenDays) g.recent.push(row.quality_score);
      else if (age <= fourteenDays) g.older.push(row.quality_score);
    }

    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;
  }

  // Build summary table
  const summary = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgScore =
        g.scores.length > 0
          ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
          : null;

      const completionRate =
        g.count > 0
          ? Math.round(((g.statuses["completed"] || 0) / g.count) * 100)
          : 0;

      // Trend: compare recent 7d avg vs prior 7d avg
      const recentAvg =
        g.recent.length > 0
          ? g.recent.reduce((a, b) => a + b, 0) / g.recent.length
          : null;
      const olderAvg =
        g.older.length > 0
          ? g.older.reduce((a, b) => a + b, 0) / g.older.length
          : null;

      let trend: "up" | "down" | "flat" = "flat";
      if (recentAvg !== null && olderAvg !== null) {
        if (recentAvg - olderAvg > 2) trend = "up";
        else if (olderAvg - recentAvg > 2) trend = "down";
      }

      return {
        intent,
        count: g.count,
        avgScore,
        completionRate,
        trend,
        statuses: g.statuses,
      };
    })
    .sort((a, b) => b.count - a.count);

  // If a specific intent is selected, return its detail data
  let detail = null;
  if (selected) {
    const intentRows = rows.filter((r) => r.intent === selected);

    // Quality over time (daily, last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dailyScores: Record<string, { sum: number; count: number }> = {};
    for (const row of intentRows) {
      if (row.quality_score === null) continue;
      const date = row.created_at?.slice(0, 10);
      if (!date || new Date(date) < thirtyDaysAgo) continue;
      if (!dailyScores[date]) dailyScores[date] = { sum: 0, count: 0 };
      dailyScores[date].sum += row.quality_score;
      dailyScores[date].count += 1;
    }
    const qualityTrend = Object.entries(dailyScores)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { sum, count }]) => ({
        date: date.slice(5),
        avg_score: Math.round(sum / count),
      }));

    // Completion breakdown
    const completionBreakdown: Record<string, number> = {};
    for (const row of intentRows) {
      const s = row.completion_status;
      if (s) completionBreakdown[s] = (completionBreakdown[s] || 0) + 1;
    }

    // Recent conversations (last 10)
    const conversations = intentRows
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((r) => ({
        id: r.id,
        conversation_id: r.conversation_id,
        user_id: r.user_id,
        quality_score: r.quality_score,
        completion_status: r.completion_status,
        created_at: r.created_at,
        messages: r.messages,
      }));

    detail = {
      intent: selected,
      qualityTrend,
      completionBreakdown,
      conversations,
    };
  }

  return NextResponse.json({ summary, detail });
}
