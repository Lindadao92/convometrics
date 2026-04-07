import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";
import { syncIntegrations, sendSlackBriefing } from "@/lib/integrations";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await syncIntegrations(session.orgId);

  const orgResult = await sql`SELECT slack_webhook_url FROM orgs WHERE id = ${session.orgId}::uuid`;
  const org = orgResult.rows[0];

  if (org?.slack_webhook_url) {
    const briefingResult = await sql`
      SELECT briefing_markdown FROM weekly_briefings
      WHERE org_id = ${session.orgId}::uuid
      ORDER BY created_at DESC LIMIT 1
    `;
    if (briefingResult.rows[0]?.briefing_markdown) {
      try {
        await sendSlackBriefing(org.slack_webhook_url, briefingResult.rows[0].briefing_markdown);
        result.slack = true;
      } catch (err) {
        console.error("[sync] Slack error:", err);
      }
    }
  }

  return NextResponse.json(result);
}
