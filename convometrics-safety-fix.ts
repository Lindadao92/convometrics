// FIX: Replace mock data with real Supabase queries
// File: /Users/linda/convometrics/dashboard/src/app/api/safety/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { computeDimensionsFromScore } from "@/lib/mockQualityData";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  const sb = getSupabaseServer();
  const cutoff = new Date(Date.now() - days * 86400000);

  // Fetch conversations from Supabase
  let query = sb
    .from("conversations")
    .select("id, intent, quality_score, completion_status, metadata, created_at")
    .not("intent", "is", null)
    .not("quality_score", "is", null)
    .gte("created_at", cutoff.toISOString());

  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      overallSafety: null,
      trendData: [],
      violations: [],
      riskDistribution: { high: 0, medium: 0, low: 0, safe: 0 },
      total: 0
    });
  }

  // Compute safety scores from quality scores
  const safetyScores = rows.map(row => {
    const dimensions = computeDimensionsFromScore(row.quality_score, row.id);
    return {
      ...row,
      safety_score: dimensions.safety
    };
  });

  // Overall safety average
  const overallSafety = Math.round(
    safetyScores.reduce((sum, conv) => sum + conv.safety_score, 0) / safetyScores.length
  );

  // Risk distribution based on safety scores
  const riskDistribution = safetyScores.reduce((acc, conv) => {
    if (conv.safety_score >= 85) acc.safe++;
    else if (conv.safety_score >= 70) acc.low++;
    else if (conv.safety_score >= 50) acc.medium++;
    else acc.high++;
    return acc;
  }, { high: 0, medium: 0, low: 0, safe: 0 });

  // Safety violations (low safety scores with examples)
  const violations = safetyScores
    .filter(conv => conv.safety_score < 60)
    .slice(0, 10)
    .map(conv => ({
      id: conv.id,
      intent: conv.intent,
      safety_score: conv.safety_score,
      risk_level: conv.safety_score < 30 ? "high" : conv.safety_score < 50 ? "medium" : "low",
      platform: ((conv.metadata as any)?.platform) ?? "unknown"
    }));

  // Daily trend (last 30 days or specified days)
  const dailyMap = new Map<string, number[]>();
  const actualDays = Math.min(days, 30);
  
  for (let i = 0; i < actualDays; i++) {
    const date = new Date(Date.now() - i * 86400000);
    const dateKey = date.toISOString().slice(0, 10);
    dailyMap.set(dateKey, []);
  }

  for (const conv of safetyScores) {
    const dateKey = conv.created_at.slice(0, 10);
    const scores = dailyMap.get(dateKey);
    if (scores) {
      scores.push(conv.safety_score);
    }
  }

  const trendData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => ({
      date: date.slice(5), // MM-DD format
      safety: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b) / scores.length) : null
    }));

  return NextResponse.json({
    overallSafety,
    trendData,
    violations,
    riskDistribution,
    total: rows.length
  });
}