import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations } from "@/lib/mockSegmentData";
import {
  DIMENSIONS,
  computeDimensionsFromScore,
  FAILURE_TYPES,
  computeFailuresFromScore,
  computeSatisfactionFromScore,
} from "@/lib/mockQualityData";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

// ── Types ────────────────────────────────────────────────────────────────────

interface DimensionAvg {
  key: string;
  label: string;
  avg: number;
}

interface SentimentBreakdown {
  satisfied: number;
  neutral: number;
  frustrated: number;
  abandoned: number;
}

interface FailureEntry {
  type: string;
  label: string;
  count: number;
}

interface SampleConversation {
  id: string;
  timestamp: string;
  turns: number;
  quality: number;
  satisfaction: string;
  failureTags: string[];
  firstMessage: string;
}

interface IntentDetailResponse {
  name: string;
  slug: string;
  totalConversations: number;
  resolutionRate: number;
  avgTurns: number;
  avgQuality: number;
  dimensions: DimensionAvg[];
  sentimentBreakdown: SentimentBreakdown;
  topFailures: FailureEntry[];
  sampleConversations: SampleConversation[];
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse<IntentDetailResponse | { error: string }>> {
  const { slug } = await params;
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  // Get conversations for this segment
  let convos = getSegmentConversations(segment);

  // Filter by time range with consistent timezone handling
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const cutoff = cutoffDate.getTime();
  
  convos = convos.filter((c) => {
    try {
      return new Date(c.timestamp).getTime() >= cutoff;
    } catch (e) {
      console.warn('Invalid timestamp format:', c.timestamp);
      return false; // Exclude conversations with invalid timestamps
    }
  });

  // Filter by intent matching slug
  const intentConvos = convos.filter((c) => c.intent === slug);

  if (intentConvos.length === 0) {
    return NextResponse.json(
      { error: `No conversations found for intent "${slug}"` },
      { status: 404 },
    );
  }

  // ── Compute aggregates ───────────────────────────────────────────────────

  const totalConversations = intentConvos.length;

  // Resolution rate: satisfied or neutral = resolved — consistent with Overview/Topics
  const resolved = intentConvos.filter(
    (c) => c.inferred_satisfaction === "satisfied" || c.inferred_satisfaction === "neutral",
  ).length;
  const resolutionRate = Math.round((resolved / totalConversations) * 100);

  // Average turns
  const totalTurns = intentConvos.reduce((sum, c) => sum + c.turns, 0);
  const avgTurns = Math.round((totalTurns / totalConversations) * 10) / 10;

  // Average quality
  const totalQuality = intentConvos.reduce((sum, c) => sum + c.scores.overall, 0);
  const avgQuality = Math.round(totalQuality / totalConversations);

  // ── Dimension averages ─────────────────────────────────────────────────

  const dimSums: Record<string, number> = {};
  for (const dim of DIMENSIONS) {
    dimSums[dim.key] = 0;
  }

  for (const c of intentConvos) {
    for (const dim of DIMENSIONS) {
      dimSums[dim.key] += c.scores[dim.key as keyof typeof c.scores] ?? 0;
    }
  }

  const dimensions: DimensionAvg[] = DIMENSIONS.map((dim) => ({
    key: dim.key,
    label: dim.label,
    avg: Math.round(dimSums[dim.key] / totalConversations),
  }));

  // ── Sentiment breakdown ────────────────────────────────────────────────

  const sentimentBreakdown: SentimentBreakdown = {
    satisfied: 0,
    neutral: 0,
    frustrated: 0,
    abandoned: 0,
  };

  for (const c of intentConvos) {
    sentimentBreakdown[c.inferred_satisfaction]++;
  }

  // ── Top failures ───────────────────────────────────────────────────────

  const failureCounts: Record<string, number> = {};
  for (const c of intentConvos) {
    for (const tag of c.failure_tags) {
      failureCounts[tag.type] = (failureCounts[tag.type] ?? 0) + 1;
    }
  }

  const failureMeta = Object.fromEntries(
    FAILURE_TYPES.map((ft) => [ft.key, ft.label]),
  );

  const topFailures: FailureEntry[] = Object.entries(failureCounts)
    .map(([type, count]) => ({
      type,
      label: failureMeta[type] ?? formatLabel(type),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ── Sample conversations ───────────────────────────────────────────────

  // Take up to 10 conversations, sorted by recency
  const sorted = [...intentConvos].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const sampleConversations: SampleConversation[] = sorted
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      turns: c.turns,
      quality: c.scores.overall,
      satisfaction: c.inferred_satisfaction,
      failureTags: c.failure_tags.map((ft) => ft.type),
      firstMessage: `User asked about ${formatLabel(c.intent)}`,
    }));

  // ── Response ───────────────────────────────────────────────────────────

  return NextResponse.json({
    name: formatLabel(slug),
    slug,
    totalConversations,
    resolutionRate,
    avgTurns,
    avgQuality,
    dimensions,
    sentimentBreakdown,
    topFailures,
    sampleConversations,
  });
}
