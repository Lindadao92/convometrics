"use client";

import { useEffect, useState } from "react";
import { formatLabel } from "@/lib/formatLabel";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};
const PLATFORMS = ["all", "chatgpt", "claude", "gemini", "grok", "perplexity"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Example { preview: string; platform: string; }
interface FailureRow {
  intent: string; failedCount: number; abandonedCount: number;
  failureTotal: number; total: number; failureRate: number;
  avgQuality: number | null; topPlatform: string | null;
  examples: Example[];
}
interface LowQRow { intent: string; avgQuality: number; count: number; }
interface FixRow  { intent: string; impactScore: number; avgQuality: number | null; failureRate: number; count: number; }
interface ClusterFailure { clusterName: string; failureTotal: number; total: number; failureRate: number; avgQuality: number | null; }
interface ApiData { byFailure: FailureRow[]; lowQuality: LowQRow[]; fixFirst: FixRow[]; pending: number; clusterFailures?: ClusterFailure[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }

function ImpactBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-red-500/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-red-400 w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{children}</p>
      {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-48" />
      {[0, 1, 2].map((i) => <Bone key={i} className="h-48 rounded-xl" />)}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FailureAnalysis() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const [expandedIntent, setExpandedIntent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/failures${platform !== "all" ? `?platform=${platform}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [platform]);

  const hasData = data && (data.byFailure.length > 0 || data.lowQuality.length > 0 || data.fixFirst.length > 0);

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

  const maxImpact = data.fixFirst[0]?.impactScore ?? 1;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Failure Analysis</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Where AI conversations break down — and what to fix first</p>
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.filter((p) => p !== "all").map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Failures by Topic Cluster */}
      {(data.clusterFailures?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <SectionHeader sub="Failure rate by topic cluster — run topic_clusterer to enable">
            Failures by Topic Cluster
          </SectionHeader>
          <div className="space-y-3">
            {data.clusterFailures!.map((cg) => (
              <div key={cg.clusterName} className="flex items-center gap-4 py-2.5 border-b border-white/[0.04] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{cg.clusterName}</p>
                  <p className="text-xs text-zinc-600">{fmt(cg.total)} conversations</p>
                </div>
                <p className={`text-sm font-mono font-bold shrink-0 ${cg.failureRate >= 50 ? "text-red-400" : cg.failureRate >= 30 ? "text-amber-400" : "text-zinc-300"}`}>
                  {cg.failureRate}% fail
                </p>
                {cg.avgQuality !== null && (
                  <div className="w-16 shrink-0 space-y-1">
                    <div className="h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${cg.avgQuality}%`,
                          backgroundColor: cg.avgQuality >= 70 ? "#34d399" : cg.avgQuality >= 50 ? "#fbbf24" : "#f87171",
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600 text-right">{cg.avgQuality}/100</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasData && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-400 text-sm mb-1">No analyzed conversations yet.</p>
          <p className="text-zinc-600 text-xs">
            Run AI workers to see failure insights. {fmt(data.pending)} conversations pending analysis.
          </p>
        </div>
      )}

      {hasData && (
        <>
          {/* Fix These First — auto-recommendation cards */}
          {data.fixFirst.length > 0 && (
            <div className="rounded-xl border border-red-500/15 bg-[#13141b] p-5">
              <SectionHeader sub="Ranked by: volume × failure rate × quality gap">
                Fix These First
              </SectionHeader>
              <div className="space-y-2.5">
                {data.fixFirst.map((row, i) => (
                  <div key={row.intent} className="flex items-center gap-4 py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-lg font-bold text-zinc-700 w-6 text-center tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{formatLabel(row.intent)}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-600">
                        <span>{fmt(row.count)} convos</span>
                        <span className="text-red-400">{row.failureRate}% fail</span>
                        {row.avgQuality !== null && <span className="text-amber-400">quality {row.avgQuality}/100</span>}
                      </div>
                    </div>
                    <ImpactBar value={row.impactScore} max={maxImpact} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Where AI Fails */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <SectionHeader sub="Sorted by combined failed + abandoned count">
              Where AI Fails — by Intent
            </SectionHeader>
            {data.byFailure.length === 0 ? (
              <p className="text-zinc-600 text-sm">No failures detected in analyzed conversations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Intent", "Failed", "Abandoned", "Failure Rate", "Avg Quality", "Top Platform", ""].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byFailure.map((row, i) => (
                      <>
                        <tr
                          key={row.intent}
                          className={`border-b border-white/[0.03] transition-colors ${row.examples.length > 0 ? "cursor-pointer hover:bg-white/[0.02]" : ""} ${expandedIntent === row.intent ? "bg-white/[0.03]" : ""}`}
                          onClick={() => row.examples.length > 0 && setExpandedIntent(expandedIntent === row.intent ? null : row.intent)}
                        >
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="text-zinc-600 text-xs w-4 text-right">{i + 1}</span>
                              <span className="text-zinc-200">{formatLabel(row.intent)}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-red-400 font-mono tabular-nums">{fmt(row.failedCount)}</td>
                          <td className="px-3 py-2.5 text-amber-400 font-mono tabular-nums">{fmt(row.abandonedCount)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`font-mono font-medium ${row.failureRate >= 70 ? "text-red-400" : row.failureRate >= 40 ? "text-amber-400" : "text-zinc-300"}`}>
                              {row.failureRate}%
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.avgQuality !== null ? (
                              <span className={`font-mono ${row.avgQuality < 40 ? "text-red-400" : row.avgQuality < 60 ? "text-amber-400" : "text-emerald-400"}`}>
                                {row.avgQuality}
                              </span>
                            ) : <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.topPlatform ? (
                              <span className="text-xs" style={{ color: PLATFORM_COLORS[row.topPlatform] ?? "#a1a1aa" }}>
                                {PLATFORM_LABELS[row.topPlatform] ?? row.topPlatform}
                              </span>
                            ) : <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600 text-xs">
                            {row.examples.length > 0 && (expandedIntent === row.intent ? "▲ hide" : "▼ examples")}
                          </td>
                        </tr>

                        {/* Example conversations */}
                        {expandedIntent === row.intent && row.examples.length > 0 && (
                          <tr key={`${row.intent}-ex`} className="bg-[#0f101a]">
                            <td colSpan={7} className="px-5 py-4">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">
                                Real failed conversations
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {row.examples.map((ex, ei) => (
                                  <div key={ei} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: PLATFORM_COLORS[ex.platform] ?? "#6b7280" }}
                                      />
                                      <span className="text-[10px] text-zinc-600">{PLATFORM_LABELS[ex.platform] ?? ex.platform}</span>
                                    </div>
                                    <p className="text-xs text-zinc-400 italic line-clamp-4">&ldquo;{ex.preview}&rdquo;</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lowest Quality */}
          {data.lowQuality.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <SectionHeader sub="Intents where AI responses score below 50/100 on average">
                Lowest Quality Intents
              </SectionHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.lowQuality.map((row) => (
                  <div key={row.intent} className="bg-white/[0.03] rounded-lg p-3.5 border border-white/[0.05]">
                    <p className="text-sm text-zinc-200 font-medium mb-2">{formatLabel(row.intent)}</p>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${row.avgQuality}%` }} />
                      </div>
                      <span className="text-xs font-mono text-red-400 tabular-nums">{row.avgQuality}/100</span>
                    </div>
                    <p className="text-[10px] text-zinc-600">{fmt(row.count)} conversations</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
