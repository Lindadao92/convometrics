import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const platform = req.nextUrl.searchParams.get("platform");

  // Fetch lightweight analyzed rows (no messages)
  let query = sb
    .from("conversations")
    .select("id, intent, quality_score, completion_status, metadata, created_at")
    .not("intent", "is", null)
    .limit(100000);

  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by intent
  const byIntent: Record<string, {
    count: number;
    scores: number[];
    buckets: [number, number, number, number];
    statuses: Record<string, number>;
    sampleFailedIds: string[];
    platforms: Record<string, number>;
  }> = {};

  for (const row of rows ?? []) {
    const intent = row.intent!;
    byIntent[intent] ??= { count: 0, scores: [], buckets: [0, 0, 0, 0], statuses: {}, sampleFailedIds: [], platforms: {} };
    const g = byIntent[intent];
    g.count++;

    const meta = row.metadata as Record<string, unknown> | null;
    const p = (meta?.platform as string) ?? "unknown";
    g.platforms[p] = (g.platforms[p] || 0) + 1;

    if (row.quality_score !== null) {
      g.scores.push(row.quality_score);
      if      (row.quality_score <= 25) g.buckets[0]++;
      else if (row.quality_score <= 50) g.buckets[1]++;
      else if (row.quality_score <= 75) g.buckets[2]++;
      else                              g.buckets[3]++;
    }

    const s = row.completion_status;
    if (s) g.statuses[s] = (g.statuses[s] || 0) + 1;

    if ((s === "failed" || s === "abandoned") && g.sampleFailedIds.length < 3) {
      g.sampleFailedIds.push(row.id);
    }
  }

  // Fetch messages for sample failed conversations
  const allSampleIds = Object.values(byIntent).flatMap((g) => g.sampleFailedIds);
  let sampleMessages: Record<string, { role: string; content: string }[]> = {};
  if (allSampleIds.length > 0) {
    const { data: msgRows } = await sb
      .from("conversations")
      .select("id, messages")
      .in("id", allSampleIds);
    for (const r of msgRows ?? []) {
      sampleMessages[r.id] = r.messages ?? [];
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

      const sampleFailed = g.sampleFailedIds.map((id) => {
        const msgs = sampleMessages[id] ?? [];
        const userMsg = msgs.find((m) => m.role === "user");
        return { preview: userMsg ? userMsg.content.slice(0, 120) : "", id };
      });

      const topPlatform = Object.entries(g.platforms).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return { intent, count: g.count, avgScore, completionRate, failureRate, buckets: g.buckets, sampleFailed, topPlatform };
    })
    .sort((a, b) => b.count - a.count);

  let maxBucket = 1;
  for (const i of intents) for (const b of i.buckets) if (b > maxBucket) maxBucket = b;

  return NextResponse.json({ intents, maxBucket });
}
