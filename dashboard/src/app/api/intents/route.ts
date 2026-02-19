import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_DAY  = 864e5;
const MS_WEEK = 7 * MS_DAY;

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const selected = req.nextUrl.searchParams.get("intent");
  const segment  = req.nextUrl.searchParams.get("segment"); // beginner | designer | developer

  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, abandon_point, created_at, user_id, messages, conversation_id, id, metadata");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const t7  = now - MS_WEEK;

  const segmentActive = !!segment && segment !== "all";

  // Group by intent
  const byIntent: Record<string, {
    count: number;
    countThisWeek: number;
    scores: number[];
    statuses: Record<string, number>;
  }> = {};

  // Segment-filtered grouping
  const byIntentSeg: Record<string, {
    count: number;
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

    // Segment filtering
    if (segmentActive) {
      const meta = row.metadata as Record<string, unknown> | null;
      const userExp = typeof meta?.user_experience === "string" ? meta.user_experience : null;
      if (userExp?.toLowerCase() === segment.toLowerCase()) {
        byIntentSeg[intent] ??= { count: 0, scores: [], statuses: {} };
        const gs = byIntentSeg[intent];
        gs.count++;
        if (row.quality_score !== null) gs.scores.push(row.quality_score);
        if (s) gs.statuses[s] = (gs.statuses[s] || 0) + 1;
      }
    }
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

  // Build segment summary map
  const segmentSummary: Record<string, { avgScore: number | null; completionRate: number; count: number }> = {};
  if (segmentActive) {
    for (const [intent, g] of Object.entries(byIntentSeg)) {
      const avgScore = g.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null;
      const completed = g.statuses["completed"] || 0;
      const completionRate = g.count ? Math.round((completed / g.count) * 100) : 0;
      segmentSummary[intent] = { avgScore, completionRate, count: g.count };
    }
  }

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

    const abandonedRows = intentRows.filter(
      (r) => r.completion_status === "failed" || r.completion_status === "abandoned"
    );

    // Median abandon_point across abandoned/failed conversations
    const abandonPoints = abandonedRows
      .map((r) => r.abandon_point as number | null)
      .filter((ap): ap is number => ap !== null)
      .sort((a, b) => a - b);
    const typicalAbandonPoint = abandonPoints.length
      ? abandonPoints[Math.floor(abandonPoints.length / 2)]
      : null;

    // AI response that preceded the typical abandonment point
    let abandonmentAiResponse: string | null = null;
    if (typicalAbandonPoint !== null && typicalAbandonPoint > 0) {
      const representativeConv = abandonedRows
        .filter((r) => r.abandon_point !== null)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (representativeConv) {
        const msgs = representativeConv.messages as { role: string; content: string }[];
        const precedingMsg = msgs[(representativeConv.abandon_point as number) - 1];
        if (precedingMsg?.role === "assistant") {
          abandonmentAiResponse = precedingMsg.content;
        }
      }
    }

    // 5 most recent failed or abandoned conversations
    const failedConversations = abandonedRows
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        conversation_id: r.conversation_id,
        user_id: r.user_id,
        quality_score: r.quality_score,
        completion_status: r.completion_status,
        abandon_point: r.abandon_point,
        created_at: r.created_at,
        messages: r.messages,
      }));

    // Failure patterns from the worker (null when not yet computed)
    const { data: fpRow } = await sb
      .from("failure_patterns")
      .select("patterns")
      .eq("intent", selected)
      .maybeSingle();
    const failurePatterns: { label: string; pct: number; example: string }[] | null =
      fpRow?.patterns ?? null;

    detail = {
      intent: selected,
      completionBreakdown,
      failedConversations,
      typicalAbandonPoint,
      abandonmentAiResponse,
      failurePatterns,
    };
  }

  return NextResponse.json({ summary, segmentSummary, detail });
}
