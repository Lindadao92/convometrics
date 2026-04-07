import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.orgId;

  const totalResult = await sql`
    SELECT count(*) as total FROM calls WHERE org_id = ${orgId}::uuid
  `;
  const doneResult = await sql`
    SELECT count(*) as done FROM calls WHERE org_id = ${orgId}::uuid AND analysis_status = 'done'
  `;
  const failedResult = await sql`
    SELECT count(*) as failed FROM calls WHERE org_id = ${orgId}::uuid AND analysis_status = 'failed'
  `;
  const pendingResult = await sql`
    SELECT count(*) as pending FROM calls WHERE org_id = ${orgId}::uuid AND analysis_status = 'pending'
  `;

  const total = parseInt(totalResult.rows[0].total);
  const done = parseInt(doneResult.rows[0].done);
  const failed = parseInt(failedResult.rows[0].failed);
  const pending = parseInt(pendingResult.rows[0].pending);
  const processed = done + failed;

  return NextResponse.json({
    total,
    done,
    failed,
    pending,
    percent: total > 0 ? Math.round((processed / total) * 100) : 0,
    complete: pending === 0 && total > 0,
  });
}
