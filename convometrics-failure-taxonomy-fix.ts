// FIX: Replace mock data with real Supabase queries
// File: /Users/linda/convometrics/dashboard/src/app/api/failure-taxonomy/route.ts

import { NextRequest, NextResponse } from "next/server";
import { FailureType, FAILURE_TYPES, computeFailuresFromScore } from "@/lib/mockQualityData";
import { getSupabaseServer } from "@/lib/supabase-server";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

// 4 weekly buckets (most recent last)
const WEEK_LABELS = ["4w ago", "3w ago", "Last week", "This week"];

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams;
  const intent  = sp.get("intent")  ?? "";
  const platform = sp.get("platform") ?? "";
  const days    = Math.min(90, Math.max(7, parseInt(sp.get("days") ?? "30", 10)));

  const sb = getSupabaseServer();
  const now = Date.now();
  const cutoffMs = new Date(now - days * 86400000);

  // Fetch conversations from Supabase
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

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      total: 0,
      failures: [],
      weeklyBreakdown: WEEK_LABELS.map(label => ({ label, data: [] })),
      intents: [],
    });
  }

  // Derive failure tags from quality scores
  const enrichedConvos = rows.map(row => ({
    ...row,
    failure_tags: computeFailuresFromScore(row.quality_score, row.id),
    timestamp: row.created_at
  }));

  // Filter for failed conversations only  
  const failedConvos = enrichedConvos.filter(c => c.failure_tags.length > 0);

  // ── Failure type frequency ─────────────────────────────────────────────────
  const failureMap = new Map<FailureType, { count: number; examples: string[] }>();
  
  for (const type of FAILURE_TYPES) {
    failureMap.set(type.key, { count: 0, examples: [] });
  }

  for (const conv of failedConvos) {
    for (const tag of conv.failure_tags) {
      const entry = failureMap.get(tag.type);
      if (entry) {
        entry.count++;
        if (entry.examples.length < 3) {
          entry.examples.push(tag.detail);
        }
      }
    }
  }

  const failures = Array.from(failureMap.entries())
    .map(([type, data]) => {
      const meta = FAILURE_TYPES.find(f => f.key === type);
      return {
        type,
        label: meta?.label ?? type,
        icon: meta?.icon ?? "❓",
        description: meta?.description ?? "",
        color: meta?.color ?? "#6b7280",
        count: data.count,
        pct: failedConvos.length > 0 ? Math.round((data.count / failedConvos.length) * 1000) / 10 : 0,
        examples: data.examples,
      };
    })
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count);

  // ── Weekly breakdown ──────────────────────────────────────────────────────
  const weekMs = 7 * 86400000;
  const weekBuckets = WEEK_LABELS.map((label, i) => {
    const weekStart = now - (4 - i) * weekMs;
    const weekEnd = now - (3 - i) * weekMs;
    
    const weekConvos = failedConvos.filter(c => {
      const t = new Date(c.timestamp).getTime();
      return t >= weekStart && t < weekEnd;
    });

    const weekMap = new Map<FailureType, number>();
    for (const type of FAILURE_TYPES) {
      weekMap.set(type.key, 0);
    }

    for (const conv of weekConvos) {
      for (const tag of conv.failure_tags) {
        weekMap.set(tag.type, (weekMap.get(tag.type) || 0) + 1);
      }
    }

    const data = Array.from(weekMap.entries())
      .map(([type, count]) => ({ type, count }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    return { label, data };
  });

  // Get unique intents
  const { data: allConvos } = await sb
    .from("conversations")
    .select("intent")
    .not("intent", "is", null);
  const intents = [...new Set((allConvos ?? []).map(c => c.intent))].sort();

  return NextResponse.json({
    total: failedConvos.length,
    failures,
    weeklyBreakdown: weekBuckets,
    intents,
  });
}