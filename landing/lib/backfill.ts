import { sql } from "@vercel/postgres";

interface VapiMessage {
  role: string;
  message: string;
  time?: number;
}

interface VapiCall {
  id: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  artifact?: {
    messages?: VapiMessage[];
    transcript?: string;
  };
}

export async function backfillVapi(orgId: string, apiKey: string): Promise<number> {
  let imported = 0;
  let cursor: string | undefined;

  for (let page = 0; page < 30; page++) {
    const url = new URL("https://api.vapi.ai/call");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("createdAtGt", cursor);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!resp.ok) {
      console.error(`[backfill/vapi] API error: ${resp.status}`);
      break;
    }

    const calls: VapiCall[] = await resp.json();
    if (!calls || calls.length === 0) break;

    for (const call of calls) {
      const transcript: { role: string; text: string; timestamp_seconds?: number }[] = [];
      if (call.artifact?.messages) {
        for (const m of call.artifact.messages) {
          if (m.role && m.message) {
            transcript.push({
              role: m.role === "assistant" ? "agent" : m.role,
              text: m.message,
              timestamp_seconds: m.time ? Math.round(m.time / 1000) : undefined,
            });
          }
        }
      }
      if (transcript.length === 0) continue;

      const startedAt = call.startedAt || null;
      const endedAt = call.endedAt || null;
      let durationSeconds: number | null = null;
      if (startedAt && endedAt) {
        durationSeconds = Math.round(
          (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
        );
      }

      // Skip if already imported
      const existing = await sql`
        SELECT id FROM calls WHERE org_id = ${orgId}::uuid AND external_call_id = ${call.id} LIMIT 1
      `;
      if (existing.rows.length > 0) continue;

      await sql`
        INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds, transcript, raw_payload, analysis_status)
        VALUES (${orgId}::uuid, ${call.id}, 'vapi', ${startedAt}, ${endedAt}, ${durationSeconds}, ${JSON.stringify(transcript)}, ${JSON.stringify(call)}, 'pending')
      `;
      imported++;
    }

    cursor = calls[calls.length - 1]?.startedAt || undefined;
    if (calls.length < 100) break;
  }

  console.log(`[backfill/vapi] Imported ${imported} calls for org ${orgId}`);
  return imported;
}

export async function backfillRetell(orgId: string, apiKey: string): Promise<number> {
  let imported = 0;

  const resp = await fetch("https://api.retellai.com/v2/list-calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: 1000 }),
  });

  if (!resp.ok) {
    console.error(`[backfill/retell] API error: ${resp.status}`);
    return 0;
  }

  const calls = await resp.json();

  for (const call of calls) {
    const transcript: { role: string; text: string; timestamp_seconds?: number }[] = [];
    if (call.transcript_object && Array.isArray(call.transcript_object)) {
      for (const t of call.transcript_object) {
        transcript.push({
          role: t.role === "agent" ? "agent" : "caller",
          text: t.content,
          timestamp_seconds: t.words?.[0]?.start ? Math.round(t.words[0].start) : undefined,
        });
      }
    }
    if (transcript.length === 0) continue;

    const existing = await sql`
      SELECT id FROM calls WHERE org_id = ${orgId}::uuid AND external_call_id = ${call.call_id} LIMIT 1
    `;
    if (existing.rows.length > 0) continue;

    const startedAt = call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null;
    const endedAt = call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null;
    let durationSeconds: number | null = null;
    if (call.start_timestamp && call.end_timestamp) {
      durationSeconds = Math.round((call.end_timestamp - call.start_timestamp) / 1000);
    }

    await sql`
      INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds, transcript, raw_payload, analysis_status)
      VALUES (${orgId}::uuid, ${call.call_id}, 'retell', ${startedAt}, ${endedAt}, ${durationSeconds}, ${JSON.stringify(transcript)}, ${JSON.stringify(call)}, 'pending')
    `;
    imported++;
  }

  console.log(`[backfill/retell] Imported ${imported} calls for org ${orgId}`);
  return imported;
}

export async function testVapiConnection(apiKey: string): Promise<boolean> {
  try {
    const resp = await fetch("https://api.vapi.ai/call?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function testRetellConnection(apiKey: string): Promise<boolean> {
  try {
    const resp = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
