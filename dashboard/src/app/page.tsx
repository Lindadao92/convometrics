"use client";

import { useEffect, useState, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";

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

interface PlatformStat { platform: string; total: number; analyzed: number; avgQuality: number | null; completionRate: number | null; }
interface ApiData {
  stats: { total: number; analyzed: number; avgQuality: number | null; completionRate: number | null; failureRate: number | null; avgTurns: number | null; totalMessages: number; topTopic: string | null; };
  healthScore: number | null;
  byPlatform: PlatformStat[];
  turnDistribution: { label: string; count: number }[];
  qualityDistribution: { label: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  topPerformingTopics: { intent: string; avgQuality: number; count: number; completionRate: number }[];
  worstPerformingTopics: { intent: string; avgQuality: number; count: number; failRate: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Health Score Gauge ───────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number | null }) {
  const r = 58, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  const arcPct = 0.75;
  const arcLen = circ * arcPct;
  const trackDash = `${arcLen} ${circ - arcLen}`;
  const fillLen = score !== null ? arcLen * (score / 100) : 0;
  const fillDash = `${fillLen} ${circ - fillLen}`;
  const rotation = -225;
  const color =
    score === null ? "#3f3f46" :
    score >= 80 ? "#22c55e" :
    score >= 60 ? "#84cc16" :
    score >= 40 ? "#eab308" : "#ef4444";

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}
        strokeDasharray={trackDash} transform={`rotate(${rotation} ${cx} ${cy})`} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={fillDash} transform={`rotate(${rotation} ${cx} ${cy})`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize={30} fontWeight="bold" fontFamily="inherit">
        {score !== null ? score : "?"}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#71717a" fontSize={10} fontFamily="inherit">
        Health Score
      </text>
      {score === null && (
        <text x={cx} y={cy + 28} textAnchor="middle" fill="#52525b" fontSize={9} fontFamily="inherit">
          Run analysis
        </text>
      )}
    </svg>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-28 rounded-xl" />
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <Bone key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Bone className="h-52 rounded-xl" /><Bone className="h-52 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Bone className="h-52 rounded-xl" /><Bone className="h-52 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const { profile, editableName, editableDescription, setEditableName, setEditableDescription } = useProductProfile();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [draftName, setDraftName] = useState(editableName);
  const [draftDesc, setDraftDesc] = useState(editableDescription);
  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    // Collapse the about card after first visit
    const seen = localStorage.getItem("convometrics_about_seen");
    if (seen) setCollapsed(true);
    else localStorage.setItem("convometrics_about_seen", "1");
  }, []);

  useEffect(() => { setDraftName(editableName); }, [editableName]);
  useEffect(() => { setDraftDesc(editableDescription); }, [editableDescription]);
  useEffect(() => { if (editingName) nameRef.current?.focus(); }, [editingName]);
  useEffect(() => { if (editingDesc) descRef.current?.focus(); }, [editingDesc]);

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

  const { stats, healthScore, byPlatform, turnDistribution, qualityDistribution, statusBreakdown, topPerformingTopics, worstPerformingTopics } = data;
  const analyzedPct = stats.total > 0 ? Math.round((stats.analyzed / stats.total) * 100) : 0;
  const hasAnalyzed = stats.analyzed > 0;

  // Funnel/donut data
  const funnelData = statusBreakdown.map(({ status, count }) => ({
    name: status.replace(/_/g, " "),
    value: count,
    fill: STATUS_COLORS[status] ?? "#6b7280",
  }));

  // Volume chart: by platform if multi-platform, else just turn distribution
  const isMultiPlatform = (profile?.platforms?.length ?? 0) > 1;
  const volumeData = isMultiPlatform
    ? byPlatform.map((d) => ({ name: PLATFORM_LABELS[d.platform] ?? d.platform, count: d.total, platform: d.platform }))
    : turnDistribution;

  return (
    <div className="p-8 max-w-7xl space-y-6">

      {/* ── About this dataset card ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-zinc-300">About this dataset</span>
          </div>
          <svg className={`w-4 h-4 text-zinc-600 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {!collapsed && (
          <div className="px-5 pb-5 border-t border-white/[0.05] pt-4 space-y-3">
            {/* Editable name */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Dataset Name</p>
              {editingName ? (
                <input
                  ref={nameRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => { setEditableName(draftName); setEditingName(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setEditableName(draftName); setEditingName(false); } if (e.key === "Escape") { setDraftName(editableName); setEditingName(false); } }}
                  className="w-full bg-[#0f101a] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
                />
              ) : (
                <button onClick={() => setEditingName(true)} className="text-base font-semibold text-white hover:text-zinc-200 text-left group flex items-center gap-2">
                  {editableName}
                  <svg className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {/* Editable description */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Description</p>
              {editingDesc ? (
                <textarea
                  ref={descRef}
                  value={draftDesc}
                  rows={3}
                  onChange={(e) => setDraftDesc(e.target.value)}
                  onBlur={() => { setEditableDescription(draftDesc); setEditingDesc(false); }}
                  className="w-full bg-[#0f101a] border border-white/[0.12] rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              ) : (
                <button onClick={() => setEditingDesc(true)} className="text-sm text-zinc-400 hover:text-zinc-300 text-left group flex items-start gap-2 w-full">
                  <span>{editableDescription}</span>
                  <svg className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
            </div>
            {/* Date range */}
            {profile?.dateRange && (profile.dateRange.start || profile.dateRange.end) && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Date Range</p>
                <p className="text-sm text-zinc-400">
                  {profile.dateRange.start ? fmtDate(profile.dateRange.start) : "—"}
                  {" "}–{" "}
                  {profile.dateRange.end ? fmtDate(profile.dateRange.end) : "—"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Health Score + Key metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Health Score gauge */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5 flex flex-col items-center justify-center">
          <HealthGauge score={healthScore} />
          {!hasAnalyzed && (
            <p className="text-[10px] text-zinc-600 mt-2 text-center">Run analysis to calculate</p>
          )}
          {hasAnalyzed && healthScore !== null && (
            <p className="text-[10px] text-zinc-500 mt-1 text-center">
              {healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Needs work" : "Critical"}
            </p>
          )}
        </div>

        {/* Key metrics 2×3 grid */}
        <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Conversations" value={fmt(stats.total)} />
          <StatCard label="Analyzed" value={fmt(stats.analyzed)} sub={`${analyzedPct}% of total`} />
          <StatCard label="Avg Quality" value={stats.avgQuality !== null ? `${stats.avgQuality}/100` : "—"} sub={hasAnalyzed ? "AI-scored" : "run analysis"} />
          <StatCard label="Completion Rate" value={stats.completionRate !== null ? `${stats.completionRate}%` : "—"} />
          <StatCard label="Avg Turns" value={stats.avgTurns !== null ? stats.avgTurns : "—"} sub="per conversation" />
          <StatCard label="Top Topic" value={stats.topTopic ? cap(stats.topTopic) : "—"} sub="by volume" />
        </div>
      </div>

      {/* Analysis progress bar */}
      {stats.analyzed < stats.total && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">
              Analysis progress — <span className="text-white font-mono">{fmt(stats.analyzed)}</span>
              <span className="text-zinc-600"> of {fmt(stats.total)} conversations analyzed</span>
            </span>
            <span className="text-xs font-mono text-zinc-500">{analyzedPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.max(analyzedPct, 0.5)}%` }} />
          </div>
          {stats.analyzed === 0 && (
            <p className="text-xs text-zinc-500 mt-2">
              Run <code className="text-zinc-300 bg-white/[0.06] px-1 rounded">python -m scripts.test_workers</code> to start analyzing conversations.
            </p>
          )}
        </div>
      )}

      {/* ── What's Working / What's Not ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* What's Working */}
        <div className="rounded-xl border border-emerald-500/10 bg-[#13141b] p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">What&apos;s Working</p>
          </div>
          <p className="text-xs text-zinc-600 mb-4">Top 3 highest-performing topics by quality score</p>
          {!hasAnalyzed ? (
            <div className="flex items-center justify-center h-24 flex-col gap-2">
              <p className="text-sm text-zinc-600">Run AI workers to discover</p>
              <p className="text-[10px] text-zinc-700">Topics will appear here after analysis</p>
            </div>
          ) : topPerformingTopics.length === 0 ? (
            <p className="text-sm text-zinc-600">No topics with sufficient data yet</p>
          ) : (
            <div className="space-y-3">
              {topPerformingTopics.map((t, i) => (
                <div key={t.intent} className="flex items-center gap-3">
                  <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-sm text-zinc-200 capitalize flex-1">{cap(t.intent)}</span>
                  <span className="text-xs font-mono text-emerald-400">{t.avgQuality}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What's Not */}
        <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70">What&apos;s Not</p>
          </div>
          <p className="text-xs text-zinc-600 mb-4">Top 3 worst-performing topics by quality score</p>
          {!hasAnalyzed ? (
            <div className="flex items-center justify-center h-24 flex-col gap-2">
              <p className="text-sm text-zinc-600">Run AI workers to discover</p>
              <p className="text-[10px] text-zinc-700">Failure patterns will appear here after analysis</p>
            </div>
          ) : worstPerformingTopics.length === 0 ? (
            <p className="text-sm text-zinc-600">No topics with sufficient data yet</p>
          ) : (
            <div className="space-y-3">
              {worstPerformingTopics.map((t, i) => (
                <div key={t.intent} className="flex items-center gap-3">
                  <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-sm text-zinc-200 capitalize flex-1">{cap(t.intent)}</span>
                  <span className={`text-xs font-mono font-medium ${t.avgQuality < 40 ? "text-red-400" : "text-amber-400"}`}>{t.avgQuality}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── At a Glance 2×2 grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. Volume by platform / turn distribution */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            {isMultiPlatform ? "Conversations by Platform" : "Conversation Length Distribution"}
          </p>
          <p className="text-xs text-zinc-600 mb-4">
            {isMultiPlatform ? "Total conversation volume per AI platform" : "Distribution of conversation turn counts across all conversations"}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeData} layout={isMultiPlatform ? "vertical" : "horizontal"}
              margin={isMultiPlatform ? { left: 8, right: 24, top: 0, bottom: 0 } : { top: 0, right: 8, bottom: 0, left: 0 }}>
              {isMultiPlatform ? (
                <>
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} width={76} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {(volumeData as { platform: string }[]).map((d) => (
                      <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6366f1"} />
                    ))}
                  </Bar>
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52} fill="#6366f1" />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Conversation depth */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Conversation Depth Distribution</p>
          <p className="text-xs text-zinc-600 mb-4">How many turns per conversation — shows whether users have brief or extended exchanges</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={turnDistribution} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52} fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Quality distribution */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Quality Distribution</p>
          <p className="text-xs text-zinc-600 mb-4">
            {hasAnalyzed ? "How quality scores are distributed — skew left = AI struggles, right = AI excels" : "Run analysis to see quality distribution"}
          </p>
          {!hasAnalyzed ? (
            <div className="flex items-center justify-center h-48 flex-col gap-3 text-zinc-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm">Run analysis workers to unlock</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={qualityDistribution} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
                  {qualityDistribution.map((entry) => {
                    const label = entry.label;
                    const fill = label.startsWith("81") ? "#22c55e" : label.startsWith("61") ? "#84cc16" : label.startsWith("41") ? "#eab308" : label.startsWith("21") ? "#f97316" : "#ef4444";
                    return <Cell key={label} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 4. Completion funnel */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Completion Funnel</p>
          <p className="text-xs text-zinc-600 mb-4">
            {hasAnalyzed ? "Breakdown of conversation outcomes — completed, failed, abandoned, in progress" : "Run analysis to see completion breakdown"}
          </p>
          {!hasAnalyzed || funnelData.length === 0 ? (
            <div className="flex items-center justify-center h-48 flex-col gap-3 text-zinc-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
              <p className="text-sm">Run analysis workers to unlock</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={funnelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={70} strokeWidth={0}>
                    {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined, name: string | undefined) => [fmt(v ?? 0), name ?? ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {funnelData.map((d) => {
                  const total = funnelData.reduce((a, b) => a + b.value, 0);
                  const pct = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="text-xs text-zinc-300 capitalize flex-1">{d.name}</span>
                      <span className="text-xs font-mono text-zinc-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
