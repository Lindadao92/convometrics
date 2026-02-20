"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

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
const STATUS_COLORS: Record<string, string> = {
  completed: "#34d399", failed: "#f87171", abandoned: "#fbbf24", in_progress: "#60a5fa",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntentSummary {
  intent: string; count: number; countThisWeek: number; avgScore: number | null;
  completionRate: number; failureRate: number; impactScore: number;
  statuses: Record<string, number>;
}
interface FailedConv {
  id: string; conversation_id: string; user_id: string; quality_score: number | null;
  completion_status: string; abandon_point: number | null; created_at: string;
  messages: { role: string; content: string }[]; platform: string;
}
interface FailurePattern { label: string; pct: number; example: string; }
interface IntentDetail {
  intent: string; completionBreakdown: Record<string, number>;
  failedConversations: FailedConv[];
  typicalAbandonPoint: number | null; abandonmentAiResponse: string | null;
  failurePatterns: FailurePattern[] | null;
}
interface ApiData { summary: IntentSummary[]; detail: IntentDetail | null; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s.replace(/_/g, " "); }
function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ImpactBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-red-500/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400 w-8 tabular-nums text-right">{score}</span>
    </div>
  );
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-44" />
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-5 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => <Bone key={i} className="h-8" />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntentAnalytics() {
  const [platform, setPlatform] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedConv, setExpandedConv] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platform !== "all") params.set("platform", platform);
    if (selected) params.set("intent", selected);
    fetch(`/api/intents?${params}`)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [platform, selected]);

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

  const { summary, detail } = data;
  const maxImpact = summary[0]?.impactScore ?? 1;

  // Intent health summary
  const good = summary.filter((s) => s.completionRate >= 60).length;
  const attention = summary.filter((s) => s.completionRate >= 40 && s.completionRate < 60).length;
  const critical = summary.filter((s) => s.completionRate < 40).length;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Intent Analytics</h1>
          <p className="text-sm text-zinc-500 mt-0.5">What users are trying to accomplish — ranked by failure impact</p>
        </div>
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setSelected(null); }}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.filter((p) => p !== "all").map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {summary.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center space-y-3">
          <p className="text-zinc-300 font-medium">No analyzed conversations yet</p>
          <p className="text-zinc-500 text-sm">
            Run AI workers to see which intents succeed and which struggle.
          </p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400 text-left max-w-sm mx-auto">
            <p className="text-zinc-600"># Start with a small sample (~$10 est.)</p>
            <p className="text-emerald-500">python -m scripts.test_workers</p>
          </div>
          <p className="text-xs text-zinc-600">
            This will analyze 1,000 conversations and unlock intent breakdown, failure patterns, quality scores, and more.
          </p>
        </div>
      ) : (
        <>
          {/* Health summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70 mb-1">Healthy</p>
              <p className="text-2xl font-bold text-emerald-400">{good}</p>
              <p className="text-xs text-zinc-600 mt-0.5">intents with 60%+ completion</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/70 mb-1">Needs Attention</p>
              <p className="text-2xl font-bold text-amber-400">{attention}</p>
              <p className="text-xs text-zinc-600 mt-0.5">intents with 40–60% completion</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-400">{critical}</p>
              <p className="text-xs text-zinc-600 mt-0.5">intents with &lt;40% completion</p>
            </div>
          </div>

          {/* Summary banner */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-5 py-3.5">
            <p className="text-xs text-amber-400 font-semibold mb-1">Top struggling intents</p>
            <p className="text-sm text-zinc-300">
              {summary.slice(0, 3).map((s, i) => (
                <span key={s.intent}>
                  {i > 0 && ", "}
                  <button
                    onClick={() => setSelected(s.intent === selected ? null : s.intent)}
                    className="text-amber-300 hover:text-white underline underline-offset-2 capitalize"
                  >
                    {cap(s.intent)}
                  </button>
                  {" "}({s.failureRate}% fail rate)
                </span>
              ))}
            </p>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Intent", "Convos", "This week", "Success rate", "Avg quality", "Impact"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.map((row, i) => (
                  <>
                    <tr
                      key={row.intent}
                      onClick={() => setSelected(row.intent === selected ? null : row.intent)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        selected === row.intent ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3 text-zinc-600 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 text-zinc-200 capitalize font-medium">{cap(row.intent)}</td>
                      <td className="px-4 py-3 text-zinc-300 font-mono tabular-nums">{fmt(row.count)}</td>
                      <td className="px-4 py-3 text-zinc-500 font-mono tabular-nums text-xs">{fmt(row.countThisWeek)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-medium ${row.completionRate >= 60 ? "text-emerald-400" : row.completionRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {row.completionRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.avgScore !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-white/[0.06]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${row.avgScore}%`,
                                  backgroundColor: row.avgScore >= 70 ? "#34d399" : row.avgScore >= 50 ? "#fbbf24" : "#f87171",
                                }}
                              />
                            </div>
                            <span className={`font-mono text-xs ${row.avgScore >= 70 ? "text-emerald-400" : row.avgScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                              {row.avgScore}
                            </span>
                          </div>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <ImpactBar score={row.impactScore} max={maxImpact} />
                      </td>
                    </tr>

                    {/* Detail panel */}
                    {selected === row.intent && detail && detail.intent === row.intent && (
                      <tr key={`${row.intent}-detail`} className="bg-[#0f101a]">
                        <td colSpan={7} className="px-6 py-5">
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                            {/* Completion pie */}
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Completion breakdown</p>
                              <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                  <Pie
                                    data={Object.entries(detail.completionBreakdown).map(([k, v]) => ({ name: k, value: v }))}
                                    cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                    paddingAngle={3} dataKey="value"
                                  >
                                    {Object.keys(detail.completionBreakdown).map((k) => (
                                      <Cell key={k} fill={STATUS_COLORS[k] ?? "#6b7280"} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
                                    formatter={(v: number | undefined) => [fmt(v ?? 0), ""]}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="space-y-1 mt-1">
                                {Object.entries(detail.completionBreakdown).map(([k, v]) => (
                                  <div key={k} className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[k] ?? "#6b7280" }} />
                                      <span className="text-zinc-400 capitalize">{k}</span>
                                    </span>
                                    <span className="text-zinc-300 font-mono">{fmt(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Failure patterns + abandon point */}
                            <div className="space-y-4">
                              {detail.failurePatterns && detail.failurePatterns.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Common failure patterns</p>
                                  <div className="space-y-2">
                                    {detail.failurePatterns.map((fp, idx) => (
                                      <div key={idx} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs text-zinc-200 font-medium">{fp.label}</span>
                                          <span className={`text-xs font-mono ${idx === 0 ? "text-red-400" : idx === 1 ? "text-amber-400" : "text-zinc-400"}`}>{fp.pct}%</span>
                                        </div>
                                        {fp.example && <p className="text-[10px] text-zinc-600 italic truncate">&ldquo;{fp.example}&rdquo;</p>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {detail.typicalAbandonPoint !== null && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Drop-off point</p>
                                  <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                                    <p className="text-sm text-zinc-300">
                                      Users typically give up after message{" "}
                                      <span className="text-amber-400 font-mono">{detail.typicalAbandonPoint}</span>
                                    </p>
                                    {detail.abandonmentAiResponse && (
                                      <blockquote className="mt-2 border-l-2 border-amber-500/40 pl-3 text-xs text-zinc-500 italic line-clamp-3">
                                        {detail.abandonmentAiResponse}
                                      </blockquote>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Failed conversations */}
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Recent failures</p>
                              <div className="space-y-2">
                                {detail.failedConversations.map((conv) => (
                                  <div key={conv.id} className="bg-white/[0.03] rounded-lg border border-white/[0.05] overflow-hidden">
                                    <button
                                      className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2"
                                      onClick={() => setExpandedConv(expandedConv === conv.id ? null : conv.id)}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: PLATFORM_COLORS[conv.platform] ?? "#6b7280" }}
                                        />
                                        <span className="text-xs text-zinc-400 truncate">{fmtDate(conv.created_at)}</span>
                                        <span className="text-xs text-zinc-600 capitalize">{PLATFORM_LABELS[conv.platform] ?? conv.platform}</span>
                                      </span>
                                      <span className="flex items-center gap-2 shrink-0">
                                        {conv.quality_score !== null && (
                                          <span className="text-xs font-mono text-red-400">{conv.quality_score}</span>
                                        )}
                                        <span className="text-zinc-600 text-xs">{expandedConv === conv.id ? "▲" : "▼"}</span>
                                      </span>
                                    </button>
                                    {expandedConv === conv.id && (
                                      <div className="border-t border-white/[0.05] px-3 py-3 space-y-2 max-h-48 overflow-y-auto">
                                        {(conv.messages ?? []).slice(0, 6).map((m, mi) => (
                                          <div key={mi} className={`text-xs ${m.role === "user" ? "text-zinc-300" : "text-zinc-500"}`}>
                                            <span className="font-medium">{m.role === "user" ? "User" : "AI"}: </span>
                                            {m.content.slice(0, 200)}{m.content.length > 200 ? "…" : ""}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
