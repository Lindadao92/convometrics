import { NextRequest, NextResponse } from "next/server";
import { DIMENSIONS, DimensionKey, MockConversation } from "@/lib/mockQualityData";
import { getSegmentConversations } from "@/lib/mockSegmentData";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

function avg(arr: MockConversation[], key: DimensionKey | "overall"): number | null {
  if (arr.length === 0) return null;
  return Math.round(arr.reduce((s, c) => s + c.scores[key], 0) / arr.length);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const intent  = sp.get("intent")  ?? "";
  const model   = sp.get("model")   ?? "";
  const segment = sp.get("segment") ?? "ai_assistant";
  const days    = Math.min(90, Math.max(7, parseInt(sp.get("days") ?? "30", 10)));

  // Calculate cutoff at start of day (00:00:00) for consistent timezone handling
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const cutoffMs = cutoffDate.getTime();

  const ALL_CONVOS = getSegmentConversations(segment);

  // ── Filter conversations ──────────────────────────────────────────────────
  let convos = ALL_CONVOS.filter(c => {
    try {
      return new Date(c.timestamp).getTime() >= cutoffMs;
    } catch (e) {
      console.warn('Invalid timestamp format:', c.timestamp);
      return false; // Exclude conversations with invalid timestamps
    }
  });
  if (intent) convos = convos.filter(c => c.intent === intent);
  if (model)  convos = convos.filter(c => c.model_version === model);

  const intents = [...new Set(ALL_CONVOS.map(c => c.intent))].sort();

  if (convos.length === 0) {
    return NextResponse.json({
      overallScore: null, scoreDelta: null,
      dimensions:   DIMENSIONS.map(d => ({ ...d, score: null })),
      trendData:    [], dimensionBreakdown: [],
      intents, models: ["Brainiac", "Prime", "Flash"], total: 0,
    });
  }

  // ── Overall score & trend ─────────────────────────────────────────────────
  const overallScore = avg(convos, "overall");

  const halfMs     = cutoffMs + (now - cutoffMs) / 2;
  const recentHalf = convos.filter(c => new Date(c.timestamp).getTime() >= halfMs);
  const olderHalf  = convos.filter(c => new Date(c.timestamp).getTime() <  halfMs);
  const recentAvg  = avg(recentHalf, "overall");
  const olderAvg   = avg(olderHalf,  "overall");
  const scoreDelta = recentAvg !== null && olderAvg !== null
    ? Math.round((recentAvg - olderAvg) * 10) / 10
    : null;

  // ── Per-dimension averages ────────────────────────────────────────────────
  const dimensions = DIMENSIONS.map(d => ({
    ...d,
    score: avg(convos, d.key as DimensionKey),
  }));

  // ── Daily trend (one point per day) ──────────────────────────────────────
  type DayEntry = { sums: Record<string, number>; count: number };
  const dayMap = new Map<string, DayEntry>();
  for (let i = 0; i < days; i++) {
    const d  = new Date(cutoffMs + i * 86400000);
    const k  = d.toISOString().slice(0, 10);
    const sums: Record<string, number> = { overall: 0 };
    for (const dim of DIMENSIONS) sums[dim.key] = 0;
    dayMap.set(k, { sums, count: 0 });
  }
  for (const c of convos) {
    const k = c.timestamp.slice(0, 10);
    const e = dayMap.get(k);
    if (e) {
      e.count++;
      e.sums.overall += c.scores.overall;
      for (const dim of DIMENSIONS) e.sums[dim.key] += c.scores[dim.key as DimensionKey];
    }
  }
  const trendData = [...dayMap.entries()].map(([date, { sums, count }]) => {
    const point: Record<string, string | number | null> = { date: date.slice(5) }; // MM-DD
    point.overall = count > 0 ? Math.round(sums.overall / count) : null;
    for (const dim of DIMENSIONS) {
      point[dim.key] = count > 0 ? Math.round(sums[dim.key] / count) : null;
    }
    return point;
  });

  // ── Dimension breakdown table ─────────────────────────────────────────────
  const now7ms      = now - 7  * 86400000;
  const prev7StartMs = now - 14 * 86400000;
  const last7 = convos.filter(c => new Date(c.timestamp).getTime() >= now7ms);
  const prev7 = convos.filter(c => {
    const t = new Date(c.timestamp).getTime();
    return t >= prev7StartMs && t < now7ms;
  });

  // Per-intent aggregates for best/worst
  const intentAggs: Record<string, Record<string, { sum: number; count: number }>> = {};
  for (const c of convos) {
    intentAggs[c.intent] ??= {};
    for (const dim of DIMENSIONS) {
      intentAggs[c.intent][dim.key] ??= { sum: 0, count: 0 };
      intentAggs[c.intent][dim.key].sum   += c.scores[dim.key as DimensionKey];
      intentAggs[c.intent][dim.key].count += 1;
    }
  }

  const dimensionBreakdown = DIMENSIONS.map(dim => {
    const key        = dim.key as DimensionKey;
    const currentAvg = avg(convos, key);
    const last7Avg   = last7.length > 0 ? avg(last7, key) : null;
    const prev7Avg   = prev7.length > 0 ? avg(prev7, key) : null;
    const sevenDayChange =
      last7Avg !== null && prev7Avg !== null
        ? Math.round((last7Avg - prev7Avg) * 10) / 10
        : null;

    const byIntent = Object.entries(intentAggs)
      .map(([intent, dims]) => ({
        intent,
        score: dims[key]?.count >= 3 ? Math.round(dims[key].sum / dims[key].count) : null,
      }))
      .filter((x): x is { intent: string; score: number } => x.score !== null)
      .sort((a, b) => a.score - b.score);

    const bestIntent  = byIntent.length > 0 ? formatLabel(byIntent[byIntent.length - 1].intent) : "—";
    const worstIntent = byIntent.length > 0 ? formatLabel(byIntent[0].intent) : "—";

    return {
      key: dim.key, label: dim.label, weight: dim.weight,
      currentAvg, last7Avg, sevenDayChange,
      bestIntent, worstIntent,
    };
  });

  return NextResponse.json({
    overallScore, scoreDelta,
    dimensions, trendData, dimensionBreakdown,
    intents, models: ["Brainiac", "Prime", "Flash"], total: convos.length,
  });
}
