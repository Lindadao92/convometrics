import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_WEEK = 7 * 864e5;

interface Message {
  role: string;
  content: string;
}

export async function GET() {
  const sb = getSupabaseServer();

  const { data: rows, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, created_at, messages, user_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const t7  = now - MS_WEEK;

  // Group by intent
  const byIntent: Record<string, {
    count: number;
    scores: number[];
    buckets: [number, number, number, number];
    statuses: Record<string, number>;
    countThisWeek: number;
    failedThisWeek: number;
    recentFailed: Array<{
      created_at: string;
      quality_score: number | null;
      completion_status: string | null;
      messages: Message[];
    }>;
  }> = {};

  for (const row of rows) {
    const intent = row.intent;
    if (!intent) continue;

    byIntent[intent] ??= {
      count: 0,
      scores: [],
      buckets: [0, 0, 0, 0],
      statuses: {},
      countThisWeek: 0,
      failedThisWeek: 0,
      recentFailed: [],
    };
    const g = byIntent[intent];
    g.count++;

    const ts = new Date(row.created_at).getTime();
    if (ts >= t7) {
      g.countThisWeek++;
      if (row.completion_status === "failed" || row.completion_status === "abandoned") {
        g.failedThisWeek++;
      }
    }

    if (row.quality_score !== null) {
      g.scores.push(row.quality_score);
      if      (row.quality_score <= 25) g.buckets[0]++;
      else if (row.quality_score <= 50) g.buckets[1]++;
      else if (row.quality_score <= 75) g.buckets[2]++;
      else                              g.buckets[3]++;
    }

    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;

    if (s === "failed" || s === "abandoned") {
      g.recentFailed.push({
        created_at:        row.created_at,
        quality_score:     row.quality_score,
        completion_status: row.completion_status,
        messages:          row.messages ?? [],
      });
    }
  }

  const intents = Object.entries(byIntent)
    .map(([intent, g]) => {
      const avgScore = g.scores.length
        ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length)
        : null;
      const completed      = g.statuses["completed"]  || 0;
      const failed         = g.statuses["failed"]      || 0;
      const abandoned      = g.statuses["abandoned"]   || 0;
      const completionRate = g.count ? Math.round((completed    / g.count) * 100) : 0;
      const failureRate    = g.count ? Math.round(((failed + abandoned) / g.count) * 100) : 0;

      // 3 most recent failed/abandoned — sorted desc
      const sampleFailed = g.recentFailed
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map((r) => {
          const userMsg = r.messages.find((m) => m.role === "user");
          return {
            preview:           userMsg ? userMsg.content.slice(0, 110) : "",
            quality_score:     r.quality_score,
            completion_status: r.completion_status,
            created_at:        r.created_at,
          };
        });

      return {
        intent,
        count: g.count,
        countThisWeek: g.countThisWeek,
        failedThisWeek: g.failedThisWeek,
        avgScore,
        completionRate,
        failureRate,
        buckets: g.buckets,
        sampleFailed,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Max bucket value for heatmap normalisation (kept for backward compat)
  let maxBucket = 1;
  for (const i of intents) {
    for (const b of i.buckets) {
      if (b > maxBucket) maxBucket = b;
    }
  }

  return NextResponse.json({ intents, maxBucket });
}
