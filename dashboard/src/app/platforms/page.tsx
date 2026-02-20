"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformData {
  platform: string; total: number; analyzed: number;
  avgTurns: number | null; medianTurns: number | null;
  pct5Plus: number | null; longestTurns: number | null;
  avgQuality: number | null; completionRate: number | null;
  failureRate: number | null; topIntent: string | null;
  statuses: Record<string, number>;
}
interface ApiData { platforms: PlatformData[]; pending: number; keyFindings: string[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: PLATFORM_COLORS[platform] ?? "#a1a1aa", backgroundColor: (PLATFORM_COLORS[platform] ?? "#6b7280") + "20" }}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-52" />
      <Bone className="h-20 rounded-xl" />
      <Bone className="h-40 rounded-xl" />
      <div className="grid grid-cols-2 gap-6">
        <Bone className="h-64 rounded-xl" /><Bone className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function QBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono tabular-nums text-zinc-300 w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformComparison() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

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

  const { platforms, pending, keyFindings } = data;
  const totalAnalyzed = platforms.reduce((s, p) => s + p.analyzed, 0);
  const chartData = platforms.map((p) => ({ name: PLATFORM_LABELS[p.platform] ?? p.platform, ...p }));

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Platform Comparison</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Which AI assistant handles conversations best?</p>
      </div>

      {/* Key Findings — only when AI data available */}
      {keyFindings.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">Key Findings</p>
          <ul className="space-y-2">
            {keyFindings.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-indigo-500 mt-0.5 shrink-0">→</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Section 1: Raw Metrics (always visible) ────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Raw Metrics — no AI workers needed</p>
          <p className="text-xs text-zinc-600 mt-0.5">Directly from conversation metadata</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Platform", "Total Convos", "Avg Turns", "Median Turns", "5+ Turn %", "Longest"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p.platform} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3.5"><PlatformBadge platform={p.platform} /></td>
                <td className="px-4 py-3.5 text-zinc-300 font-mono tabular-nums">{fmt(p.total)}</td>
                <td className="px-4 py-3.5 text-zinc-300 font-mono">{p.avgTurns !== null ? p.avgTurns : <span className="text-zinc-600">—</span>}</td>
                <td className="px-4 py-3.5 text-zinc-400 font-mono">{p.medianTurns !== null ? p.medianTurns : <span className="text-zinc-600">—</span>}</td>
                <td className="px-4 py-3.5">
                  {p.pct5Plus !== null ? (
                    <span className={`font-mono ${p.pct5Plus >= 40 ? "text-emerald-400" : p.pct5Plus >= 20 ? "text-amber-400" : "text-zinc-400"}`}>
                      {p.pct5Plus}%
                    </span>
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3.5 text-zinc-500 font-mono">{p.longestTurns !== null ? p.longestTurns : <span className="text-zinc-600">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Section 2: AI-Analyzed Metrics (conditional) ──────────────────────── */}
      {totalAnalyzed === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-400 text-sm mb-1">No AI-analyzed conversations yet.</p>
          <p className="text-zinc-600 text-xs">
            Run <code className="bg-white/[0.06] text-zinc-300 px-1 rounded">python -m scripts.test_workers</code> to unlock quality scores, completion rates, and failure analysis.{" "}
            {fmt(pending)} conversations pending.
          </p>
        </div>
      ) : (
        <>
          {/* AI-analyzed comparison table */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">AI-Analyzed Metrics</p>
              <p className="text-xs text-zinc-600 mt-0.5">Based on {fmt(totalAnalyzed)} analyzed conversations</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Platform", "Analyzed", "Avg Quality", "Completion Rate", "Failure Rate", "Top Intent"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.platform} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5"><PlatformBadge platform={p.platform} /></td>
                    <td className="px-4 py-3.5 text-zinc-300 font-mono tabular-nums">
                      {fmt(p.analyzed)}
                      <span className="text-zinc-600 ml-1 text-xs">
                        ({p.total > 0 ? Math.round((p.analyzed / p.total) * 100) : 0}%)
                      </span>
                    </td>
                    <td className="px-4 py-3.5 w-36">
                      {p.avgQuality !== null ? (
                        <QBar score={p.avgQuality} color={PLATFORM_COLORS[p.platform] ?? "#6b7280"} />
                      ) : (
                        <span className="text-zinc-600 text-xs">Not yet analyzed</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.completionRate !== null ? (
                        <span className={`font-mono font-medium ${p.completionRate >= 60 ? "text-emerald-400" : p.completionRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {p.completionRate}%
                        </span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {p.failureRate !== null ? (
                        <span className={`font-mono font-medium ${p.failureRate >= 40 ? "text-red-400" : p.failureRate >= 20 ? "text-amber-400" : "text-emerald-400"}`}>
                          {p.failureRate}%
                        </span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 capitalize text-xs">
                      {p.topIntent ? cap(p.topIntent) : <span className="text-zinc-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Avg Quality Score */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Avg Quality Score by Platform
              </p>
              <p className="text-xs text-zinc-600 mb-4">Higher is better — score out of 100</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.filter((d) => d.avgQuality !== null)} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}/100`, "Avg Quality"]}
                  />
                  <Bar dataKey="avgQuality" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.filter((d) => d.avgQuality !== null).map((d) => (
                      <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Completion Rate */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Completion Rate by Platform
              </p>
              <p className="text-xs text-zinc-600 mb-4">% of conversations where user got what they needed</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.filter((d) => d.completionRate !== null)} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number | undefined) => [`${v ?? 0}%`, "Completion Rate"]}
                  />
                  <Bar dataKey="completionRate" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.filter((d) => d.completionRate !== null).map((d) => (
                      <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status breakdown per platform */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Completion Status Breakdown
            </p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {platforms.filter((p) => p.analyzed > 0).map((p) => {
                const total = Object.values(p.statuses).reduce((s, n) => s + n, 0) || 1;
                const bars = [
                  { label: "completed",   n: p.statuses["completed"]   ?? 0, color: "#34d399" },
                  { label: "failed",      n: p.statuses["failed"]      ?? 0, color: "#f87171" },
                  { label: "abandoned",   n: p.statuses["abandoned"]   ?? 0, color: "#fbbf24" },
                  { label: "in progress", n: p.statuses["in_progress"] ?? 0, color: "#60a5fa" },
                ];
                return (
                  <div key={p.platform}>
                    <PlatformBadge platform={p.platform} />
                    <div className="mt-3 space-y-2">
                      {bars.filter((b) => b.n > 0).map((b) => (
                        <div key={b.label} className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                            <div className="h-full rounded-full" style={{ width: `${(b.n / total) * 100}%`, backgroundColor: b.color }} />
                          </div>
                          <span className="text-[10px] text-zinc-500 w-16 text-right">
                            {Math.round((b.n / total) * 1000) / 10}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {pending > 0 && (
            <p className="text-xs text-zinc-600 text-center">
              {fmt(pending)} conversations still pending analysis — run workers to improve accuracy.
            </p>
          )}
        </>
      )}
    </div>
  );
}
