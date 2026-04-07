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

    if (body.event && body.event !== "call_ended") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const call = body.call || body;
    const transcript: { role: string; text: string; timestamp_seconds?: number }[] = [];

    if (call.transcript_object && Array.isArray(call.transcript_object)) {
      for (const t of call.transcript_object) {
        transcript.push({
          role: t.role === "agent" ? "agent" : "caller",
          text: t.content,
          timestamp_seconds: t.words?.[0]?.start ? Math.round(t.words[0].start) : undefined,
        });
      }
    } else if (typeof call.transcript === "string" && call.transcript) {
      for (const line of call.transcript.split("\n")) {
        const match = line.match(/^(User|Agent|Assistant|System):\s*(.+)/i);
        if (match) {
          transcript.push({
            role: match[1].toLowerCase() === "user" ? "caller" : "agent",
            text: match[2],
          });
        }
      }
    }

    const startedAt = call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null;
    const endedAt = call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null;
    let durationSeconds: number | null = null;
    if (call.duration_ms) durationSeconds = Math.round(call.duration_ms / 1000);
    else if (call.start_timestamp && call.end_timestamp) durationSeconds = Math.round((call.end_timestamp - call.start_timestamp) / 1000);

    const inserted = await sql`
      INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds, transcript, raw_payload, caller_phone, analysis_status)
      VALUES (${orgId}::uuid, ${call.call_id || null}, 'retell', ${startedAt}, ${endedAt}, ${durationSeconds}, ${JSON.stringify(transcript)}, ${JSON.stringify(body)}, ${call.from_number || null}, 'pending')
      RETURNING id
    `;

    console.log(`[webhook/retell] Received call ${call.call_id || "unknown"} for org ${orgId}`);

    // Fire-and-forget: trigger analysis
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://convometrics.vercel.app'}/api/analyze`, {
      method: 'POST',
    }).catch(() => {});

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/retell] Error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
