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

  // Sentiment by intent (this week)
  const sentRes = await sql`
    SELECT intent, sentiment_score FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${weekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekEnd.toISOString()}
      AND sentiment_score IS NOT NULL
  `;

  const intentSent: Record<string, { sum: number; count: number }> = {};
  for (const r of sentRes.rows) {
    const i = r.intent || "unknown";
    if (!intentSent[i]) intentSent[i] = { sum: 0, count: 0 };
    intentSent[i].sum += r.sentiment_score;
    intentSent[i].count++;
  }
  const sentimentByIntent = Object.entries(intentSent)
    .map(([intent, d]) => ({ intent, avg_sentiment: Math.round((d.sum / d.count) * 10) / 10 }))
    .sort((a, b) => a.avg_sentiment - b.avg_sentiment)
    .slice(0, 8);

  // Churn distribution (all calls this week)
  const allRes = await sql`
    SELECT sentiment_score, outcome FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${weekStart.toISOString()}
      AND COALESCE(started_at, created_at) < ${weekEnd.toISOString()}
  `;
  let high = 0, medium = 0, low = 0;
  for (const r of allRes.rows) {
    const s = r.sentiment_score ?? 3;
    const notResolved = r.outcome !== "resolved";
    if (s < 1.5 && notResolved) high++;
    else if (s < 3 && notResolved) medium++;
    else low++;
  }
  const total = allRes.rows.length || 1;

  // Polite churner by week (8 weeks)
  const politeByWeek: { week: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);
    const wk = await sql`
      SELECT count(*) as c FROM calls
      WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
        AND COALESCE(started_at, created_at) >= ${wStart.toISOString()}
        AND COALESCE(started_at, created_at) < ${wEnd.toISOString()}
        AND 'polite_churner' = ANY(flags)
    `;
    politeByWeek.push({
      week: wStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: parseInt(wk.rows[0].c),
    });
  }

  return NextResponse.json({
    sentiment_by_intent: sentimentByIntent,
    churn_distribution: {
      high, medium, low,
      high_pct: Math.round((high / total) * 100),
      medium_pct: Math.round((medium / total) * 100),
      low_pct: Math.round((low / total) * 100),
    },
    polite_churner_by_week: politeByWeek,
  });
}
