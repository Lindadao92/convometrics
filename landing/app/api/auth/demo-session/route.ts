import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { encodeSession, getOrCreateOrg } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    let email = "demo@convometrics.com";

    // Accept email from body if provided
    try {
      const body = await req.json();
      if (body.email && typeof body.email === "string") {
        email = body.email;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    const orgId = await getOrCreateOrg(email);
    const sessionValue = encodeSession(orgId, email);

    // Get the webhook_secret for this org
    const orgResult = await sql`SELECT webhook_secret FROM orgs WHERE id = ${orgId}::uuid`;
    const webhookSecret = orgResult.rows[0]?.webhook_secret || "";

    const response = NextResponse.json({
      ok: true,
      org_id: orgId,
      webhook_secret: webhookSecret,
    });

    response.cookies.set("cm_session", sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/demo-session] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
