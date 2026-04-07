import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { encodeSession, getOrCreateOrg } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/onboarding?error=missing_token", req.url));
  }

  // Verify token
  const result = await sql`
    SELECT email, expires_at, used FROM magic_tokens WHERE token = ${token} LIMIT 1
  `;

  if (result.rows.length === 0) {
    return NextResponse.redirect(new URL("/onboarding?error=invalid_token", req.url));
  }

  const row = result.rows[0];
  if (row.used) {
    return NextResponse.redirect(new URL("/onboarding?error=token_already_used", req.url));
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.redirect(new URL("/onboarding?error=token_expired", req.url));
  }

  // Mark token as used
  await sql`UPDATE magic_tokens SET used = true WHERE token = ${token}`;

  try {
    const orgId = await getOrCreateOrg(row.email);
    const sessionValue = encodeSession(orgId, row.email);

    const response = NextResponse.redirect(new URL("/onboarding?step=platform", req.url));
    response.cookies.set("cm_session", sessionValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/confirm] Error:", err);
    return NextResponse.redirect(new URL("/onboarding?error=failed", req.url));
  }
}
