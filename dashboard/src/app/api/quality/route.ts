import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabaseServer();

  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by intent
  const byIntent: Record<
    string,
    {
      count: number;
      scores: number[];
      buckets: [number, number, number, number]; // 0-25, 26-50, 51-75, 76-100
      statuses: Record<string, number>;
    }
  > = {};

  for (const row of rows) {
    const intent = row.intent;
    if (!intent) continue;

    if (!byIntent[intent]) {
      byIntent[intent] = { count: 0, scores: [], buckets: [0, 0, 0, 0], statuses: {} };
    }
    const g = byIntent[intent];
    g.count++;

    if (row.quality_score !== null) {
      g.scores.push(row.quality_score);
      if (row.quality_score <= 25) g.buckets[0]++;
      else if (row.quality_score <= 50) g.buckets[1]++;
      else if (row.quality_score <= 75) g.buckets[2]++;
      else g.buckets[3]++;
    }

    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;
  }

  const intents = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgScore =
        g.scores.length > 0
          ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
          : null;
      const completionRate =
        g.count > 0
          ? Math.round(((g.statuses["completed"] || 0) / g.count) * 100)
          : 0;

      return {
        intent,
        count: g.count,
        avgScore,
        completionRate,
        buckets: g.buckets,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Find max bucket value for heatmap normalization
  let maxBucket = 1;
  for (const i of intents) {
    for (const b of i.buckets) {
      if (b > maxBucket) maxBucket = b;
    }
  }

  return NextResponse.json({ intents, maxBucket });
}
