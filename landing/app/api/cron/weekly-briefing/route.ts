import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";
import { sendSlackBriefing, syncIntegrations } from "@/lib/integrations";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekEnd = new Date(now);
  const day = weekEnd.getDay();
  weekEnd.setDate(weekEnd.getDate() - (day === 0 ? 6 : day - 1));
  weekEnd.setHours(0, 0, 0, 0);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);

  const orgsResult = await sql`SELECT id, name, slack_webhook_url, posthog_api_key, mixpanel_token FROM orgs`;
  let processed = 0;

  for (const org of orgsResult.rows) {
    try {
      const callsResult = await sql`
        SELECT intent, outcome, flags, sentiment_score, duration_seconds
        FROM calls
        WHERE org_id = ${org.id}::uuid AND analysis_status = 'done'
          AND started_at >= ${weekStart.toISOString()} AND started_at < ${weekEnd.toISOString()}
      `;

      const calls = callsResult.rows;
      if (calls.length === 0) continue;

      const total = calls.length;
      const resolved = calls.filter((c) => c.outcome === "resolved").length;
      const notAbandoned = calls.filter((c) => c.outcome !== "abandoned").length;
      const actualRate = Math.round((resolved / total) * 100);
      const reportedRate = Math.round((notAbandoned / total) * 100);
      const gap = reportedRate - actualRate;

      const intentMap: Record<string, { calls: number; resolved: number }> = {};
      for (const c of calls) {
        const intent = c.intent || "unknown";
        if (!intentMap[intent]) intentMap[intent] = { calls: 0, resolved: 0 };
        intentMap[intent].calls++;
        if (c.outcome === "resolved") intentMap[intent].resolved++;
      }

      const topFailing = Object.entries(intentMap)
        .map(([intent, d]) => ({
          intent,
          calls: d.calls,
          fcr: d.calls > 0 ? Math.round((d.resolved / d.calls) * 100) : 0,
          impact_score: d.calls * (1 - (d.calls > 0 ? d.resolved / d.calls : 0)),
        }))
        .sort((a, b) => b.impact_score - a.impact_score)
        .slice(0, 5);

      const patternCounts: Record<string, number> = {};
      for (const c of calls) {
        if (c.flags) for (const f of c.flags) patternCounts[f] = (patternCounts[f] || 0) + 1;
      }
      const hiddenPatterns = Object.entries(patternCounts).map(([type, count]) => ({ type, count }));

      const worstIntent = topFailing[0];
      const sprintRec = worstIntent
        ? { title: `Fix ${worstIntent.intent}`, calls: worstIntent.calls, fcr: worstIntent.fcr, impact: `${worstIntent.calls} calls/week at ${worstIntent.fcr}% FCR` }
        : null;

      let briefingMarkdown = "";
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: "Write a concise weekly briefing for a voice AI product team. Be direct, use numbers, highlight the most surprising finding. Keep it under 25 lines. Plain text for Slack code blocks.",
          messages: [{
            role: "user",
            content: `Data for ${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}:
Total calls: ${total}
Reported completion: ${reportedRate}%
Actual resolution: ${actualRate}%
Gap: ${gap}pt

Top failing intents:
${topFailing.map((i) => `  ${i.intent}: ${i.calls} calls, ${i.fcr}% FCR`).join("\n")}

Hidden patterns:
${hiddenPatterns.map((p) => `  ${p.type}: ${p.count}`).join("\n") || "  None"}

Sprint recommendation: ${sprintRec ? `${sprintRec.title} (${sprintRec.impact})` : "None"}`,
          }],
        });
        briefingMarkdown = response.content[0].type === "text" ? response.content[0].text.trim() : "";
      } catch (err) {
        console.error(`[cron] Briefing gen failed for ${org.id}:`, err);
        briefingMarkdown = `Weekly: ${total} calls, ${actualRate}% resolution (${reportedRate}% reported). Gap: ${gap}pt.`;
      }

      await sql`
        INSERT INTO weekly_briefings (org_id, week_start, week_end, total_calls, reported_completion_rate, actual_resolution_rate, gap_points, top_failing_intents, hidden_patterns, sprint_recommendation, briefing_markdown)
        VALUES (${org.id}::uuid, ${weekStart.toISOString().split("T")[0]}, ${weekEnd.toISOString().split("T")[0]}, ${total}, ${reportedRate}, ${actualRate}, ${gap}, ${JSON.stringify(topFailing)}, ${JSON.stringify(hiddenPatterns)}, ${JSON.stringify(sprintRec)}, ${briefingMarkdown})
      `;

      if (org.slack_webhook_url) {
        try { await sendSlackBriefing(org.slack_webhook_url, briefingMarkdown); } catch {}
      }
      if (org.posthog_api_key || org.mixpanel_token) {
        try { await syncIntegrations(org.id); } catch {}
      }

      processed++;
    } catch (err) {
      console.error(`[cron] Failed for org ${org.id}:`, err);
    }
  }

  return NextResponse.json({ processed, week_start: weekStart.toISOString() });
}
