import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";

const SESSION_COOKIE = "cm_session";

export async function getSession(): Promise<{
  orgId: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString());
  } catch {
    return null;
  }
}

export function encodeSession(orgId: string, email: string): string {
  return Buffer.from(JSON.stringify({ orgId, email })).toString("base64");
}

export async function requireAuth(): Promise<{ orgId: string; email: string }> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getOrCreateOrg(email: string): Promise<string> {
  // Check if user already exists
  const existing = await sql`
    SELECT org_id FROM org_users WHERE email = ${email} LIMIT 1
  `;
  if (existing.rows.length > 0) return existing.rows[0].org_id;

  // Create new org
  const slug = email.split("@")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase() + "-" + Date.now();
  const orgResult = await sql`
    INSERT INTO orgs (name, slug) VALUES (${email.split("@")[1]}, ${slug})
    RETURNING id
  `;
  const orgId = orgResult.rows[0].id;

  // Create user
  await sql`
    INSERT INTO org_users (org_id, email) VALUES (${orgId}, ${email})
  `;

  return orgId;
}
