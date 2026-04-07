import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  const { metric, dimension } = await req.json();

  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);
  const eightWeeksAgo = new Date(weekStart);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  // Get all relevant calls
  const res = await sql`
    SELECT intent, outcome, platform, sentiment_score, flags, COALESCE(started_at, created_at) as ts
    FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
      AND COALESCE(started_at, created_at) >= ${eightWeeksAgo.toISOString()}
  `;
  const rows = res.rows;

  // Group by dimension
  const groups: Record<string, typeof rows> = {};
  for (const r of rows) {
    let key: string;
    if (dimension === "intent") key = r.intent || "unknown";
    else if (dimension === "outcome") key = r.outcome || "unknown";
    else if (dimension === "platform") key = r.platform || "unknown";
    else if (dimension === "week") {
      const d = new Date(r.ts);
      const wk = new Date(d);
      const wd = wk.getDay();
      wk.setDate(wk.getDate() - (wd === 0 ? 6 : wd - 1));
      key = wk.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else key = "all";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  // Compute metric per group
  const labels: string[] = [];
  const values: number[] = [];
  const colors: string[] = [];
  const outcomeColors: Record<string, string> = {
    resolved: "#1D9E75", gave_up: "#E24B4A", escalated: "#EF9F27", abandoned: "#888780",
  };

  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  for (const [label, group] of sorted.slice(0, 12)) {
    labels.push(label);
    const total = group.length || 1;

    if (metric === "fcr_rate") {
      const resolved = group.filter(r => r.outcome === "resolved").length;
      values.push(Math.round((resolved / total) * 100));
    } else if (metric === "call_volume") {
      values.push(group.length);
    } else if (metric === "sentiment_score") {
      const withSent = group.filter(r => r.sentiment_score != null);
      const avg = withSent.length > 0 ? withSent.reduce((s, r) => s + r.sentiment_score, 0) / withSent.length : 0;
      values.push(Math.round(avg * 10) / 10);
    } else if (metric === "churn_risk") {
      const highRisk = group.filter(r => (r.sentiment_score ?? 3) < 1.5 && r.outcome !== "resolved").length;
      values.push(Math.round((highRisk / total) * 100));
    } else if (metric === "escalation_rate") {
      const esc = group.filter(r => r.outcome === "escalated").length;
      values.push(Math.round((esc / total) * 100));
    } else if (metric === "polite_churner_rate") {
      const pc = group.filter(r => r.flags && r.flags.includes("polite_churner")).length;
      values.push(Math.round((pc / total) * 100));
    } else {
      values.push(group.length);
    }

    if (dimension === "outcome") colors.push(outcomeColors[label] || "#7C6EF8");
    else colors.push("#7C6EF8");
  }

  return NextResponse.json({ labels, values, colors });
}
