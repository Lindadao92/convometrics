import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_DAY  = 864e5;
const MS_WEEK = 7 * MS_DAY;

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const selected = req.nextUrl.searchParams.get("intent");

  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, created_at, user_id, messages, conversation_id, id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const t7  = now - MS_WEEK;

  // Group by intent
  const byIntent: Record<string, {
    count: number;
    countThisWeek: number;
    scores: number[];
    statuses: Record<string, number>;
  }> = {};

  for (const row of rows) {
    const intent = row.intent;
    if (!intent) continue;
    byIntent[intent] ??= { count: 0, countThisWeek: 0, scores: [], statuses: {} };
    const g = byIntent[intent];
    g.count++;
    if (new Date(row.created_at).getTime() >= t7) g.countThisWeek++;
    if (row.quality_score !== null) g.scores.push(row.quality_score);
    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;
  }

  // Build summary, sorted by impact score descending
  const summary = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgScore = g.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null;
      const completed   = g.statuses["completed"]  || 0;
      const failed      = g.statuses["failed"]      || 0;
      const abandoned   = g.statuses["abandoned"]   || 0;
      const completionRate = g.count ? Math.round((completed / g.count) * 100)          : 0;
      const failureRate    = g.count ? Math.round(((failed + abandoned) / g.count) * 100) : 0;
      const impactScore    = Math.round(g.count * (failureRate / 100));  // raw # of bad sessions
      return {
        intent,
        count: g.count,
        countThisWeek: g.countThisWeek,
        avgScore,
        completionRate,
        failureRate,
        impactScore,
        statuses: g.statuses,
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  // Detail for selected intent
  let detail = null;
  if (selected) {
    const intentRows = rows.filter((r) => r.intent === selected);

    // Completion breakdown for pie
    const completionBreakdown: Record<string, number> = {};
    for (const row of intentRows) {
      const s = row.completion_status;
      if (s) completionBreakdown[s] = (completionBreakdown[s] || 0) + 1;
    }

    // 5 most recent failed or abandoned conversations
    const failedConversations = intentRows
      .filter((r) => r.completion_status === "failed" || r.completion_status === "abandoned")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        conversation_id: r.conversation_id,
        user_id: r.user_id,
        quality_score: r.quality_score,
        completion_status: r.completion_status,
        created_at: r.created_at,
        messages: r.messages,
      }));

    detail = { intent: selected, completionBreakdown, failedConversations };
  }

  return NextResponse.json({ summary, detail });
}
