import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;
const LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini", grok: "Grok", perplexity: "Perplexity",
};

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2 * 10) / 10;
}

export async function GET() {
  const sb = getSupabaseServer();

  // All raw rows — metadata only
  const { data: allMeta, error: allErr } = await sb
    .from("conversations")
    .select("metadata")
    .limit(200000);
  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  // All analyzed rows
  const { data: analyzedRows, error: analyzedErr } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, metadata")
    .not("intent", "is", null)
    .limit(100000);
  if (analyzedErr) return NextResponse.json({ error: analyzedErr.message }, { status: 500 });

  // ── Raw stats per platform ────────────────────────────────────────────────────
  const rawStats: Record<string, { total: number; turns: number[] }> = {};

  for (const row of allMeta ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    const turns = meta?.turns_count as number | null;
    rawStats[platform] ??= { total: 0, turns: [] };
    rawStats[platform].total++;
    if (typeof turns === "number" && turns > 0) rawStats[platform].turns.push(turns);
  }

  // ── Analyzed stats per platform ───────────────────────────────────────────────
  const aiStats: Record<string, {
    analyzed: number;
    qualityScores: number[];
    statuses: Record<string, number>;
    intentCounts: Record<string, number>;
  }> = {};

  for (const row of analyzedRows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const platform = (meta?.platform as string) ?? "unknown";
    aiStats[platform] ??= { analyzed: 0, qualityScores: [], statuses: {}, intentCounts: {} };
    const g = aiStats[platform];
    g.analyzed++;
    if (row.quality_score !== null) g.qualityScores.push(row.quality_score);
    if (row.completion_status) g.statuses[row.completion_status] = (g.statuses[row.completion_status] || 0) + 1;
    if (row.intent) g.intentCounts[row.intent] = (g.intentCounts[row.intent] || 0) + 1;
  }

  const platforms = PLATFORMS.map((p) => {
    const raw = rawStats[p] ?? { total: 0, turns: [] };
    const ai = aiStats[p] ?? { analyzed: 0, qualityScores: [], statuses: {}, intentCounts: {} };

    const avgTurns = raw.turns.length > 0
      ? Math.round(raw.turns.reduce((a, b) => a + b, 0) / raw.turns.length * 10) / 10
      : null;
    const medianTurns = median(raw.turns);
    const pct5Plus = raw.turns.length > 0
      ? Math.round((raw.turns.filter((t) => t >= 5).length / raw.turns.length) * 1000) / 10
      : null;
    const longestTurns = raw.turns.length > 0 ? Math.max(...raw.turns) : null;

    const avgQuality = ai.qualityScores.length
      ? Math.round(ai.qualityScores.reduce((a, b) => a + b, 0) / ai.qualityScores.length)
      : null;
    const completed = ai.statuses["completed"] ?? 0;
    const failed = ai.statuses["failed"] ?? 0;
    const abandoned = ai.statuses["abandoned"] ?? 0;
    const completionRate = ai.analyzed > 0 ? Math.round((completed / ai.analyzed) * 1000) / 10 : null;
    const failureRate = ai.analyzed > 0 ? Math.round(((failed + abandoned) / ai.analyzed) * 1000) / 10 : null;
    const topIntent = Object.entries(ai.intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      platform: p,
      total: raw.total,
      analyzed: ai.analyzed,
      avgTurns,
      medianTurns,
      pct5Plus,
      longestTurns,
      avgQuality,
      completionRate,
      failureRate,
      topIntent,
      statuses: ai.statuses,
    };
  });

  // ── Auto-generate key findings ────────────────────────────────────────────────
  const withAI = platforms.filter((p) => p.avgQuality !== null);
  const keyFindings: string[] = [];

  if (withAI.length >= 2) {
    const byQuality = [...withAI].sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0));
    if (byQuality.length >= 2) {
      const best = byQuality[0];
      const worst = byQuality[byQuality.length - 1];
      const gap = Math.round((best.avgQuality ?? 0) - (worst.avgQuality ?? 0));
      keyFindings.push(`${LABELS[best.platform]} leads on quality (${best.avgQuality}/100) — ${gap} points ahead of ${LABELS[worst.platform]}.`);
    }

    const byCompletion = [...withAI].filter((p) => p.completionRate !== null)
      .sort((a, b) => (b.completionRate ?? 0) - (a.completionRate ?? 0));
    if (byCompletion.length >= 1) {
      const best = byCompletion[0];
      keyFindings.push(`${LABELS[best.platform]} users are most likely to finish conversations (${best.completionRate}% completion rate).`);
    }

    const byFailure = [...withAI].filter((p) => p.failureRate !== null)
      .sort((a, b) => (b.failureRate ?? 0) - (a.failureRate ?? 0));
    if (byFailure.length >= 1 && (byFailure[0].failureRate ?? 0) > 15) {
      const worst = byFailure[0];
      keyFindings.push(`${LABELS[worst.platform]} has the highest failure rate (${worst.failureRate}%) — a key area for improvement.`);
    }
  }

  const byTurns = [...platforms].filter((p) => p.avgTurns !== null)
    .sort((a, b) => (b.avgTurns ?? 0) - (a.avgTurns ?? 0));
  if (byTurns.length >= 2) {
    const deepest = byTurns[0];
    keyFindings.push(`${LABELS[deepest.platform]} conversations run deepest — ${deepest.avgTurns} turns on average, ${deepest.pct5Plus}% have 5+ exchanges.`);
  }

  // ── Cluster affinity per platform ─────────────────────────────────────────
  const { data: clusterRows } = await sb.from("topic_clusters").select("cluster_name, topic_labels");
  const intentToCluster: Record<string, string> = {};
  for (const cr of clusterRows ?? []) {
    for (const label of (cr.topic_labels as string[]) ?? []) {
      intentToCluster[label] = cr.cluster_name as string;
    }
  }

  const clusterStats: Record<string, Record<string, number>> = {}; // platform → {clusterName: count}
  for (const row of analyzedRows ?? []) {
    const meta = row.metadata as Record<string, unknown> | null;
    const p = (meta?.platform as string) ?? "unknown";
    const cName = row.intent ? intentToCluster[row.intent] : null;
    if (cName) {
      clusterStats[p] ??= {};
      clusterStats[p][cName] = (clusterStats[p][cName] ?? 0) + 1;
    }
  }

  const clusterAffinityByPlatform: Record<string, { clusterName: string; count: number; pct: number }[]> = {};
  for (const [p, counts] of Object.entries(clusterStats)) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    clusterAffinityByPlatform[p] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([clusterName, count]) => ({ clusterName, count, pct: Math.round((count / total) * 1000) / 10 }));
  }

  // Auto-generate cluster insight text
  const clusterInsights: string[] = [];
  for (const p of PLATFORMS) {
    const top = clusterAffinityByPlatform[p]?.[0];
    if (top && top.pct > 25) {
      clusterInsights.push(`${LABELS[p]} is most used for "${top.clusterName}" (${top.pct}% of its conversations).`);
    }
  }

  const grandTotal = platforms.reduce((s, p) => s + p.total, 0);
  const totalAnalyzed = platforms.reduce((s, p) => s + p.analyzed, 0);
  const pending = Math.max(0, grandTotal - totalAnalyzed);

  return NextResponse.json({ platforms, pending, keyFindings, clusterAffinityByPlatform, clusterInsights });
}
