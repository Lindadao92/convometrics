import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  // Current week Monday
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Last week
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // This week counts
  const thisWeek = await sql`
    SELECT outcome, flags FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${weekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekEnd.toISOString()}
  `;
  const lastWeekRes = await sql`
    SELECT count(*) as c FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${lastWeekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekStart.toISOString()}
  `;

  const tw = thisWeek.rows;
  const total = tw.length;
  const resolved = tw.filter(r => r.outcome === "resolved").length;
  const escalated = tw.filter(r => r.outcome === "escalated").length;
  const politeChurner = tw.filter(r => r.flags && r.flags.includes("polite_churner")).length;

  // 8-week outcome breakdown
  const outcomeByWeek: { week: string; resolved: number; gave_up: number; escalated: number; abandoned: number }[] = [];
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
    outcomeByWeek.push({
      week: wStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      resolved: rows.filter(r => r.outcome === "resolved").length,
      gave_up: rows.filter(r => r.outcome === "gave_up").length,
      escalated: rows.filter(r => r.outcome === "escalated").length,
      abandoned: rows.filter(r => r.outcome === "abandoned").length,
    });
  }

  return NextResponse.json({
    calls_this_week: total,
    calls_last_week: parseInt(lastWeekRes.rows[0].c),
    resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    polite_churner_rate: total > 0 ? Math.round((politeChurner / total) * 100) : 0,
    escalation_rate: total > 0 ? Math.round((escalated / total) * 100) : 0,
    outcome_by_week: outcomeByWeek,
  });
}
