import { sql } from "@vercel/postgres";

interface CallRow {
  id: string;
  external_call_id: string;
  platform: string;
  intent: string;
  outcome: string;
  sentiment_score: number;
  duration_seconds: number;
  flags: string[];
  caller_phone: string;
  started_at: string;
}

async function pushToPostHog(apiKey: string, call: CallRow, week: string): Promise<void> {
  await fetch("https://app.posthog.com/capture/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event: "conversation_completed",
      distinct_id: call.caller_phone || call.id,
      timestamp: call.started_at,
      properties: {
        intent: call.intent,
        outcome: call.outcome,
        sentiment_score: call.sentiment_score,
        duration_seconds: call.duration_seconds,
        flags: call.flags,
        platform: call.platform,
        week,
      },
    }),
  });
}

async function pushToMixpanel(token: string, call: CallRow, week: string): Promise<void> {
  const event = {
    event: "conversation_completed",
    properties: {
      token,
      distinct_id: call.caller_phone || call.id,
      time: Math.round(new Date(call.started_at).getTime() / 1000),
      intent: call.intent,
      outcome: call.outcome,
      sentiment_score: call.sentiment_score,
      duration_seconds: call.duration_seconds,
      flags: call.flags,
      platform: call.platform,
      week,
    },
  };
  await fetch("https://api.mixpanel.com/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
    },
    body: JSON.stringify([event]),
  });
}

export async function sendSlackBriefing(webhookUrl: string, briefingMarkdown: string): Promise<void> {
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "ConvoMetrics Weekly Briefing",
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `\`\`\`${briefingMarkdown}\`\`\`` } },
      ],
    }),
  });
}

export async function syncIntegrations(orgId: string): Promise<{ posthog: number; mixpanel: number; slack: boolean }> {
  const result = { posthog: 0, mixpanel: 0, slack: false };

  const orgResult = await sql`SELECT * FROM orgs WHERE id = ${orgId}::uuid`;
  const org = orgResult.rows[0];
  if (!org) return result;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const isoWeek = `${weekStart.getFullYear()}-W${String(
    Math.ceil((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000 / 7)
  ).padStart(2, "0")}`;

  const callsResult = await sql`
    SELECT * FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'done' AND started_at >= ${weekStart.toISOString()}
  `;

  if (callsResult.rows.length === 0) return result;

  if (org.posthog_api_key) {
    for (const call of callsResult.rows) {
      try {
        await pushToPostHog(org.posthog_api_key, call as any, isoWeek);
        result.posthog++;
      } catch (err) {
        console.error(`[sync/posthog] Failed for call ${call.id}:`, err);
      }
    }
  }

  if (org.mixpanel_token) {
    for (const call of callsResult.rows) {
      try {
        await pushToMixpanel(org.mixpanel_token, call as any, isoWeek);
        result.mixpanel++;
      } catch (err) {
        console.error(`[sync/mixpanel] Failed for call ${call.id}:`, err);
      }
    }
  }

  return result;
}
