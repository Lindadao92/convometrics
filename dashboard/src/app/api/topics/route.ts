import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { computeMockTopicsStats } from "@/lib/mockSegmentData";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicSummary {
  label: string; count: number; avgQuality: number | null;
  failureRate: number; completionRate: number; avgTurns: number | null;
  topPlatform: string | null; firstSeen: string | null; isEmerging: boolean;
}
interface PlatformBreakdown { platform: string; count: number; pct: number; }
interface ClusterData {
  id: string; clusterName: string; conversationCount: number;
  avgQuality: number | null; avgTurns: number | null; failureRate: number;
  platformBreakdown: PlatformBreakdown[]; topics: TopicSummary[]; color?: string | null;
}
interface EmergingTopic {
  label: string; count: number; clusterName: string | null;
  firstSeen: string; avgQuality: number | null;
}
interface UnclusteredIntent { label: string; count: number; avgQuality: number | null; failureRate: number; estRevenueImpact?: number; }
interface TopicsApiResponse {
  clusters: ClusterData[]; emergingTopics: EmergingTopic[]; unclustered: UnclusteredIntent[];
  hasClusterData: boolean; totalConversations: number; uniqueTopicsCount: number;
  topicInsights: {
    mostDiscussed: { name: string; count: number } | null;
    biggestQualityGap: { label: string; count: number; avgQuality: number } | null;
    fastestGrowing: { label: string; count: number; clusterName: string | null } | null;
    platformSpecialization: { platform: string; clusterName: string }[];
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<TopicsApiResponse | { error: string }>> {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  // Demo mode: return mock topic stats
  if (segment) {
    return NextResponse.json(computeMockTopicsStats(segment, days) as unknown as TopicsApiResponse);
  }

  const sb = getSupabaseServer();
  const platform = req.nextUrl.searchParams.get("platform");

  // 1. Fetch cluster metadata
  const { data: clusterRows, error: clusterErr } = await sb
    .from("topic_clusters")
    .select("id, cluster_name, topic_labels, conversation_count, color");
  if (clusterErr) return NextResponse.json({ error: clusterErr.message }, { status: 500 });

  const hasClusterData = (clusterRows?.length ?? 0) > 0;

  // Build cluster lookup maps
  const clusterById: Record<string, typeof clusterRows[number]> = {};
  const intentToClusterId: Record<string, string> = {};
  const intentToClusterName: Record<string, string> = {};
  for (const cr of clusterRows ?? []) {
    clusterById[cr.id] = cr;
    for (const label of (cr.topic_labels as string[]) ?? []) {
      intentToClusterId[label] = cr.id;
      intentToClusterName[label] = cr.cluster_name as string;
    }
  }

  // 2. Fetch conversations (limited to 200K for performance)
  let query = sb
    .from("conversations")
    .select("intent, quality_score, completion_status, cluster_id, created_at, metadata")
    .limit(200000);

  if (platform && platform !== "all") {
    query = query.eq("metadata->>platform", platform);
  }

  const { data: rows, error: rowsErr } = await query;
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  const totalConversations = rows?.length ?? 0;
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  // 3. Single-pass aggregation: build byIntent and byCluster simultaneously
  const byIntent: Record<string, {
    count: number; scores: number[]; failed: number; abandoned: number; completed: number;
    turnsTotal: number; turnsCount: number; earliestMs: number | null;
    clusterId: string | null; platformCounts: Record<string, number>;
  }> = {};

  const byCluster: Record<string, {
    count: number; scores: number[]; failed: number; abandoned: number;
    turnsTotal: number; turnsCount: number; platformCounts: Record<string, number>;
  }> = {};

  for (const row of rows ?? []) {
    const label = row.intent as string | null;
    const clusterId = (row.cluster_id as string | null) ?? (label ? intentToClusterId[label] ?? null : null);
    const meta = row.metadata as Record<string, unknown> | null;
    const p = (meta?.platform as string) ?? "unknown";
    const turns = meta?.turns_count as number | null;
    const createdMs = row.created_at ? new Date(row.created_at as string).getTime() : null;

    // Per-intent tracking
    if (label) {
      byIntent[label] ??= { count: 0, scores: [], failed: 0, abandoned: 0, completed: 0, turnsTotal: 0, turnsCount: 0, earliestMs: null, clusterId, platformCounts: {} };
      const g = byIntent[label];
      g.count++;
      if (row.quality_score !== null) g.scores.push(row.quality_score as number);
      if (row.completion_status === "failed") g.failed++;
      if (row.completion_status === "abandoned") g.abandoned++;
      if (row.completion_status === "completed") g.completed++;
      if (typeof turns === "number" && turns > 0) { g.turnsTotal += turns; g.turnsCount++; }
      if (createdMs !== null && (g.earliestMs === null || createdMs < g.earliestMs)) g.earliestMs = createdMs;
      g.platformCounts[p] = (g.platformCounts[p] ?? 0) + 1;
    }

    // Per-cluster tracking
    if (clusterId) {
      byCluster[clusterId] ??= { count: 0, scores: [], failed: 0, abandoned: 0, turnsTotal: 0, turnsCount: 0, platformCounts: {} };
      const cg = byCluster[clusterId];
      cg.count++;
      if (row.quality_score !== null) cg.scores.push(row.quality_score as number);
      if (row.completion_status === "failed") cg.failed++;
      if (row.completion_status === "abandoned") cg.abandoned++;
      if (typeof turns === "number" && turns > 0) { cg.turnsTotal += turns; cg.turnsCount++; }
      cg.platformCounts[p] = (cg.platformCounts[p] ?? 0) + 1;
    }
  }

  // 4. Build cluster summaries
  const clusters: ClusterData[] = (clusterRows ?? []).map((cr) => {
    const cg = byCluster[cr.id] ?? { count: 0, scores: [], failed: 0, abandoned: 0, turnsTotal: 0, turnsCount: 0, platformCounts: {} };
    const totalP = Object.values(cg.platformCounts).reduce((a, b) => a + b, 0) || 1;

    // Topics inside this cluster
    const topics: TopicSummary[] = (cr.topic_labels as string[] ?? []).flatMap((label): TopicSummary[] => {
      const ig = byIntent[label];
      if (!ig) return [];
      const isEmerging = ig.earliestMs !== null && ig.earliestMs >= fourteenDaysAgo;
      const topPlatform = Object.entries(ig.platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return [{
        label, count: ig.count,
        avgQuality: ig.scores.length ? Math.round(ig.scores.reduce((a, b) => a + b, 0) / ig.scores.length) : null,
        failureRate: ig.count > 0 ? Math.round(((ig.failed + ig.abandoned) / ig.count) * 1000) / 10 : 0,
        completionRate: ig.count > 0 ? Math.round((ig.completed / ig.count) * 1000) / 10 : 0,
        avgTurns: ig.turnsCount > 0 ? Math.round((ig.turnsTotal / ig.turnsCount) * 10) / 10 : null,
        topPlatform, firstSeen: ig.earliestMs ? new Date(ig.earliestMs).toISOString() : null, isEmerging,
      }];
    }).sort((a, b) => b.count - a.count);

    return {
      id: cr.id as string,
      clusterName: cr.cluster_name as string,
      conversationCount: cg.count,
      avgQuality: cg.scores.length ? Math.round(cg.scores.reduce((a, b) => a + b, 0) / cg.scores.length) : null,
      avgTurns: cg.turnsCount > 0 ? Math.round((cg.turnsTotal / cg.turnsCount) * 10) / 10 : null,
      failureRate: cg.count > 0 ? Math.round(((cg.failed + cg.abandoned) / cg.count) * 1000) / 10 : 0,
      platformBreakdown: Object.entries(cg.platformCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([platform, count]) => ({ platform, count, pct: Math.round((count / totalP) * 1000) / 10 })),
      topics,
      color: cr.color as string | null,
    };
  }).sort((a, b) => b.conversationCount - a.conversationCount);

  // 5. Emerging topics (last 14 days, across all intents)
  const emergingTopics: EmergingTopic[] = Object.entries(byIntent)
    .filter(([, g]) => g.earliestMs !== null && g.earliestMs >= fourteenDaysAgo)
    .map(([label, g]) => ({
      label,
      count: g.count,
      clusterName: g.clusterId ? (clusterById[g.clusterId]?.cluster_name as string ?? null) : (intentToClusterName[label] ?? null),
      firstSeen: new Date(g.earliestMs!).toISOString(),
      avgQuality: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
    }))
    .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime())
    .slice(0, 20);

  // 6. Unclustered intents (no cluster assignment)
  const unclustered: UnclusteredIntent[] = Object.entries(byIntent)
    .filter(([label, g]) => !g.clusterId && !intentToClusterId[label])
    .map(([label, g]) => {
      const failureRate = g.count > 0 ? Math.round(((g.failed + g.abandoned) / g.count) * 1000) / 10 : 0;
      return {
        label,
        count: g.count,
        avgQuality: g.scores.length ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : null,
        failureRate,
        estRevenueImpact: g.count > 0 ? Math.round(g.count * 4.3 * (failureRate / 100) * 0.10 * 180) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  // 7. Topic insights for the insights section
  const allIntents = Object.entries(byIntent);
  const mostDiscussed = clusters[0] ?? null;

  // Biggest quality gap: high count but lowest quality
  const qualityGapCandidate = allIntents
    .filter(([, g]) => g.count >= 20 && g.scores.length > 0)
    .map(([label, g]) => ({
      label,
      count: g.count,
      avgQuality: Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length),
    }))
    .sort((a, b) => b.count - a.count)
    .filter((x) => x.avgQuality < 50)[0] ?? null;

  const fastestGrowing = emergingTopics[0] ?? null;

  // Platform specialization: which platform dominates each cluster (only for top 5 clusters)
  const platformSpecialization: { platform: string; clusterName: string }[] = [];
  for (const cluster of clusters.slice(0, 5)) {
    if (cluster.platformBreakdown.length > 0) {
      const top = cluster.platformBreakdown[0];
      if (top.pct > 30) {
        platformSpecialization.push({ platform: top.platform, clusterName: cluster.clusterName });
      }
    }
  }

  const topicInsights = {
    mostDiscussed: mostDiscussed ? { name: mostDiscussed.clusterName, count: mostDiscussed.conversationCount } : null,
    biggestQualityGap: qualityGapCandidate,
    fastestGrowing: fastestGrowing ? { label: fastestGrowing.label, count: fastestGrowing.count, clusterName: fastestGrowing.clusterName } : null,
    platformSpecialization: platformSpecialization.slice(0, 3),
  };

  // Count unique topics
  const uniqueTopicsCount = allIntents.length;

  return NextResponse.json({ clusters, emergingTopics, unclustered, hasClusterData, totalConversations, topicInsights, uniqueTopicsCount });
}
