import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const result = await sql`
    SELECT * FROM calls WHERE id = ${id}::uuid AND org_id = ${session.orgId}::uuid LIMIT 1
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  const c = result.rows[0];
  return NextResponse.json({
    id: c.id,
    call_id: c.external_call_id,
    platform: c.platform,
    intent: c.intent,
    outcome: c.outcome,
    outcome_confidence: c.outcome_confidence,
    flags: c.flags || [],
    sentiment: c.sentiment_score,
    duration: c.duration_seconds,
    started_at: c.started_at,
    ended_at: c.ended_at,
    analysis: c.ai_analysis,
    analysis_status: c.analysis_status,
    transcript: c.transcript,
    caller_phone: c.caller_phone,
  });
}
