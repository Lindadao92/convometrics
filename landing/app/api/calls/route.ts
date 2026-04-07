import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.orgId;
  const filter = req.nextUrl.searchParams.get("filter") || "all";
  const search = req.nextUrl.searchParams.get("search") || "";
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const perPage = 20;
  const offset = (page - 1) * perPage;

  // Build query based on filters
  let calls;
  let countResult;

  if (filter === "flagged") {
    if (search) {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid AND array_length(flags, 1) > 0
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid AND array_length(flags, 1) > 0
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
      `;
    } else {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid AND array_length(flags, 1) > 0
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid AND array_length(flags, 1) > 0
      `;
    }
  } else if (filter !== "all") {
    if (search) {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid AND outcome = ${filter}
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid AND outcome = ${filter}
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
      `;
    } else {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid AND outcome = ${filter}
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid AND outcome = ${filter}
      `;
    }
  } else {
    if (search) {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid
          AND (intent ILIKE ${'%' + search + '%'} OR external_call_id ILIKE ${'%' + search + '%'})
      `;
    } else {
      calls = await sql`
        SELECT * FROM calls WHERE org_id = ${orgId}::uuid
        ORDER BY started_at DESC NULLS LAST LIMIT ${perPage} OFFSET ${offset}
      `;
      countResult = await sql`
        SELECT count(*) FROM calls WHERE org_id = ${orgId}::uuid
      `;
    }
  }

  const total = parseInt(countResult.rows[0]?.count || "0");

  return NextResponse.json({
    calls: calls.rows.map((c) => ({
      id: c.id,
      call_id: c.external_call_id,
      platform: c.platform,
      intent: c.intent,
      outcome: c.outcome,
      flags: c.flags || [],
      sentiment: c.sentiment_score,
      duration: c.duration_seconds,
      started_at: c.started_at,
      analysis: c.ai_analysis,
      analysis_status: c.analysis_status,
      transcript: c.transcript,
    })),
    total,
    page,
    per_page: perPage,
  });
}
