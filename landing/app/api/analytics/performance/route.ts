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

  // Resolution by week (8 weeks)
  const resByWeek: { week: string; reported_pct: number; actual_pct: number }[] = [];
  const escByWeek: { week: string; escalation_pct: number }[] = [];

  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);

    const wk = await sql`
      SELECT outcome FROM calls
      WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
        AND COALESCE(started_at, created_at) >= ${wStart.toISOString()}
        AND COALESCE(started_at, created_at) < ${wEnd.toISOString()}
    `;
    const rows = wk.rows;
    const t = rows.length || 1;
    const resolved = rows.filter(r => r.outcome === "resolved").length;
    const notAbandoned = rows.filter(r => r.outcome !== "abandoned").length;
    const escalated = rows.filter(r => r.outcome === "escalated").length;
    const label = wStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    resByWeek.push({
      week: label,
      reported_pct: rows.length > 0 ? Math.round((notAbandoned / t) * 100) : 0,
      actual_pct: rows.length > 0 ? Math.round((resolved / t) * 100) : 0,
    });
    escByWeek.push({
      week: label,
      escalation_pct: rows.length > 0 ? Math.round((escalated / t) * 100) : 0,
    });
  }

  // Duration by outcome (all time for this org)
  const durRes = await sql`
    SELECT outcome, AVG(duration_seconds) as avg_dur FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done' AND duration_seconds IS NOT NULL
    GROUP BY outcome
  `;
  const durationByOutcome = durRes.rows.map(r => ({
    outcome: r.outcome,
    avg_seconds: Math.round(parseFloat(r.avg_dur)),
  }));

  // Ensure all outcomes present
  for (const o of ["resolved", "gave_up", "escalated", "abandoned"]) {
    if (!durationByOutcome.find(d => d.outcome === o)) {
      durationByOutcome.push({ outcome: o, avg_seconds: 0 });
    }
  }

  return NextResponse.json({
    resolution_by_week: resByWeek,
    duration_by_outcome: durationByOutcome.sort((a, b) =>
      ["resolved", "gave_up", "escalated", "abandoned"].indexOf(a.outcome) -
      ["resolved", "gave_up", "escalated", "abandoned"].indexOf(b.outcome)
    ),
    escalation_by_week: escByWeek,
  });
}
