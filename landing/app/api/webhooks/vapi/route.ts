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

    const message = body.message || body;
    if (message.type && message.type !== "end-of-call-report") {
      return NextResponse.json({ received: true, skipped: true });
    }

    const call = message.call || message;
    const transcript: { role: string; text: string; timestamp_seconds?: number }[] = [];

    if (call.artifact?.messages) {
      for (const m of call.artifact.messages) {
        if (m.role && m.message) {
          transcript.push({
            role: m.role === "assistant" ? "agent" : m.role === "user" ? "caller" : m.role,
            text: m.message,
            timestamp_seconds: m.time ? Math.round(m.time / 1000) : undefined,
          });
        }
      }
    } else if (typeof call.transcript === "string" && call.transcript) {
      for (const line of call.transcript.split("\n")) {
        const match = line.match(/^(User|Assistant|Agent|System):\s*(.+)/i);
        if (match) {
          transcript.push({
            role: match[1].toLowerCase() === "assistant" ? "agent" : match[1].toLowerCase(),
            text: match[2],
          });
        }
      }
    }

    const startedAt = call.startedAt || call.started_at || null;
    const endedAt = call.endedAt || call.ended_at || null;
    let durationSeconds: number | null = call.durationSeconds || null;
    if (!durationSeconds && startedAt && endedAt) {
      durationSeconds = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    }

    const inserted = await sql`
      INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds, transcript, raw_payload, caller_phone, analysis_status)
      VALUES (${orgId}::uuid, ${call.id || null}, 'vapi', ${startedAt}, ${endedAt}, ${durationSeconds}, ${JSON.stringify(transcript)}, ${JSON.stringify(body)}, ${call.customer?.number || null}, 'pending')
      RETURNING id
    `;

    console.log(`[webhook/vapi] Received call ${call.id || "unknown"} for org ${orgId}`);

    // Fire-and-forget: trigger analysis
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://convometrics.vercel.app'}/api/analyze`, {
      method: 'POST',
    }).catch(() => {});

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/vapi] Error:", err);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
