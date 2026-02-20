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
const STATUS_COLORS: Record<string, string> = {
  completed: "#34d399", failed: "#f87171", abandoned: "#fbbf24", in_progress: "#60a5fa",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformStat {
  platform: string; total: number; analyzed: number;
  avgQuality: number | null; completionRate: number | null;
}
interface RecentRow {
  id: string; intent: string; quality_score: number | null;
  completion_status: string | null; created_at: string; platform: string;
}
interface TurnBucket { label: string; count: number; }
interface TurnsByPlatform { platform: string; total: number; avgTurns: number | null; }
interface IntentInsight { intent: string; count: number; failRate: number; }
interface ApiData {
  stats: {
    total: number; analyzed: number; avgQuality: number | null;
    completionRate: number | null; avgTurns: number | null; totalMessages: number;
  };
  byPlatform: PlatformStat[];
  turnDistribution: TurnBucket[];
  avgTurnsByPlatform: TurnsByPlatform[];
  topIntents: IntentInsight[];
  worstIntents: IntentInsight[];
  recentAnalyzed: RecentRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-40" />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-24 rounded-xl" />)}
      </div>
      <Bone className="h-10 rounded-xl" />
      <div className="grid grid-cols-2 gap-6">
        <Bone className="h-64 rounded-xl" /><Bone className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/overview")
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
          <p className="font-semibold mb-1">Failed to load</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const { stats, byPlatform, turnDistribution, avgTurnsByPlatform, topIntents, worstIntents, recentAnalyzed } = data;
  const analyzedPct = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;
  const hasAnalyzed = stats.analyzed > 0;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          ShareChat dataset · ChatGPT, Claude, Gemini, Grok, Perplexity
        </p>
      </div>

      {/* Hero stats — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Conversations" value={fmt(stats.total)} />
        <StatCard label="Platforms Tracked" value="5" sub="ChatGPT · Claude · Gemini · Grok · Perplexity" />
        <StatCard
          label="Avg Turns / Convo"
          value={stats.avgTurns !== null ? stats.avgTurns : "—"}
          sub="all conversations"
        />
        <StatCard
          label="Total Turns"
          value={stats.totalMessages > 0 ? fmt(stats.totalMessages) : "—"}
          sub="across all convos"
        />
        <StatCard
          label="Analyzed"
          value={fmt(stats.analyzed)}
          sub={stats.analyzed > 0 ? `${analyzedPct}% of total` : "Run workers to start"}
        />
        <StatCard
          label="Avg Quality Score"
          value={stats.avgQuality !== null ? `${stats.avgQuality}/100` : "—"}
          sub={stats.analyzed > 0 ? "analyzed convos" : "needs AI workers"}
        />
      </div>

      {/* Analysis progress */}
      {stats.analyzed < stats.total && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">
              Analysis progress —{" "}
              <span className="text-white font-mono">{fmt(stats.analyzed)}</span>
              <span className="text-zinc-600"> of {fmt(stats.total)} conversations analyzed</span>
            </span>
            <span className="text-xs font-mono text-zinc-500">{analyzedPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${Math.max(analyzedPct, 0.5)}%` }}
            />
          </div>
          {stats.analyzed === 0 && (
            <p className="text-xs text-zinc-500 mt-2">
              Run <code className="text-zinc-300 bg-white/[0.06] px-1 rounded">python -m scripts.test_workers</code> to start analyzing conversations.
            </p>
          )}
        </div>
      )}

      {/* Turn distribution + Avg turns by platform */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Turn length distribution */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Conversation Length Distribution
          </p>
          <p className="text-xs text-zinc-600 mb-4">How many turns per conversation — across all {fmt(stats.total)} convos</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={turnDistribution} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Avg turns by platform */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Avg Conversation Length by Platform
          </p>
          <p className="text-xs text-zinc-600 mb-4">Which AI drives deeper conversations?</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={avgTurnsByPlatform.map((d) => ({ ...d, label: PLATFORM_LABELS[d.platform] ?? d.platform }))}
              layout="vertical"
              margin={{ left: 8, right: 40, top: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} width={76} />
              <Tooltip
                contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number | undefined) => [`${v ?? 0} turns`, "Avg"]}
              />
              <Bar dataKey="avgTurns" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {avgTurnsByPlatform.map((d) => (
                  <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Platform distribution + Recent activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Conversations by Platform */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Conversations by Platform
          </p>
          <p className="text-xs text-zinc-600 mb-4">Total vs analyzed — solid bar = AI-analyzed</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={byPlatform.map((d) => ({ ...d, label: PLATFORM_LABELS[d.platform] ?? d.platform }))}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip
                contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
                formatter={(v: number | undefined, name: string | undefined) => [(v ?? 0).toLocaleString(), name === "total" ? "Total" : "Analyzed"]}
              />
              <Bar dataKey="total" name="total" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {byPlatform.map((d) => (
                  <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6b7280"} opacity={0.25} />
                ))}
              </Bar>
              <Bar dataKey="analyzed" name="analyzed" radius={[0, 4, 4, 0]} maxBarSize={28}>
                {byPlatform.map((d) => (
                  <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 ml-20">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-2 rounded-sm bg-zinc-600 opacity-40 inline-block" />Total
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-2 rounded-sm bg-indigo-500 inline-block" />Analyzed
            </span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            Recent Analyzed Conversations
          </p>
          {recentAnalyzed.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
              No analyzed conversations yet
            </div>
          ) : (
            <div className="space-y-2">
              {recentAnalyzed.map((row) => (
                <div key={row.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[row.platform] ?? "#6b7280" }}
                  />
                  <span className="text-sm text-zinc-300 flex-1 truncate capitalize">{cap(row.intent ?? "—")}</span>
                  <span className={`text-xs font-mono tabular-nums ${
                    row.quality_score === null ? "text-zinc-600" :
                    row.quality_score >= 70 ? "text-emerald-400" :
                    row.quality_score >= 50 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {row.quality_score !== null ? row.quality_score : "—"}
                  </span>
                  {row.completion_status && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                      style={{
                        color: STATUS_COLORS[row.completion_status] ?? "#a1a1aa",
                        backgroundColor: (STATUS_COLORS[row.completion_status] ?? "#a1a1aa") + "20",
                      }}
                    >
                      {row.completion_status}
                    </span>
                  )}
                  <span className="text-xs text-zinc-600 shrink-0">{relTime(row.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Intent insight cards — only when analyzed data exists */}
      {hasAnalyzed && (topIntents.length > 0 || worstIntents.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* Most popular intents */}
          {topIntents.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
                Top Intents by Volume
              </p>
              <p className="text-xs text-zinc-600 mb-4">What users ask about most</p>
              <div className="space-y-3">
                {topIntents.map((item, i) => (
                  <div key={item.intent} className="flex items-center gap-3">
                    <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                    <span className="text-sm text-zinc-200 capitalize flex-1">{cap(item.intent)}</span>
                    <span className="text-xs font-mono text-zinc-400">{fmt(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Worst intents by failure */}
          {worstIntents.length > 0 && (
            <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/60 mb-1">
                Highest Failure Rate
              </p>
              <p className="text-xs text-zinc-600 mb-4">Intents where AI struggles most</p>
              <div className="space-y-3">
                {worstIntents.map((item, i) => (
                  <div key={item.intent} className="flex items-center gap-3">
                    <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                    <span className="text-sm text-zinc-200 capitalize flex-1">{cap(item.intent)}</span>
                    <span className={`text-xs font-mono font-medium ${item.failRate >= 50 ? "text-red-400" : "text-amber-400"}`}>
                      {item.failRate}% fail
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
