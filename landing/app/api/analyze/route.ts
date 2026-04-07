import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { analyzeCall } from "@/lib/analyze-call";

export const maxDuration = 60;

async function runAnalysis() {
  // Atomically claim pending calls so concurrent runs don't overlap
  const result = await sql`
    UPDATE calls SET analysis_status = 'analyzing'
    WHERE id IN (
      SELECT id FROM calls WHERE analysis_status = 'pending' ORDER BY created_at ASC LIMIT 20
    )
    RETURNING id
  `;

  if (result.rows.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending calls" });
  }

  let processed = 0;
  let failed = 0;

  for (const row of result.rows) {
    try {
      await analyzeCall(row.id);
      processed++;
    } catch (err) {
      console.error(`[analyze] Failed for ${row.id}:`, err);
      // Reset to pending so it can be retried
      await sql`UPDATE calls SET analysis_status = 'pending' WHERE id = ${row.id}::uuid AND analysis_status = 'analyzing'`;
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, total: result.rows.length });
}

export async function POST() {
  return runAnalysis();
}

export async function GET() {
  return runAnalysis();
}
