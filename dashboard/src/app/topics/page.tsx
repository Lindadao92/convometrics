"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Treemap, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import { FAILURE_TYPES } from "@/lib/mockQualityData";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};

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
interface UnclusteredIntent { label: string; count: number; avgQuality: number | null; failureRate: number; }
interface TopicInsights {
  mostDiscussed: { name: string; count: number } | null;
  biggestQualityGap: { label: string; count: number; avgQuality: number } | null;
  fastestGrowing: { label: string; count: number; clusterName: string | null } | null;
  platformSpecialization: { platform: string; clusterName: string }[];
}
interface ApiData {
  clusters: ClusterData[];
  emergingTopics: EmergingTopic[];
  unclustered: UnclusteredIntent[];
  hasClusterData: boolean;
  totalConversations: number;
  uniqueTopicsCount: number;
  topicInsights: TopicInsights;
}

// ─── Failure Taxonomy Types ───────────────────────────────────────────────────

interface FailureFreqItem { key: string; label: string; icon: string; color: string; count: number; pct: number; }
interface FailureExample  { convId: string; intent: string; turn: number; detail: string; }
interface FailureTaxonomyData {
  frequencyData: FailureFreqItem[];
  weeklyTrend:   Record<string, number | string>[];
  intentCrossTab: { intent: string; label: string; total: number; [key: string]: number | string }[];
  examples:       Record<string, FailureExample[]>;
  totalFailed:    number;
  totalConversations: number;
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }

function qualityColor(q: number | null): string {
  if (q === null) return "#3f3f46";
  if (q >= 75) return "#22c55e";
  if (q >= 60) return "#84cc16";
  if (q >= 45) return "#eab308";
  if (q >= 30) return "#f97316";
  return "#ef4444";
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-64" />
      <Bone className="h-[360px] rounded-xl" />
      <Bone className="h-12 rounded-xl" />
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Treemap cell ─────────────────────────────────────────────────────────────

interface TreemapItem { name: string; size: number; quality: number | null; isCluster: boolean; clusterId?: string; [key: string]: unknown; }

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", quality, onClick, isCluster }: {
  x?: number; y?: number; width?: number; height?: number; name?: string;
  quality?: number | null; onClick?: () => void; isCluster?: boolean;
}) {
  const color = qualityColor(quality ?? null);
  const showText = width > 40 && height > 24;
  const showSub = width > 80 && height > 44;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        rx={4} fill={color} fillOpacity={0.18} stroke={color} strokeOpacity={0.4} strokeWidth={1} />
      {showText && (
        <text x={x + width / 2} y={y + height / 2 - (showSub ? 7 : 0)}
          textAnchor="middle" fill="white" fontSize={Math.min(12, width / 8)} style={{ pointerEvents: "none" }}>
          {name.length > 20 && width < 120 ? name.slice(0, 18) + "…" : name}
        </text>
      )}
      {showSub && quality !== null && quality !== undefined && (
        <text x={x + width / 2} y={y + height / 2 + 10}
          textAnchor="middle" fill={color} fontSize={10} style={{ pointerEvents: "none" }}>
          {quality}/100
        </text>
      )}
      {isCluster && showText && height > 50 && (
        <text x={x + width / 2} y={y + height / 2 + (showSub ? 24 : 12)}
          textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} style={{ pointerEvents: "none" }}>
          click to explore
        </text>
      )}
    </g>
  );
}

type SortKey = "count" | "avgQuality" | "completionRate" | "failureRate" | "avgTurns";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Topics() {
  const { selectedPlatform, profile } = useProductProfile();
  const { segment } = useDemoMode();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tableSearch, setTableSearch] = useState("");
  const [localPlatform, setLocalPlatform] = useState("all");

  // Failure taxonomy
  const [failureData, setFailureData] = useState<FailureTaxonomyData | null>(null);
  const [failureLoading, setFailureLoading] = useState(true);
  const [expandedFailure, setExpandedFailure] = useState<string | null>(null);

  const effectivePlatform = selectedPlatform !== "all" ? selectedPlatform : localPlatform;

  useEffect(() => {
    setLoading(true);
    setSelectedCluster(null);
    const params = new URLSearchParams();
    if (segment) params.set("segment", segment);
    else if (effectivePlatform !== "all") params.set("platform", effectivePlatform);
    const url = `/api/topics${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [effectivePlatform, segment]);

  useEffect(() => {
    setFailureLoading(true);
    const sp = segment ? `&segment=${segment}` : "";
    fetch(`/api/failure-taxonomy?days=30${sp}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setFailureData(d))
      .finally(() => setFailureLoading(false));
  }, [segment]);

  // Flat list of all topic rows for the breakdown table
  const allTopicRows = useMemo(() => {
    if (!data) return [];
    const rows: (TopicSummary & { clusterName: string })[] = [];
    for (const cluster of data.clusters) {
      for (const topic of cluster.topics) {
        rows.push({ ...topic, clusterName: cluster.clusterName });
      }
    }
    // Add unclustered
    for (const unc of data.unclustered) {
      rows.push({
        label: unc.label, count: unc.count, avgQuality: unc.avgQuality,
        failureRate: unc.failureRate, completionRate: 0, avgTurns: null,
        topPlatform: null, firstSeen: null, isEmerging: false,
        clusterName: "Unclustered",
      });
    }
    return rows;
  }, [data]);

  const sortedFilteredRows = useMemo(() => {
    let rows = allTopicRows;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      rows = rows.filter((r) => r.label.toLowerCase().includes(q) || r.clusterName.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [allTopicRows, tableSearch, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th onClick={() => handleSort(k)}
        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">
        {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </th>
    );
  }

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load</p><p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const activeClusters = data.clusters.filter((c) => c.conversationCount > 0);
  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  // Treemap data
  const treemapData: TreemapItem[] = selectedCluster === null
    ? activeClusters.map((c) => ({ name: c.clusterName, size: c.conversationCount, quality: c.avgQuality, clusterId: c.id, isCluster: true }))
    : (() => {
        const cluster = data.clusters.find((c) => c.id === selectedCluster || c.clusterName === selectedCluster);
        return (cluster?.topics ?? []).map((t): TreemapItem => ({ name: t.label, size: t.count, quality: t.avgQuality, isCluster: false }));
      })();

  const hasNoData = !data.hasClusterData && data.unclustered.length === 0;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">What Users Talk About</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data.uniqueTopicsCount > 0
              ? `${data.uniqueTopicsCount} unique topics discovered across ${fmt(data.totalConversations)} conversations`
              : `${fmt(data.totalConversations)} conversations — run analysis to discover topics`}
          </p>
        </div>
        {/* Local platform filter (only if not controlled by global) */}
        {!isMultiPlatform && (
          <select value={localPlatform} onChange={(e) => setLocalPlatform(e.target.value)}
            className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20">
            <option value="all">All Platforms</option>
            {["chatgpt", "claude", "gemini", "grok", "perplexity"].map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state: no data at all */}
      {hasNoData && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-indigo-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-base font-semibold text-white mb-2">No topics discovered yet</h3>
          <p className="text-sm text-zinc-500 mb-2 max-w-md mx-auto">
            After running analysis, this page shows an interactive topic map, breakdown table, and auto-generated insights about what your users are asking.
          </p>
          <div className="inline-block bg-black/40 rounded-lg px-4 py-3 font-mono text-xs text-zinc-400 mt-3 text-left">
            <p className="text-emerald-400">python -m workers.intent_classifier</p>
            <p className="text-emerald-400 mt-1">python -m workers.topic_clusterer</p>
          </div>
        </div>
      )}

      {/* No cluster data but has unclustered intents */}
      {!data.hasClusterData && data.unclustered.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <p className="text-sm font-medium text-amber-300 mb-1">Intent labels detected — clustering not run yet</p>
          <p className="text-xs text-zinc-500 mb-3">Run the topic clusterer to group intents into high-level clusters and unlock the Topic Map visualization.</p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400">
            <p className="text-emerald-400">python -m workers.topic_clusterer</p>
          </div>
        </div>
      )}

      {/* ── Section 1: Topic Map ─────────────────────────────────────────────── */}
      {data.hasClusterData && activeClusters.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Map</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {selectedCluster !== null
                  ? `Topics inside "${selectedCluster}" — size = volume, color = quality`
                  : "Size = conversation volume · Color = quality score · Click a cluster to explore"}
              </p>
            </div>
            {selectedCluster !== null && (
              <button onClick={() => setSelectedCluster(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                ← All Topics
              </button>
            )}
          </div>

          {/* Quality legend */}
          <div className="flex items-center gap-4 mb-4 mt-3">
            {[["≥75", "#22c55e"], ["≥60", "#84cc16"], ["≥45", "#eab308"], ["≥30", "#f97316"], ["<30", "#ef4444"], ["No data", "#3f3f46"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.8 }} />
                {label}
              </span>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={(props) => {
                const { x, y, width, height, name, value } = props as { x: number; y: number; width: number; height: number; name: string; value: number };
                const item = treemapData.find((d) => d.name === name && d.size === value);
                return (
                  <TreemapCell x={x} y={y} width={width} height={height} name={name}
                    quality={item?.quality ?? null} isCluster={item?.isCluster}
                    onClick={item?.isCluster ? () => setSelectedCluster(item.clusterId ?? name) : undefined} />
                );
              }}
            />
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Section 2: Topic Breakdown ───────────────────────────────────────── */}
      {(data.hasClusterData || data.unclustered.length > 0) && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Breakdown</p>
              <p className="text-xs text-zinc-600 mt-0.5">All topics sorted by any column — click headers to sort</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search topics..." value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-300 w-48 focus:outline-none focus:border-white/20 placeholder:text-zinc-600" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Cluster</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Specific Topic</th>
                  <SortTh k="count" label="Conversations" />
                  <SortTh k="avgQuality" label="Avg Quality" />
                  <SortTh k="completionRate" label="Completion" />
                  <SortTh k="avgTurns" label="Avg Turns" />
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trend</th>
                  {isMultiPlatform && <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Platform</th>}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredRows.length === 0 ? (
                  <tr><td colSpan={isMultiPlatform ? 8 : 7} className="text-center py-8 text-zinc-600 text-sm">No topics match your search</td></tr>
                ) : (
                  sortedFilteredRows.slice(0, 100).map((row) => (
                    <tr key={`${row.clusterName}:${row.label}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded capitalize">{row.clusterName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 capitalize max-w-[200px] truncate">{cap(row.label)}</td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono">{fmt(row.count)}</td>
                      <td className="px-4 py-2.5">
                        {row.avgQuality !== null
                          ? <span className="font-mono text-xs" style={{ color: qualityColor(row.avgQuality) }}>{row.avgQuality}/100</span>
                          : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{row.completionRate ? `${row.completionRate}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{row.avgTurns ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        {row.isEmerging
                          ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">New</span>
                          : <span className="text-zinc-700 text-xs">—</span>}
                      </td>
                      {isMultiPlatform && (
                        <td className="px-4 py-2.5">
                          {row.topPlatform ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ color: PLATFORM_COLORS[row.topPlatform] ?? "#6b7280", backgroundColor: (PLATFORM_COLORS[row.topPlatform] ?? "#6b7280") + "20" }}>
                              {PLATFORM_LABELS[row.topPlatform] ?? row.topPlatform}
                            </span>
                          ) : <span className="text-zinc-700 text-xs">—</span>}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {sortedFilteredRows.length > 100 && (
              <p className="text-xs text-zinc-600 text-center py-3">Showing 100 of {sortedFilteredRows.length} topics — use search to filter</p>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Topic Insights ────────────────────────────────────────── */}
      {data.hasClusterData && (
        <div className="space-y-3">
          <div className="px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Insights</p>
            <p className="text-xs text-zinc-600 mt-0.5">Auto-generated observations about your topic data</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Most discussed */}
            {data.topicInsights.mostDiscussed && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">💬</span>
                  <p className="text-xs font-semibold text-zinc-300">Most Discussed</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{data.topicInsights.mostDiscussed.name}</span>
                  {" "}is the largest topic cluster with{" "}
                  <span className="text-white font-mono">{fmt(data.topicInsights.mostDiscussed.count)}</span> conversations.
                </p>
              </div>
            )}

            {/* Biggest quality gap */}
            {data.topicInsights.biggestQualityGap && (
              <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <p className="text-xs font-semibold text-zinc-300">Biggest Quality Gap</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{cap(data.topicInsights.biggestQualityGap.label)}</span>
                  {" "}has high volume ({fmt(data.topicInsights.biggestQualityGap.count)} convos) but low quality{" "}
                  <span className="text-red-400 font-mono">{data.topicInsights.biggestQualityGap.avgQuality}/100</span>
                  {" "}— users ask a lot but AI struggles.
                </p>
              </div>
            )}

            {/* Fastest growing */}
            {data.topicInsights.fastestGrowing && (
              <div className="rounded-xl border border-indigo-500/10 bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">📈</span>
                  <p className="text-xs font-semibold text-zinc-300">Fastest Growing</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{cap(data.topicInsights.fastestGrowing.label)}</span>
                  {" "}is a new emerging topic with{" "}
                  <span className="text-white font-mono">{fmt(data.topicInsights.fastestGrowing.count)}</span> conversations in the last 14 days
                  {data.topicInsights.fastestGrowing.clusterName ? ` (cluster: ${data.topicInsights.fastestGrowing.clusterName})` : ""}.
                </p>
              </div>
            )}

            {/* Platform specialization */}
            {isMultiPlatform && data.topicInsights.platformSpecialization.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🎯</span>
                  <p className="text-xs font-semibold text-zinc-300">Platform Specialization</p>
                </div>
                <div className="space-y-1.5">
                  {data.topicInsights.platformSpecialization.map((ps) => (
                    <p key={ps.platform} className="text-sm text-zinc-400">
                      Users prefer{" "}
                      <span className="font-medium" style={{ color: PLATFORM_COLORS[ps.platform] }}>{PLATFORM_LABELS[ps.platform]}</span>
                      {" "}for <span className="text-white capitalize">{ps.clusterName}</span>.
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Emerging topics count */}
            {data.emergingTopics.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">✨</span>
                  <p className="text-xs font-semibold text-zinc-300">New Activity</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-mono">{data.emergingTopics.length}</span> new topic
                  {data.emergingTopics.length !== 1 ? "s" : ""} emerged in the last 14 days, including{" "}
                  <span className="text-white capitalize">{cap(data.emergingTopics[0].label)}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: Failure Analysis ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="px-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Failure Analysis</p>
          <p className="text-xs text-zinc-600 mt-0.5">Systematic classification of AI failure patterns across all conversations</p>
        </div>

        {failureLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-xl bg-white/[0.04] h-48" />)}
          </div>
        ) : !failureData || failureData.totalFailed === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-8 text-center">
            <p className="text-zinc-600 text-sm">No failure data available — conversations with quality score &lt; 65 will appear here</p>
          </div>
        ) : (
          <>
            {/* 4a: Failure Type Frequency + Expandable Examples */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Failure Type Frequency</p>
              <p className="text-xs text-zinc-600 mb-1">
                {fmt(failureData.totalFailed)} failed conversations · click a row to see examples
              </p>

              <div className="space-y-1 mt-4">
                {failureData.frequencyData.map((ft) => {
                  const isExpanded = expandedFailure === ft.key;
                  const barWidth = failureData.frequencyData[0]?.count > 0
                    ? (ft.count / failureData.frequencyData[0].count) * 100
                    : 0;
                  return (
                    <div key={ft.key}>
                      <button
                        onClick={() => setExpandedFailure(isExpanded ? null : ft.key)}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group text-left"
                      >
                        <span className="text-base w-6 text-center shrink-0">{ft.icon}</span>
                        <span className="text-sm text-zinc-300 w-40 shrink-0">{ft.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: ft.color }} />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 w-12 text-right shrink-0">{fmt(ft.count)}</span>
                        <span className="text-[10px] text-zinc-600 w-10 text-right shrink-0">{ft.pct}%</span>
                        <svg className={`w-3 h-3 text-zinc-600 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="ml-9 mt-1 mb-2 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">Example conversations</p>
                          {(failureData.examples[ft.key] ?? []).length === 0 ? (
                            <p className="text-xs text-zinc-600">No examples available</p>
                          ) : (
                            (failureData.examples[ft.key] ?? []).map((ex, i) => (
                              <div key={i} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.05]">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[9px] font-mono text-zinc-600">{ex.convId}</span>
                                  <span className="text-[10px] text-zinc-500 capitalize bg-white/[0.04] px-1.5 py-0.5 rounded">{cap(ex.intent)}</span>
                                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                                    style={{ color: ft.color, backgroundColor: ft.color + "15" }}>
                                    Turn {ex.turn}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                  <span className="mr-1.5">{ft.icon}</span>{ex.detail}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4b: Failure Trends (4 weeks) */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Failure Trends</p>
              <p className="text-xs text-zinc-600 mb-4">Weekly failure count per type — is your hallucination rate improving?</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={failureData.weeklyTrend} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: unknown, name: unknown) => [
                      String(v),
                      FAILURE_TYPES.find((f) => f.key === String(name))?.label ?? String(name),
                    ]}
                  />
                  {FAILURE_TYPES.map((ft) => (
                    <Line key={ft.key} type="monotone" dataKey={ft.key} stroke={ft.color}
                      strokeWidth={1.5} dot={false} connectNulls name={ft.key} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-white/[0.05]">
                {FAILURE_TYPES.map((ft) => (
                  <div key={ft.key} className="flex items-center gap-1.5">
                    <span className="text-[10px]">{ft.icon}</span>
                    <span className="text-[10px] text-zinc-500">{ft.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4c: Intent × Failure Type Heatmap */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Intent × Failure Heatmap</p>
              <p className="text-xs text-zinc-600 mb-4">Which intents produce which failures most often — darker = higher rate</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 w-44">Intent</th>
                      {FAILURE_TYPES.map((ft) => (
                        <th key={ft.key} className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500 whitespace-nowrap" title={ft.label}>
                          <span className="block text-base leading-none mb-0.5">{ft.icon}</span>
                          <span className="text-[9px] text-zinc-600">{ft.label.slice(0, 6)}</span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failureData.intentCrossTab.map((row) => {
                      const maxInRow = Math.max(1, ...FAILURE_TYPES.map((ft) => (row[ft.key] as number) ?? 0));
                      return (
                        <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5 text-zinc-300 capitalize font-medium truncate max-w-[11rem]">{cap(row.intent)}</td>
                          {FAILURE_TYPES.map((ft) => {
                            const count = (row[ft.key] as number) ?? 0;
                            const opacity = count > 0 ? 0.12 + (count / maxInRow) * 0.55 : 0;
                            return (
                              <td key={ft.key} className="px-2 py-2.5 text-center">
                                {count > 0 ? (
                                  <span
                                    className="inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-mono font-semibold"
                                    style={{ backgroundColor: ft.color + Math.round(opacity * 255).toString(16).padStart(2, "0"), color: ft.color }}
                                  >
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-zinc-800 text-[10px]">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-right text-zinc-500 font-mono text-[10px]">{row.total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Unclustered intents fallback */}
      {(!data.hasClusterData || data.unclustered.length > 0) && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {data.hasClusterData ? "Unclustered Intent Labels" : "Raw Intent Labels"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {data.hasClusterData ? "Labels not yet assigned to a cluster — re-run topic_clusterer to include these" : "Raw intent labels — run topic_clusterer to group into clusters"}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["#", "Label", "Volume", "Avg Quality", "Failure Rate"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.unclustered.map((row, i) => (
                <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 text-zinc-200 capitalize">{cap(row.label)}</td>
                  <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums">{fmt(row.count)}</td>
                  <td className="px-4 py-2.5">
                    {row.avgQuality !== null
                      ? <span className="font-mono text-xs" style={{ color: qualityColor(row.avgQuality) }}>{row.avgQuality}/100</span>
                      : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-xs ${row.failureRate >= 50 ? "text-red-400" : row.failureRate >= 30 ? "text-amber-400" : "text-zinc-400"}`}>
                      {row.failureRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
