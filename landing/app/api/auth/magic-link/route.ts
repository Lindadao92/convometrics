import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // Generate a magic link token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  // Store token (create a simple tokens table if needed, or use orgs)
  // For now, store in a lightweight way: put it in org_users or a temp table
  await sql`
    CREATE TABLE IF NOT EXISTS magic_tokens (
      token text PRIMARY KEY,
      email text NOT NULL,
      expires_at timestamptz NOT NULL,
      used boolean DEFAULT false
    )
  `;

  await sql`
    INSERT INTO magic_tokens (token, email, expires_at)
    VALUES (${token}, ${email}, ${expiresAt})
  `;

  // In production, send this via an email service (Resend, SendGrid, etc.)
  // For now, log it and return it in the response for testing
  const confirmUrl = `${req.nextUrl.origin}/api/auth/confirm?token=${token}`;
  console.log(`[auth] Magic link for ${email}: ${confirmUrl}`);

  return NextResponse.json({
    sent: true,
    // Remove this in production — only for development/testing:
    _dev_confirm_url: confirmUrl,
  });
}
