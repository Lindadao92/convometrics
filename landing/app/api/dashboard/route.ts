import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.orgId;
  const weekParam = req.nextUrl.searchParams.get("week");

  let weekStart: Date;
  let weekEnd: Date;

  if (weekParam && weekParam !== "current" && weekParam.includes("-W")) {
    const [yearStr, weekStr] = weekParam.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);
    weekStart = getDateOfISOWeek(week, year);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
  } else {
    const now = new Date();
    weekStart = new Date(now);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
    weekStart.setHours(0, 0, 0, 0);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
  }

  const callsResult = await sql`
    SELECT id, intent, outcome, flags, sentiment_score, duration_seconds, started_at
    FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND started_at >= ${weekStart.toISOString()} AND started_at < ${weekEnd.toISOString()}
  `;

  const allCalls = callsResult.rows;
  const total = allCalls.length;
  const resolved = allCalls.filter((c) => c.outcome === "resolved").length;
  const notAbandoned = allCalls.filter((c) => c.outcome !== "abandoned").length;
  const actualRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const reportedRate = total > 0 ? Math.round((notAbandoned / total) * 100) : 0;

  // By intent
  const intentMap: Record<string, { calls: number; resolved: number }> = {};
  for (const c of allCalls) {
    const intent = c.intent || "unknown";
    if (!intentMap[intent]) intentMap[intent] = { calls: 0, resolved: 0 };
    intentMap[intent].calls++;
    if (c.outcome === "resolved") intentMap[intent].resolved++;
  }

  const failingIntents = Object.entries(intentMap)
    .map(([intent, d]) => ({
      intent,
      calls: d.calls,
      fcr: d.calls > 0 ? Math.round((d.resolved / d.calls) * 100) : 0,
    }))
    .sort((a, b) => a.fcr - b.fcr)
    .slice(0, 10);

  // Patterns
  const patternCounts: Record<string, number> = {};
  for (const c of allCalls) {
    if (c.flags && Array.isArray(c.flags)) {
      for (const f of c.flags) patternCounts[f] = (patternCounts[f] || 0) + 1;
    }
  }

  const descriptions: Record<string, string> = {
    polite_churner: 'Callers who said "ok thanks" after a failed interaction. Agent scored them as satisfied.',
    frustration_transfer: "Callers who escalated to human after AI failure. Frustration carries over.",
    repeat_caller: "Callers who called back about the same issue within 72 hours.",
  };

  const hiddenPatterns = Object.entries(patternCounts)
    .map(([type, count]) => ({ type, count, description: descriptions[type] || type }))
    .sort((a, b) => b.count - a.count);

  // 8-week trend
  const trend: { week: string; reported: number; actual: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - i * 7);
    const wEnd = new Date(wStart);
    wEnd.setDate(wEnd.getDate() + 7);

    const weekCalls = await sql`
      SELECT outcome FROM calls
      WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
        AND started_at >= ${wStart.toISOString()} AND started_at < ${wEnd.toISOString()}
    `;

    const wc = weekCalls.rows;
    const wTotal = wc.length;
    const wResolved = wc.filter((c) => c.outcome === "resolved").length;
    const wNotAbandoned = wc.filter((c) => c.outcome !== "abandoned").length;

    trend.push({
      week: wStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      reported: wTotal > 0 ? Math.round((wNotAbandoned / wTotal) * 100) : 0,
      actual: wTotal > 0 ? Math.round((wResolved / wTotal) * 100) : 0,
    });
  }

  // Sprint recommendation
  let sprintRec = { title: "No data yet", impact: "" };
  if (failingIntents.length > 0) {
    const worst = failingIntents.reduce(
      (best, i) => {
        const score = i.calls * (1 - i.fcr / 100);
        return score > best.score ? { intent: i, score } : best;
      },
      { intent: failingIntents[0], score: 0 }
    );
    sprintRec = {
      title: `Fix ${worst.intent.intent}`,
      impact: `${worst.intent.calls} calls/week at ${worst.intent.fcr}% FCR. Highest impact fix.`,
    };
  }

  // Integrations
  const orgResult = await sql`
    SELECT posthog_api_key, mixpanel_token, slack_webhook_url, linear_api_key FROM orgs WHERE id = ${orgId}::uuid
  `;
  const org = orgResult.rows[0];

  return NextResponse.json({
    calls_analyzed: total,
    reported_completion_rate: reportedRate,
    actual_resolution_rate: actualRate,
    resolution_gap: reportedRate - actualRate,
    failing_intents: failingIntents,
    hidden_patterns: hiddenPatterns,
    trend_8_weeks: trend,
    sprint_recommendation: sprintRec,
    integrations: {
      posthog: org?.posthog_api_key ? "syncing" : null,
      mixpanel: org?.mixpanel_token ? "syncing" : null,
      slack: org?.slack_webhook_url ? "weekly_digest" : null,
      linear: org?.linear_api_key ? "connected" : null,
    },
    week_start: weekStart.toISOString(),
    week_end: weekEnd.toISOString(),
  });
}

function getDateOfISOWeek(week: number, year: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - dayOfWeek + 1);
  start.setDate(start.getDate() + (week - 1) * 7);
  return start;
}
