"use client";

import { useEffect, useState } from "react";
import {
  Treemap, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};
const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicSummary {
  label: string; count: number; avgQuality: number | null;
  failureRate: number; firstSeen: string | null; isEmerging: boolean;
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
interface ApiData {
  clusters: ClusterData[]; emergingTopics: EmergingTopic[]; unclustered: UnclusteredIntent[];
  hasClusterData: boolean; totalConversations: number;
}

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
      <Bone className="h-7 w-48" />
      <Bone className="h-[360px] rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => <Bone key={i} className="h-28 rounded-xl" />)}
      </div>
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Treemap item type ────────────────────────────────────────────────────────

interface TreemapItem { name: string; size: number; quality: number | null; isCluster: boolean; clusterId?: string; [key: string]: unknown; }

// ─── Treemap custom cell ───────────────────────────────────────────────────────

interface TreemapContentProps {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; value?: number; quality?: number | null;
  onClick?: () => void; isCluster?: boolean;
}

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", quality, onClick, isCluster }: TreemapContentProps) {
  const color = qualityColor(quality ?? null);
  const showText = width > 40 && height > 24;
  const showSub = width > 80 && height > 44;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect
        x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        rx={4} fill={color} fillOpacity={0.18}
        stroke={color} strokeOpacity={0.4} strokeWidth={1}
      />
      {showText && (
        <text
          x={x + width / 2} y={y + height / 2 - (showSub ? 7 : 0)}
          textAnchor="middle" fill="white" fontSize={Math.min(12, width / 8)}
          style={{ pointerEvents: "none" }}
        >
          {name.length > 20 && width < 120 ? name.slice(0, 18) + "…" : name}
        </text>
      )}
      {showSub && quality !== null && quality !== undefined && (
        <text
          x={x + width / 2} y={y + height / 2 + 10}
          textAnchor="middle" fill={color} fontSize={10}
          style={{ pointerEvents: "none" }}
        >
          {quality}/100
        </text>
      )}
      {isCluster && showText && height > 50 && (
        <text
          x={x + width / 2} y={y + height / 2 + (showSub ? 24 : 12)}
          textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9}
          style={{ pointerEvents: "none" }}
        >
          click to explore
        </text>
      )}
    </g>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicIntelligence() {
  const [platform, setPlatform] = useState("all");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelectedCluster(null);
    const url = `/api/topics${platform !== "all" ? `?platform=${platform}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [platform]);

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  // ── Treemap data ─────────────────────────────────────────────────────────────
  const activeClusters = data.clusters.filter((c) => c.conversationCount > 0);
  const treemapData: TreemapItem[] = selectedCluster === null
    ? activeClusters.map((c) => ({
        name: c.clusterName,
        size: c.conversationCount,
        quality: c.avgQuality,
        clusterId: c.id,
        isCluster: true,
      }))
    : (() => {
        const cluster = data.clusters.find((c) => c.id === selectedCluster || c.clusterName === selectedCluster);
        return (cluster?.topics ?? []).map((t): TreemapItem => ({
          name: t.label,
          size: t.count,
          quality: t.avgQuality,
          isCluster: false,
        }));
      })();

  // ── Platform stacked bar data (top 12 clusters) ───────────────────────────
  const top12 = activeClusters.slice(0, 12);
  const stackedData = top12.map((c) => {
    const row: Record<string, unknown> = { name: c.clusterName.length > 18 ? c.clusterName.slice(0, 16) + "…" : c.clusterName };
    for (const pb of c.platformBreakdown) {
      row[pb.platform] = pb.count;
    }
    return row;
  });

  // ── Depth chart (avg turns per cluster, top 12) ───────────────────────────
  const depthData = [...activeClusters]
    .filter((c) => c.avgTurns !== null)
    .sort((a, b) => (b.avgTurns ?? 0) - (a.avgTurns ?? 0))
    .slice(0, 12)
    .map((c) => ({ name: c.clusterName, turns: c.avgTurns }));

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Topic Intelligence</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            What users actually talk about — {fmt(data.totalConversations)} conversations
          </p>
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Run topic_clusterer banner — shown when no cluster data */}
      {!data.hasClusterData && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
          <p className="text-sm font-medium text-indigo-300 mb-1">Enable cluster view</p>
          <p className="text-xs text-zinc-500 mb-3">
            After conversations have intent labels, run the clusterer to group them into high-level topics.
          </p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400">
            <p className="text-emerald-400">python -m workers.intent_classifier</p>
            <p className="text-emerald-400 mt-1">python -m workers.topic_clusterer</p>
          </div>
        </div>
      )}

      {/* Treemap — What People Talk About */}
      {data.hasClusterData && activeClusters.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              What People Talk About
            </p>
            {selectedCluster !== null && (
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                ← All Topics
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-600 mb-4">
            {selectedCluster !== null
              ? `Topics inside "${selectedCluster}" — bubble size = volume, color = quality`
              : "Bubble size = conversation volume · Color = quality score · Click a cluster to explore"}
          </p>

          {/* Quality legend */}
          <div className="flex items-center gap-4 mb-4">
            {[
              { label: "≥75", color: "#22c55e" }, { label: "≥60", color: "#84cc16" },
              { label: "≥45", color: "#eab308" }, { label: "≥30", color: "#f97316" },
              { label: "<30", color: "#ef4444" }, { label: "No data", color: "#3f3f46" },
            ].map(({ label, color }) => (
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
                const item: TreemapItem | undefined = treemapData.find((d) => d.name === name && d.size === value);
                return (
                  <TreemapCell
                    x={x} y={y} width={width} height={height}
                    name={name}
                    quality={item?.quality ?? null}
                    isCluster={item?.isCluster}
                    onClick={item?.isCluster ? () => setSelectedCluster(item.clusterId ?? name) : undefined}
                  />
                );
              }}
            />
          </ResponsiveContainer>
        </div>
      )}

      {/* Topic Volume by Platform — stacked bar */}
      {data.hasClusterData && stackedData.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Topic Volume by Platform
          </p>
          <p className="text-xs text-zinc-600 mb-4">Top 12 clusters, stacked by platform</p>
          <div className="flex flex-wrap gap-4 mb-4">
            {PLATFORMS.map((p) => (
              <span key={p} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
                {PLATFORM_LABELS[p]}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stackedData} margin={{ top: 0, right: 8, bottom: 60, left: 0 }}>
              <XAxis
                dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false} tickLine={false}
                angle={-40} textAnchor="end" interval={0}
              />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number | undefined, name: string | undefined) => [fmt(v ?? 0), PLATFORM_LABELS[name ?? ""] ?? name ?? ""]}
              />
              {PLATFORMS.map((p) => (
                <Bar key={p} dataKey={p} stackId="a" fill={PLATFORM_COLORS[p]} maxBarSize={48} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Emerging Topics */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Emerging Topics</p>
        <p className="text-xs text-zinc-600 mb-4">New intent labels first seen in the last 14 days</p>
        {data.emergingTopics.length === 0 ? (
          <p className="text-xs text-zinc-600">No emerging topics detected yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.emergingTopics.map((et) => (
              <div key={et.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm text-zinc-200 capitalize font-medium">{cap(et.label)}</p>
                  {et.avgQuality !== null && (
                    <span className="text-xs font-mono shrink-0" style={{ color: qualityColor(et.avgQuality) }}>
                      {et.avgQuality}/100
                    </span>
                  )}
                </div>
                {et.clusterName && (
                  <p className="text-[10px] text-zinc-600 mb-1">
                    <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded">{et.clusterName}</span>
                  </p>
                )}
                <div className="flex items-center gap-3 text-[10px] text-zinc-600 mt-1">
                  <span>{fmt(et.count)} convos</span>
                  <span>First seen {new Date(et.firstSeen).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topic Depth — avg turns per cluster */}
      {data.hasClusterData && depthData.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Topic Depth</p>
          <p className="text-xs text-zinc-600 mb-4">Average conversation turns per cluster — longer = more complex or engaging</p>
          <ResponsiveContainer width="100%" height={Math.max(200, depthData.length * 36)}>
            <BarChart data={depthData} layout="vertical" margin={{ top: 0, right: 50, bottom: 0, left: 0 }}>
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category" dataKey="name" width={160}
                tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
                formatter={(v: number | undefined) => [`${v ?? 0} turns`, "Avg Turns"]}
              />
              <Bar dataKey="turns" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={24}>
                <LabelList dataKey="turns" position="right" style={{ fill: "#a1a1aa", fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Raw Intent Labels — fallback or unclustered */}
      {(!data.hasClusterData || data.unclustered.length > 0) && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {data.hasClusterData ? "Unclustered Intent Labels" : "Raw Intent Labels"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {data.hasClusterData
                ? "Labels not yet assigned to a cluster — re-run topic_clusterer to include these"
                : "Intent labels as classified — run topic_clusterer to group into clusters"}
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
                    {row.avgQuality !== null ? (
                      <span className="font-mono text-xs" style={{ color: qualityColor(row.avgQuality) }}>
                        {row.avgQuality}/100
                      </span>
                    ) : <span className="text-zinc-600 text-xs">—</span>}
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
