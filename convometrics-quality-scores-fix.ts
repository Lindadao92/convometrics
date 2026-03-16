// FIX: Replace mock data with real Supabase queries
// File: /Users/linda/convometrics/dashboard/src/app/api/quality-scores/route.ts

import { NextRequest, NextResponse } from "next/server";
import { DIMENSIONS, DimensionKey, computeDimensionsFromScore } from "@/lib/mockQualityData";
import { getSupabaseServer } from "@/lib/supabase-server";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round(arr.reduce((s, score) => s + score, 0) / arr.length);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const intent  = sp.get("intent")  ?? "";
  const model   = sp.get("model")   ?? "";
  const platform = sp.get("platform") ?? "";
  const days    = Math.min(90, Math.max(7, parseInt(sp.get("days") ?? "30", 10)));

  const now      = Date.now();
  const cutoffMs = new Date(now - days * 86400000);

  const sb = getSupabaseServer();

  // ── Fetch conversations from Supabase ─────────────────────────────────────
  let query = sb
    .from("conversations")
    .select("id, intent, quality_score, completion_status, metadata, created_at")
    .not("intent", "is", null)
    .not("quality_score", "is", null)
    .gte("created_at", cutoffMs.toISOString());

  if (intent) query = query.eq("intent", intent);
  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }
  if (model && model !== "all") {
    query = query.eq("metadata->>model", model);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get unique intents and models for dropdowns
  const { data: allConvos } = await sb
    .from("conversations")
    .select("intent, metadata")
    .not("intent", "is", null);
  
  const intents = [...new Set((allConvos ?? []).map(c => c.intent))].sort();
  const models = [...new Set((allConvos ?? [])
    .map(c => (c.metadata as any)?.model)
    .filter(Boolean))].sort();

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      overallScore: null, scoreDelta: null,
      dimensions: DIMENSIONS.map(d => ({ ...d, score: null })),
      trendData: [], dimensionBreakdown: [],
      intents, models, total: 0,
    });
  }

  // ── Overall score & trend ─────────────────────────────────────────────────
  const qualityScores = rows.map(r => r.quality_score);
  const overallScore = avg(qualityScores);

  const halfMs = cutoffMs.getTime() + (now - cutoffMs.getTime()) / 2;
  const recentHalf = rows.filter(r => new Date(r.created_at).getTime() >= halfMs);
  const olderHalf = rows.filter(r => new Date(r.created_at).getTime() < halfMs);
  const recentAvg = avg(recentHalf.map(r => r.quality_score));
  const olderAvg = avg(olderHalf.map(r => r.quality_score));
  const scoreDelta = recentAvg !== null && olderAvg !== null
    ? Math.round((recentAvg - olderAvg) * 10) / 10
    : null;

  // ── Per-dimension averages using derived scores ───────────────────────────
  const allDimensions = rows.map(r => computeDimensionsFromScore(r.quality_score, r.id));
  const dimensions = DIMENSIONS.map(d => {
    const dimScores = allDimensions.map(dims => dims[d.key as DimensionKey]);
    return {
      ...d,
      score: avg(dimScores),
    };
  });

  // ── Daily trend (one point per day) ──────────────────────────────────────
  const dayMap = new Map<string, { scores: number[]; dimScores: Record<string, number[]> }>();
  
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoffMs.getTime() + i * 86400000);
    const k = d.toISOString().slice(0, 10);
    const dimScores: Record<string, number[]> = {};
    for (const dim of DIMENSIONS) dimScores[dim.key] = [];
    dayMap.set(k, { scores: [], dimScores });
  }

  for (const row of rows) {
    const k = row.created_at.slice(0, 10);
    const entry = dayMap.get(k);
    if (entry) {
      entry.scores.push(row.quality_score);
      const dims = computeDimensionsFromScore(row.quality_score, row.id);
      for (const dim of DIMENSIONS) {
        entry.dimScores[dim.key].push(dims[dim.key as DimensionKey]);
      }
    }
  }

  const trendData = [...dayMap.entries()].map(([date, { scores, dimScores }]) => {
    const point: Record<string, string | number | null> = { date: date.slice(5) }; // MM-DD
    point.overall = scores.length > 0 ? avg(scores) : null;
    for (const dim of DIMENSIONS) {
      point[dim.key] = dimScores[dim.key].length > 0 ? avg(dimScores[dim.key]) : null;
    }
    return point;
  });

  // ── Dimension breakdown table ─────────────────────────────────────────────
  const now7ms = now - 7 * 86400000;
  const prev7StartMs = now - 14 * 86400000;
  const last7 = rows.filter(r => new Date(r.created_at).getTime() >= now7ms);
  const prev7 = rows.filter(r => {
    const t = new Date(r.created_at).getTime();
    return t >= prev7StartMs && t < now7ms;
  });

  // Per-intent aggregates for best/worst
  const intentAggs: Record<string, Record<string, number[]>> = {};
  for (const row of rows) {
    intentAggs[row.intent] ??= {};
    const dims = computeDimensionsFromScore(row.quality_score, row.id);
    for (const dim of DIMENSIONS) {
      intentAggs[row.intent][dim.key] ??= [];
      intentAggs[row.intent][dim.key].push(dims[dim.key as DimensionKey]);
    }
  }

  const dimensionBreakdown = DIMENSIONS.map(dim => {
    const key = dim.key as DimensionKey;
    const allDimScores = allDimensions.map(d => d[key]);
    const currentAvg = avg(allDimScores);
    
    const last7Dims = last7.map(r => computeDimensionsFromScore(r.quality_score, r.id)[key]);
    const prev7Dims = prev7.map(r => computeDimensionsFromScore(r.quality_score, r.id)[key]);
    
    const last7Avg = avg(last7Dims);
    const prev7Avg = avg(prev7Dims);
    const sevenDayChange = last7Avg !== null && prev7Avg !== null
      ? Math.round((last7Avg - prev7Avg) * 10) / 10
      : null;

    const byIntent = Object.entries(intentAggs)
      .map(([intent, dims]) => ({
        intent,
        score: dims[key]?.length >= 3 ? avg(dims[key]) : null,
      }))
      .filter((x): x is { intent: string; score: number } => x.score !== null)
      .sort((a, b) => a.score - b.score);

    const bestIntent = byIntent.length > 0 ? formatLabel(byIntent[byIntent.length - 1].intent) : "—";
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
    intents, models: models.length > 0 ? models : ["Brainiac", "Prime", "Flash"], 
    total: rows.length,
  });
}