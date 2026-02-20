"use client";

import { useEffect, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10b981", claude: "#f97316", gemini: "#3b82f6",
  grok: "#ef4444", perplexity: "#a855f7",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};
const PLATFORMS = ["all", "chatgpt", "claude", "gemini", "grok", "perplexity"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FailureRow {
  intent: string; failedCount: number; abandonedCount: number;
  failureTotal: number; total: number; failureRate: number;
  avgQuality: number | null; topPlatform: string | null;
}
interface LowQRow { intent: string; avgQuality: number; count: number; }
interface FixRow  { intent: string; impactScore: number; avgQuality: number | null; failureRate: number; count: number; }
interface ApiData { byFailure: FailureRow[]; lowQuality: LowQRow[]; fixFirst: FixRow[]; pending: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s.replace(/_/g, " "); }
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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">{children}</p>
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

  useEffect(() => {
    setLoading(true);
    const url = `/api/failures${platform !== "all" ? `?platform=${platform}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [platform]);

  const totalAnalyzed = data ? (data.byFailure.reduce((s, r) => s + r.total, 0) > 0 || data.lowQuality.length > 0 || data.fixFirst.length > 0) : false;

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
          <p className="text-sm text-zinc-500 mt-0.5">Where AI conversations break down</p>
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

      {/* Empty state */}
      {!totalAnalyzed && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-400 text-sm mb-1">No analyzed conversations yet.</p>
          <p className="text-zinc-600 text-xs">
            Run AI workers to see failure insights. {fmt(data.pending)} conversations pending analysis.
          </p>
        </div>
      )}

      {totalAnalyzed && (
        <>
          {/* Where AI Fails */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <SectionHeader>Where AI Fails — failed + abandoned by intent</SectionHeader>
            {data.byFailure.length === 0 ? (
              <p className="text-zinc-600 text-sm">No failures detected in analyzed conversations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Intent", "Failed", "Abandoned", "Failure Rate", "Avg Quality", "Top Platform"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.byFailure.map((row, i) => (
                      <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="text-zinc-600 text-xs w-4 text-right">{i + 1}</span>
                            <span className="text-zinc-200 capitalize">{cap(row.intent)}</span>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Lowest Quality */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <SectionHeader>Lowest Quality Intents — avg score below 50</SectionHeader>
            {data.lowQuality.length === 0 ? (
              <p className="text-zinc-600 text-sm">No intents with avg quality below 50.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.lowQuality.map((row) => (
                  <div key={row.intent} className="bg-white/[0.03] rounded-lg p-3.5 border border-white/[0.05]">
                    <p className="text-sm text-zinc-200 capitalize font-medium mb-2">{cap(row.intent)}</p>
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
            )}
          </div>

          {/* Fix These First */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <SectionHeader>Fix These First — ranked by impact (volume × failure rate × quality gap)</SectionHeader>
            {data.fixFirst.length === 0 ? (
              <p className="text-zinc-600 text-sm">No high-impact issues detected.</p>
            ) : (
              <div className="space-y-2.5">
                {data.fixFirst.map((row, i) => (
                  <div key={row.intent} className="flex items-center gap-4 py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-lg font-bold text-zinc-700 w-6 text-center tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 capitalize truncate">{cap(row.intent)}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-600">
                        <span>{fmt(row.count)} convos</span>
                        <span className="text-red-400">{row.failureRate}% fail rate</span>
                        {row.avgQuality !== null && <span className="text-amber-400">quality {row.avgQuality}</span>}
                      </div>
                    </div>
                    <ImpactBar value={row.impactScore} max={maxImpact} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
