import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_WEEK = 7 * 864e5;

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const selected = req.nextUrl.searchParams.get("intent");
  const platform = req.nextUrl.searchParams.get("platform");

  let query = sb
    .from("conversations")
    .select("intent, quality_score, completion_status, created_at, user_id, messages, conversation_id, id, metadata")
    .not("intent", "is", null);

  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }

  const { data: rows, error } = await query;
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
    byIntent[intent] ??= { count: 0, countThisWeek: 0, scores: [], statuses: {} };
    const g = byIntent[intent];
    g.count++;
    if (new Date(row.created_at).getTime() >= t7) g.countThisWeek++;
    if (row.quality_score !== null) g.scores.push(row.quality_score);
    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;
  }

  // Summary sorted by impact score descending
  const summary = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgScore = g.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null;
      const completed      = g.statuses["completed"]  || 0;
      const failed         = g.statuses["failed"]      || 0;
      const abandoned      = g.statuses["abandoned"]   || 0;
      const completionRate = g.count ? Math.round((completed / g.count) * 100) : 0;
      const failureRate    = g.count ? Math.round(((failed + abandoned) / g.count) * 100) : 0;
      const impactScore    = Math.round(g.count * (failureRate / 100));
      return { intent, count: g.count, countThisWeek: g.countThisWeek, avgScore, completionRate, failureRate, impactScore, statuses: g.statuses };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  // Detail for selected intent
  let detail = null;
  if (selected) {
    const intentRows = rows.filter((r) => r.intent === selected);

    const completionBreakdown: Record<string, number> = {};
    for (const row of intentRows) {
      const s = row.completion_status;
      if (s) completionBreakdown[s] = (completionBreakdown[s] || 0) + 1;
    }

    function lastUserMsgIndex(messages: { role: string }[]): number | null {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return i;
      }
      return null;
    }

    const abandonedRows = intentRows
      .filter((r) => r.completion_status === "failed" || r.completion_status === "abandoned")
      .map((r) => ({ ...r, abandon_point: lastUserMsgIndex(r.messages ?? []) }));

    const abandonPoints = abandonedRows
      .map((r) => r.abandon_point)
      .filter((ap): ap is number => ap !== null)
      .sort((a, b) => a - b);
    const typicalAbandonPoint = abandonPoints.length
      ? abandonPoints[Math.floor(abandonPoints.length / 2)]
      : null;

    let abandonmentAiResponse: string | null = null;
    if (typicalAbandonPoint !== null && typicalAbandonPoint > 0) {
      const rep = abandonedRows
        .filter((r) => r.abandon_point !== null)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (rep) {
        const msgs = rep.messages as { role: string; content: string }[];
        const preceding = msgs[rep.abandon_point! - 1];
        if (preceding?.role === "assistant") abandonmentAiResponse = preceding.content;
      }
    }

    const failedConversations = abandonedRows
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((r) => ({
        id: r.id, conversation_id: r.conversation_id, user_id: r.user_id,
        quality_score: r.quality_score, completion_status: r.completion_status,
        abandon_point: r.abandon_point, created_at: r.created_at, messages: r.messages,
        platform: (r.metadata as Record<string, unknown>)?.platform as string ?? "unknown",
      }));

    let failurePatterns: { label: string; pct: number; example: string }[] | null = null;
    try {
      const { data: fpRow } = await sb
        .from("failure_patterns").select("patterns").eq("intent", selected).maybeSingle();
      failurePatterns = fpRow?.patterns ?? null;
    } catch { /* table may not exist yet */ }

    detail = { intent: selected, completionBreakdown, failedConversations, typicalAbandonPoint, abandonmentAiResponse, failurePatterns };
  }

  return NextResponse.json({ summary, detail });
}
