import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

function mask(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return "****" + key.slice(-2);
  return "****" + key.slice(-4);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await sql`SELECT * FROM orgs WHERE id = ${session.orgId}::uuid`;
  const org = result.rows[0];
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  return NextResponse.json({
    id: org.id,
    name: org.name,
    slug: org.slug,
    webhook_secret: org.webhook_secret,
    vapi_api_key: mask(org.vapi_api_key),
    retell_api_key: mask(org.retell_api_key),
    posthog_api_key: mask(org.posthog_api_key),
    mixpanel_token: mask(org.mixpanel_token),
    slack_webhook_url: mask(org.slack_webhook_url),
    linear_api_key: mask(org.linear_api_key),
    has_vapi: !!org.vapi_api_key,
    has_retell: !!org.retell_api_key,
    has_posthog: !!org.posthog_api_key,
    has_mixpanel: !!org.mixpanel_token,
    has_slack: !!org.slack_webhook_url,
    has_linear: !!org.linear_api_key,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const fields = ["posthog_api_key", "mixpanel_token", "slack_webhook_url", "linear_api_key", "name"];

  // Build SET clause dynamically
  for (const field of fields) {
    if (field in body) {
      // Each field updated individually since sql template doesn't support dynamic column names
      const val = body[field] || null;
      if (field === "posthog_api_key") await sql`UPDATE orgs SET posthog_api_key = ${val} WHERE id = ${session.orgId}::uuid`;
      else if (field === "mixpanel_token") await sql`UPDATE orgs SET mixpanel_token = ${val} WHERE id = ${session.orgId}::uuid`;
      else if (field === "slack_webhook_url") await sql`UPDATE orgs SET slack_webhook_url = ${val} WHERE id = ${session.orgId}::uuid`;
      else if (field === "linear_api_key") await sql`UPDATE orgs SET linear_api_key = ${val} WHERE id = ${session.orgId}::uuid`;
      else if (field === "name") await sql`UPDATE orgs SET name = ${val} WHERE id = ${session.orgId}::uuid`;
    }
  }

  return NextResponse.json({ updated: true });
}
