import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // This week by intent
  const thisWeek = await sql`
    SELECT intent, outcome FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${weekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekEnd.toISOString()}
  `;
  // Last week by intent
  const lastWeekQ = await sql`
    SELECT intent FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${lastWeekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekStart.toISOString()}
  `;

  // Intent volume
  const twMap: Record<string, number> = {};
  const lwMap: Record<string, number> = {};
  for (const r of thisWeek.rows) { twMap[r.intent || "unknown"] = (twMap[r.intent || "unknown"] || 0) + 1; }
  for (const r of lastWeekQ.rows) { lwMap[r.intent || "unknown"] = (lwMap[r.intent || "unknown"] || 0) + 1; }

  const allIntents = new Set([...Object.keys(twMap), ...Object.keys(lwMap)]);
  const intentVolume = [...allIntents].map(intent => {
    const tw = twMap[intent] || 0;
    const lw = lwMap[intent] || 0;
    const delta = lw > 0 ? Math.round(((tw - lw) / lw) * 100) : (tw > 0 ? 100 : 0);
    return { intent, this_week: tw, last_week: lw, delta_pct: delta };
  }).sort((a, b) => b.this_week - a.this_week).slice(0, 8);

  // Intent × outcome matrix
  const matrix: Record<string, Record<string, number>> = {};
  for (const r of thisWeek.rows) {
    const i = r.intent || "unknown";
    if (!matrix[i]) matrix[i] = { resolved: 0, gave_up: 0, escalated: 0, abandoned: 0, total: 0 };
    matrix[i][r.outcome || "abandoned"]++;
    matrix[i].total++;
  }
  const intentMatrix = Object.entries(matrix)
    .map(([intent, counts]) => ({
      intent,
      resolved: counts.resolved,
      gave_up: counts.gave_up,
      escalated: counts.escalated,
      abandoned: counts.abandoned,
      total: counts.total,
      fcr_pct: counts.total > 0 ? Math.round((counts.resolved / counts.total) * 100) : 0,
    }))
    .sort((a, b) => (b.gave_up + b.escalated) - (a.gave_up + a.escalated))
    .slice(0, 8);

  // New intents
  const lwIntents = new Set(Object.keys(lwMap));
  const newIntents = Object.keys(twMap).filter(i => !lwIntents.has(i));

  return NextResponse.json({
    intent_volume: intentVolume,
    intent_matrix: intentMatrix,
    new_intents: newIntents,
  });
}
