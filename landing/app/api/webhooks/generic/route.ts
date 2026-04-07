import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const secret = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret");

    if (!secret) return NextResponse.json({ error: "Missing webhook secret" }, { status: 401 });

    const orgResult = await sql`SELECT id FROM orgs WHERE webhook_secret = ${secret} LIMIT 1`;
    if (orgResult.rows.length === 0) return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    const orgId = orgResult.rows[0].id;

    let transcript: { role: string; text: string }[] = [];
    if (Array.isArray(body.transcript)) {
      transcript = body.transcript;
    } else if (typeof body.transcript === "string") {
      for (const line of body.transcript.split("\n")) {
        const match = line.match(/^(\w+):\s*(.+)/);
        if (match) transcript.push({ role: match[1].toLowerCase(), text: match[2] });
      }
    }

    const inserted = await sql`
      INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds, transcript, raw_payload, caller_phone, analysis_status)
      VALUES (${orgId}::uuid, ${body.call_id || null}, 'webhook', ${body.started_at || null}, ${body.ended_at || null}, ${body.duration_seconds || null}, ${JSON.stringify(transcript)}, ${JSON.stringify(body)}, ${body.caller_phone || null}, 'pending')
      RETURNING id
    `;

    // Fire-and-forget: trigger analysis
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://convometrics.vercel.app'}/api/analyze`, {
      method: 'POST',
    }).catch(() => {});

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/generic] Error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
