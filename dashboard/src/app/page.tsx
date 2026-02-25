"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import { StatCard } from "@/components/StatCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { DIMENSIONS, SIGNALS, SATISFACTION_META, InferredSatisfaction, dimColor } from "@/lib/mockQualityData";

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

interface QualityScoresData {
  overallScore: number | null;
  scoreDelta: number | null;
  dimensions: { key: string; label: string; weight: number; color: string; score: number | null }[];
  trendData: Record<string, string | number | null>[];
  total: number;
}

interface TopFailureItem {
  key: string; label: string; icon: string; color: string;
  thisWeek: number; lastWeek: number; delta: number; isAlert: boolean;
}
interface FailureTaxonomyData { topThisWeek: TopFailureItem[]; }

interface SegmentMeta {
  keyInsight: string;
  briefing: string[];
  name: string;
  emoji: string;
}

interface ModelComparisonSummary {
  modelA: string; modelB: string;
  overall: { scoreA: number; scoreB: number; delta: number };
  regressions: { dimension: string; intent: string | null }[];
}

interface OutcomesData {
  retentionCurve: { qualityBin: string; retentionPct: number }[];
  retentionMultiplier: number;
  revenueTable: { intent: string; sessionsPerWeek: number; successRate: number; estMonthlyImpact: number }[];
  churnRisk: { atRiskCount: number; totalLtvAtRisk: number };
}

interface SafetyData {
  summary: {
    flaggedCount: number; flaggedPct: number; cleanPct: number;
    incidentsThisWeek: number; incidentsLastWeek: number; safetyScore: number;
  };
}

interface SatDistItem {
  key: InferredSatisfaction;
  label: string;
  color: string;
  count: number;
  pct: number;
}
interface SatisfactionData {
  distribution: SatDistItem[];
  topFrustrationSignals: { key: string; label: string; emoji: string; color: string; count: number }[];
  total: number;
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
    score >= 75 ? "#22c55e" :
    score >= 55 ? "#eab308" :
    score >= 40 ? "#f97316" : "#ef4444";

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

// ─── Skeleton bone ────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

// ─── Quality Score Hero ───────────────────────────────────────────────────────

function QualityScoreHero({ data }: { data: QualityScoresData }) {
  const { overallScore, scoreDelta, total } = data;
  const color = dimColor(overallScore);
  const trendUp = scoreDelta !== null && scoreDelta > 0;
  const trendDown = scoreDelta !== null && scoreDelta < 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5 flex flex-col justify-between">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Conversation Quality Score
        </p>
        <div className="flex items-end gap-2">
          <span className="text-7xl font-bold tabular-nums leading-none" style={{ color }}>
            {overallScore ?? "—"}
          </span>
          <div className="mb-1.5 flex flex-col items-start gap-1">
            <span className="text-xl text-zinc-500">/100</span>
            {scoreDelta !== null && (
              <span className={`flex items-center gap-0.5 text-sm font-medium ${trendUp ? "text-emerald-400" : trendDown ? "text-red-400" : "text-zinc-500"}`}>
                {trendUp ? "↑" : trendDown ? "↓" : "→"}
                {Math.abs(scoreDelta)} pts
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.05]">
        <p className="text-[10px] text-zinc-600">
          Weighted composite · {total > 0 ? `${fmt(total)} conversations` : "no data"}
        </p>
        <p className="text-[10px] text-zinc-700 mt-0.5">
          Helpfulness 25% · Relevance 20% · Accuracy 20%
        </p>
      </div>
    </div>
  );
}

// ─── Dimension Bar Chart ──────────────────────────────────────────────────────

function DimensionChart({ data }: { data: QualityScoresData }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
        Quality Dimensions
      </p>
      <p className="text-xs text-zinc-600 mb-5">
        Average score across 7 quality axes — identifies where AI excels or needs work
      </p>
      <div className="space-y-3">
        {data.dimensions.map((d) => (
          <div key={d.key} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-24 shrink-0 capitalize">{d.label}</span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${d.score ?? 0}%`,
                  backgroundColor: dimColor(d.score),
                }}
              />
            </div>
            <span
              className="text-xs font-mono w-8 text-right shrink-0"
              style={{ color: dimColor(d.score) }}
            >
              {d.score ?? "—"}
            </span>
          </div>
        ))}
      </div>
      {/* Weight legend */}
      <div className="mt-4 pt-3 border-t border-white/[0.05] flex flex-wrap gap-x-3 gap-y-1">
        {DIMENSIONS.map((d) => (
          <span key={d.key} className="text-[10px] text-zinc-700">
            <span style={{ color: d.color }}>●</span> {d.label} {Math.round(d.weight * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Quality Trend Sparkline ──────────────────────────────────────────────────

function QualityTrend({ trendData }: { trendData: Record<string, string | number | null>[] }) {
  const hasData = trendData.some((d) => d.overall !== null);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Quality Trend
        </p>
        <span className="text-[10px] text-zinc-700">Last 30 days</span>
      </div>
      <p className="text-xs text-zinc-600 mb-4">
        Composite quality score over time — track whether AI performance is improving
      </p>
      {!hasData ? (
        <div className="flex items-center justify-center h-16 text-zinc-700 text-xs">No trend data</div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#52525b", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              interval={5}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#52525b", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={22}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: unknown) => [v != null ? `${v}/100` : "—", "Quality Score"]}
            />
            <Line
              type="monotone"
              dataKey="overall"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Satisfaction Section ──────────────────────────────────────────────────────

function SatisfactionSection({ sat }: { sat: SatisfactionData }) {
  const { distribution, topFrustrationSignals, total } = sat;
  const satisfiedItem  = distribution.find(d => d.key === "satisfied");
  const frustratedItem = distribution.find(d => d.key === "frustrated");
  const abandonedItem  = distribution.find(d => d.key === "abandoned");
  const negPct = ((frustratedItem?.count ?? 0) + (abandonedItem?.count ?? 0)) / Math.max(total, 1) * 100;

  // Build donut data
  const donutData = distribution.map(d => ({ name: d.label, value: d.count, fill: d.color }));

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
            Inferred Satisfaction
          </p>
          <p className="text-xs text-zinc-600">
            Estimated from behavioral signals — no surveys or explicit feedback required
          </p>
        </div>
        <span className="text-[10px] font-mono text-zinc-600">{fmt(total)} conversations</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Donut + legend */}
        <div className="flex items-center gap-5">
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={38} outerRadius={58} strokeWidth={0}>
                {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE}
                formatter={(v: number | undefined, name: string | undefined) => [
                  `${v ?? 0} (${total > 0 ? Math.round(((v ?? 0) / total) * 100) : 0}%)`, name ?? "",
                ]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {distribution.map(d => (
              <div key={d.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-zinc-300 w-20">{d.label}</span>
                <span className="text-xs font-mono text-zinc-400">{d.pct}%</span>
                <span className="text-[10px] font-mono text-zinc-600">({fmt(d.count)})</span>
              </div>
            ))}
          </div>
        </div>

        {/* 97% callout */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.08] p-4 flex-1">
            <p className="text-5xl font-black text-indigo-300 leading-none">97%</p>
            <p className="text-sm font-semibold text-indigo-200 mt-1.5">of conversations analyzed</p>
            <p className="text-xs text-indigo-400/60 mt-0.5">via behavioral signal inference</p>
            <div className="mt-3 pt-3 border-t border-indigo-500/20 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-500">3%</span>
              <span className="text-xs text-zinc-600">explicit feedback (industry avg)</span>
            </div>
          </div>
          {negPct > 0 && (
            <div className="rounded-lg border border-red-500/10 bg-red-500/[0.05] px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Negative experience rate</span>
              <span className="text-sm font-bold font-mono text-red-400">{Math.round(negPct)}%</span>
            </div>
          )}
        </div>

        {/* Top frustration signals */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">
            Top frustration signals
          </p>
          {topFrustrationSignals.length === 0 ? (
            <p className="text-xs text-zinc-700">No frustration signals detected</p>
          ) : (
            <div className="space-y-2.5">
              {topFrustrationSignals.map(sig => {
                const maxCount = topFrustrationSignals[0].count;
                const pct = maxCount > 0 ? (sig.count / maxCount) * 100 : 0;
                return (
                  <div key={sig.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-zinc-300">
                        {sig.emoji} {sig.label}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">{fmt(sig.count)}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sig.color + "aa" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {satisfiedItem && (
            <div className="mt-4 pt-3 border-t border-white/[0.05]">
              <p className="text-[10px] text-zinc-600">
                <span className="text-emerald-400 font-semibold">{satisfiedItem.pct}%</span> of users are satisfied ·{" "}
                opportunity to improve the other <span className="text-amber-400 font-semibold">{Math.round(100 - satisfiedItem.pct)}%</span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Outcomes Section ─────────────────────────────────────────────────────────

const TOOLTIP_STYLE_LOCAL = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

function OutcomesSection({ data, isCompanion = false }: { data: OutcomesData; isCompanion?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-base">📈</span>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Quality → Business Results</p>
        </div>
        <p className="text-xs text-zinc-600 mt-0.5">How conversation quality drives retention and revenue</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-white/[0.06]">
        {/* Left: Retention curve */}
        <div className="xl:col-span-3 p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-300 mb-0.5">30-Day Retention Rate by Quality Score</p>
            <p className="text-[10px] text-zinc-600">Higher quality conversations drive significantly better retention</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.retentionCurve} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="qualityBin" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE_LOCAL} formatter={(v: number | undefined) => [`${v ?? 0}%`, "30-day retention"]} />
              <Line type="monotone" dataKey="retentionPct" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
          {/* Callout */}
          <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/20 px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-amber-400 text-sm shrink-0 mt-0.5">⭐</span>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Users with quality <span className="font-semibold text-amber-300">&gt; 75</span> retain at{" "}
              <span className="font-bold text-amber-300 text-sm">{data.retentionMultiplier}×</span> the rate of users with quality{" "}
              <span className="font-semibold text-amber-300">&lt; 50</span>
            </p>
          </div>
        </div>

        {/* Right: Revenue impact table */}
        <div className="xl:col-span-2 p-5 space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-300 mb-0.5">{isCompanion ? "Subscriber Churn Risk by Intent" : "Revenue Impact of +10pp Success Rate"}</p>
            <p className="text-[10px] text-zinc-600">{isCompanion ? "Estimated monthly subscriber churn risk per intent" : "Estimated monthly recovery per intent"}</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sess/wk</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{isCompanion ? "Retain" : "Success"}</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{isCompanion ? "Risk/mo" : "Impact/mo"}</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueTable.map((row) => (
                <tr key={row.intent} className="border-b border-white/[0.03]">
                  <td className="py-2 text-zinc-300 capitalize max-w-[100px] truncate">{cap(row.intent)}</td>
                  <td className="py-2 text-right text-zinc-500 font-mono">{row.sessionsPerWeek}</td>
                  <td className="py-2 text-right text-zinc-500 font-mono">{row.successRate}%</td>
                  <td className={`py-2 text-right font-mono font-semibold ${isCompanion ? "text-red-400" : "text-emerald-400"}`}>${row.estMonthlyImpact.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-zinc-700 leading-relaxed">{isCompanion ? "Estimated monthly subscriber churn risk from low-quality conversations per intent" : "Based on improving success rate by +10 percentage points per intent, applied to monthly volume"}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Churn Risk Card ──────────────────────────────────────────────────────────

function ChurnRiskCard({ churnRisk }: { churnRisk: OutcomesData["churnRisk"] }) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-[#13141b] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/80">Churn Risk</p>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-red-300">{fmt(churnRisk.atRiskCount)}</p>
        <p className="text-xs text-zinc-400">high-value users at risk this week</p>
      </div>
      <div className="rounded-lg bg-red-500/[0.07] border border-red-500/15 px-3 py-2">
        <p className="text-[10px] text-red-300/70">Total LTV at risk</p>
        <p className="text-base font-bold text-red-300 font-mono">${churnRisk.totalLtvAtRisk.toLocaleString()}</p>
      </div>
      <a href="/conversations" className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors mt-auto">
        View at-risk conversations
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ─── Safety Indicator Card ────────────────────────────────────────────────────

function SafetyIndicatorCard({ summary }: { summary: SafetyData["summary"] }) {
  const trend = summary.incidentsThisWeek < summary.incidentsLastWeek ? "↓" : summary.incidentsThisWeek > summary.incidentsLastWeek ? "↑" : "→";
  const trendColor = summary.incidentsThisWeek < summary.incidentsLastWeek ? "text-emerald-400" : summary.incidentsThisWeek > summary.incidentsLastWeek ? "text-red-400" : "text-zinc-500";
  const diff = Math.abs(summary.incidentsThisWeek - summary.incidentsLastWeek);
  return (
    <div className="rounded-xl border border-emerald-500/15 bg-[#13141b] p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400/80">Safety</p>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-emerald-300">{summary.cleanPct.toFixed(1)}% clean</p>
        <p className="text-xs text-zinc-400">conversations within safety thresholds</p>
      </div>
      <div className="rounded-lg bg-white/[0.04] border border-white/[0.07] px-3 py-2">
        <p className="text-[10px] text-zinc-500">Incidents this week</p>
        <p className="text-base font-bold text-zinc-300 font-mono flex items-center gap-1.5">
          {summary.incidentsThisWeek}
          <span className={`text-xs font-normal ${trendColor}`}>{trend}{diff} from last week</span>
        </p>
      </div>
      <a href="/safety" className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors mt-auto">
        View Safety & Compliance
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ─── Segment Insight Card ─────────────────────────────────────────────────────

function SegmentInsightCard({ meta }: { meta: SegmentMeta }) {
  return (
    <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{meta.emoji}</span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/80">
          {meta.name} · Key Insight
        </p>
      </div>
      <p className="text-sm font-semibold text-indigo-100 mb-4 leading-snug">{meta.keyInsight}</p>
      <div className="border-t border-indigo-500/15 pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">This period</p>
        {meta.briefing.map((line, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-indigo-400/60 mt-0.5 shrink-0">·</span>
            <p className="text-xs text-zinc-400 leading-relaxed">{line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Top Failures Card ────────────────────────────────────────────────────────

function TopFailuresCard({ failures }: { failures: TopFailureItem[] }) {
  const hasAlert = failures.some((f) => f.isAlert);
  return (
    <div className={`rounded-xl border bg-[#13141b] p-5 ${hasAlert ? "border-red-500/20" : "border-white/[0.07]"}`}>
      <div className="flex items-center gap-2 mb-1">
        {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Failures This Week</p>
      </div>
      <p className="text-xs text-zinc-600 mb-4">Most frequent failure patterns · vs. last week</p>
      <div className="space-y-3">
        {failures.slice(0, 3).map((f) => {
          const isUp   = f.delta > 0;
          const isDown = f.delta < 0;
          const arrow  = isUp ? "↑" : isDown ? "↓" : "→";
          const deltaColor = f.isAlert ? "text-red-400" : isUp ? "text-amber-400" : isDown ? "text-emerald-400" : "text-zinc-600";
          return (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-base w-5 shrink-0">{f.icon}</span>
              <span className="text-sm text-zinc-300 flex-1">{f.label}</span>
              <span className="text-xs font-mono text-zinc-300">{f.thisWeek}</span>
              <span className={`text-xs font-mono font-semibold ${deltaColor} flex items-center gap-0.5`}>
                {arrow}{Math.abs(f.delta)}%
                {f.isAlert && <span className="ml-0.5 text-[8px] bg-red-500/20 text-red-400 px-1 rounded">!</span>}
              </span>
            </div>
          );
        })}
      </div>
      {failures.length === 0 && (
        <p className="text-sm text-zinc-600 text-center py-4">No failures detected this week</p>
      )}
    </div>
  );
}

// ─── Model Comparison Widget ──────────────────────────────────────────────────

function ModelComparisonWidget({ compare }: { compare: ModelComparisonSummary }) {
  const { modelA, modelB, overall, regressions } = compare;
  const hasRegressions = regressions.length > 0;
  const deltaPos = overall.delta > 0;

  return (
    <div className={`rounded-xl border bg-[#13141b] p-5 ${hasRegressions ? "border-amber-500/20" : "border-white/[0.07]"}`}>
      <div className="flex items-center gap-2 mb-1">
        {hasRegressions && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Model Comparison</p>
      </div>
      <p className="text-xs text-zinc-600 mb-4">{modelA} → {modelB} · scripted demo comparison</p>

      {/* Score delta */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl font-black font-mono text-zinc-400">{overall.scoreA}</span>
        <span className="text-zinc-600">→</span>
        <span className="text-2xl font-black font-mono text-zinc-300">{overall.scoreB}</span>
        <span className={`text-lg font-bold font-mono ml-1 ${deltaPos ? "text-emerald-400" : "text-red-400"}`}>
          ({deltaPos ? "+" : ""}{overall.delta} pts)
        </span>
      </div>

      {/* Regression alert */}
      {hasRegressions && (
        <div className="flex items-center gap-2 mb-4 rounded-lg border border-amber-500/15 bg-amber-500/[0.07] px-3 py-1.5">
          <span className="text-amber-400 text-sm">⚠</span>
          <span className="text-xs text-amber-200 font-medium">
            {regressions.length} regression{regressions.length > 1 ? "s" : ""} detected
          </span>
        </div>
      )}

      <a
        href="/compare"
        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        View full comparison
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ─── Character.ai companion constants ─────────────────────────────────────────

const CHAR_TYPE_DATA = [
  { label: "Anime / Fiction",      pct: 35, count: 875,  color: "#8b5cf6" },
  { label: "Original Character",   pct: 25, count: 625,  color: "#6366f1" },
  { label: "Celebrity",            pct: 15, count: 375,  color: "#3b82f6" },
  { label: "Therapist / Advisor",  pct: 10, count: 250,  color: "#06b6d4" },
  { label: "Romantic Partner",     pct: 8,  count: 200,  color: "#ec4899" },
  { label: "Historical",           pct: 4,  count: 100,  color: "#f59e0b" },
  { label: "Game Character",       pct: 3,  count: 75,   color: "#22c55e" },
];

const ENGAGEMENT_FUNNEL_DATA = [
  { label: "Started conversation",       pct: 100, count: 2500, color: "#6366f1" },
  { label: "Engaged (10+ turns)",        pct: 67,  count: 1675, color: "#8b5cf6" },
  { label: "Deep engagement (30+ turns)", pct: 35, count: 875,  color: "#a855f7" },
  { label: "Returned within 24h",        pct: 52,  count: 1300, color: "#ec4899" },
];

const COMPANION_DIMS = [
  { key: "naturalness",  label: "Naturalness",  score: 76, weight: 0.05, color: "#8b5cf6" },
  { key: "safety",       label: "Safety",       score: 71, weight: 0.05, color: "#22c55e" },
  { key: "coherence",    label: "Coherence",    score: 70, weight: 0.15, color: "#6366f1" },
  { key: "relevance",    label: "Relevance",    score: 68, weight: 0.20, color: "#3b82f6" },
  { key: "satisfaction", label: "Satisfaction", score: 67, weight: 0.10, color: "#10b981" },
  { key: "helpfulness",  label: "Helpfulness",  score: 63, weight: 0.25, color: "#f59e0b" },
  { key: "accuracy",     label: "Accuracy",     score: 59, weight: 0.20, color: "#ef4444" },
];

const COMPANION_QUALITY_DIST = [
  { label: "0–20",   count: 25  },
  { label: "21–40",  count: 75  },
  { label: "41–60",  count: 375 },
  { label: "61–80",  count: 1375},
  { label: "81–100", count: 650 },
];

const COMPANION_TREND = Array.from({ length: 30 }, (_, i) => ({
  date: (() => { const d = new Date("2026-01-25"); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); })(),
  overall: 66 + Math.round((i / 29) * 3) + (i % 5 === 2 ? 1 : i % 7 === 4 ? -1 : 0),
}));

const COMPANION_QUALITY_DATA: QualityScoresData = {
  overallScore: 69,
  scoreDelta: 1,
  dimensions: COMPANION_DIMS,
  trendData: COMPANION_TREND,
  total: 2500,
};

const COMPANION_WHAT_WORKS = [
  { intent: "humor_entertainment", avgQuality: 77 },
  { intent: "casual_chat",         avgQuality: 76 },
  { intent: "creative_storytelling", avgQuality: 74 },
];

const COMPANION_WHAT_DOESNT = [
  { intent: "advice_seeking",    avgQuality: 59, note: "" },
  { intent: "learning_exploration", avgQuality: 63, note: "" },
  { intent: "emotional_support", avgQuality: 65, note: "high volume — critical" },
];

const COMPANION_BRIEFING_BULLETS = [
  "Overall conversation quality held steady at 69 (↑1 from last week)",
  "emotional_support intent has the highest frustration rate (34%) — tone_break failures are the primary cause. Users in crisis moments are getting cheerful or dismissive responses.",
  "character_break failures increased 18% this week, concentrated in Anime/Fiction characters on the Flash model.",
  "Biggest opportunity: Fix tone_break in emotional_support. 450 sessions/week, only 58% satisfaction. Improving this could reduce churn risk for ~120 daily active users.",
  "Power users are 2.8× more likely to have high-quality roleplay experiences than new users — onboarding quality gap is widening.",
];

// ─── Monday Morning Briefing Card ─────────────────────────────────────────────

function MondayBriefingCard() {
  return (
    <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.04] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-sm font-semibold text-white">Weekly AI Briefing</p>
            <p className="text-[10px] text-indigo-400/70">Feb 17–23, 2026 · auto-generated</p>
          </div>
        </div>
        <a href="/report" className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30 rounded-lg px-2.5 py-1">
          Full report →
        </a>
      </div>
      <div className="space-y-2.5">
        {COMPANION_BRIEFING_BULLETS.map((line, i) => {
          const isAlert = line.includes("highest frustration") || line.includes("Biggest opportunity");
          const isWarn  = line.includes("increased 18%");
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`text-xs mt-0.5 shrink-0 ${isAlert ? "text-amber-400" : isWarn ? "text-red-400" : "text-indigo-400/60"}`}>
                {isAlert ? "⚠" : isWarn ? "↑" : "·"}
              </span>
              <p className={`text-xs leading-relaxed ${isAlert ? "text-amber-100/80" : "text-zinc-400"}`}>{line}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Companion Churn Risk Card ─────────────────────────────────────────────────

function CompanionChurnRiskCard() {
  return (
    <div className="rounded-xl border border-red-500/20 bg-[#13141b] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400/80">Daily Active Users at Risk</p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-3xl font-bold text-red-300 font-mono">87</p>
          <p className="text-xs text-zinc-500 mt-0.5">DAUs at risk this week</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-zinc-400 mb-2.5">Had 2+ frustrated conversations · concentrated in:</p>
          <div className="space-y-1.5">
            {[
              { label: "emotional_support", count: 41, color: "#f87171" },
              { label: "roleplay (context_loss)", count: 29, color: "#fb923c" },
              { label: "other intents", count: 17, color: "#71717a" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${(row.count / 41) * 100}%`, backgroundColor: row.color + "aa" }} />
                </div>
                <span className="text-[10px] text-zinc-500 capitalize w-36 truncate">{row.label}</span>
                <span className="text-[10px] font-mono text-zinc-400 w-5 text-right">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <a href="/conversations" className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors mt-4">
        View at-risk conversations
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </div>
  );
}

// ─── Character Type Chart ──────────────────────────────────────────────────────

function CharacterTypeChart() {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Conversations by Character Type</p>
      <p className="text-xs text-zinc-600 mb-4">Distribution across character categories — 2,500 conversations</p>
      <div className="space-y-2.5">
        {CHAR_TYPE_DATA.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-36 shrink-0">{row.label}</span>
            <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.pct}%`, backgroundColor: row.color }} />
            </div>
            <span className="text-xs font-mono text-zinc-400 w-8 text-right shrink-0">{row.pct}%</span>
            <span className="text-[10px] text-zinc-600 w-12 text-right shrink-0">{fmt(row.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Engagement Funnel Card ────────────────────────────────────────────────────

function EngagementFunnelCard() {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement Depth Funnel</p>
      <p className="text-xs text-zinc-600 mb-5">How deeply users engage — more meaningful than completion for companion products</p>
      <div className="space-y-3">
        {ENGAGEMENT_FUNNEL_DATA.map((row, i) => (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-300">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold" style={{ color: row.color }}>{row.pct}%</span>
                <span className="text-[10px] text-zinc-600">{fmt(row.count)}</span>
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${row.pct}%`, backgroundColor: row.color + (i === 0 ? "99" : "cc") }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.05]">
        <p className="text-[10px] text-zinc-700">
          <span className="text-indigo-400 font-semibold">52%</span> of engaged users return within 24 hours — strong retention signal
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const { profile } = useProductProfile();
  const { segment } = useDemoMode();
  const [data, setData] = useState<ApiData | null>(null);
  const [qualityData, setQualityData] = useState<QualityScoresData | null>(null);
  const [satData, setSatData] = useState<SatisfactionData | null>(null);
  const [failureData, setFailureData] = useState<FailureTaxonomyData | null>(null);
  const [compareData, setCompareData] = useState<ModelComparisonSummary | null>(null);
  const [outcomesData, setOutcomesData] = useState<OutcomesData | null>(null);
  const [safetyData, setSafetyData] = useState<SafetyData | null>(null);
  const [segmentMeta, setSegmentMeta] = useState<SegmentMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCompanion = segment === "ai_companion";

  useEffect(() => {
    const seg = segment;
    const sp = seg ? `&segment=${seg}` : "";
    Promise.all([
      fetch(`/api/overview${seg ? `?segment=${seg}` : ""}`).then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))),
      fetch(`/api/quality-scores?days=30${sp}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/satisfaction?days=30${sp}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/failure-taxonomy?days=14${sp}`).then((r) => r.ok ? r.json() : null),
      fetch("/api/model-comparison").then((r) => r.ok ? r.json() : null),
      fetch(`/api/outcomes${seg ? `?segment=${seg}` : ""}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/safety${seg ? `?segment=${seg}` : ""}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([overview, quality, satisfaction, failures, compare, outcomes, safety]) => {
        setData(overview);
        setQualityData(quality);
        setSatData(satisfaction);
        setFailureData(failures);
        setCompareData(compare);
        setOutcomesData(outcomes);
        setSafetyData(safety);
        setSegmentMeta(overview?.segmentMeta ?? null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment]);

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

  // For companion: use hardcoded data; for other segments: use API data
  const effectiveQuality = isCompanion ? COMPANION_QUALITY_DATA : qualityData;
  const effectiveHealthScore = isCompanion ? 68 : healthScore;
  const effectiveQualityDist = isCompanion ? COMPANION_QUALITY_DIST : qualityDistribution;

  const funnelData = statusBreakdown.map(({ status, count }) => ({
    name: status.replace(/_/g, " "),
    value: count,
    fill: STATUS_COLORS[status] ?? "#6b7280",
  }));

  const isMultiPlatform = !isCompanion && (profile?.platforms?.length ?? 0) > 1;
  const volumeData = isMultiPlatform
    ? byPlatform.map((d) => ({ name: PLATFORM_LABELS[d.platform] ?? d.platform, count: d.total, platform: d.platform }))
    : turnDistribution;

  const healthLabel = (s: number | null) => {
    if (s === null) return null;
    if (s >= 80) return "Excellent";
    if (s >= 70) return "Good";
    if (s >= 60) return "Fair";
    if (s >= 40) return "Needs work";
    return "Critical";
  };

  const topWorking = isCompanion ? COMPANION_WHAT_WORKS : topPerformingTopics.map(t => ({ intent: t.intent, avgQuality: t.avgQuality }));
  const topNotWorking = isCompanion ? COMPANION_WHAT_DOESNT : worstPerformingTopics.map(t => ({ intent: t.intent, avgQuality: t.avgQuality, note: "" }));

  return (
    <div className="p-8 max-w-7xl space-y-6">

      {/* ── Monday Morning Briefing (companion) ─────────────────────────────── */}
      {isCompanion && <MondayBriefingCard />}

      {/* ── Companion Churn Risk banner (companion) ──────────────────────────── */}
      {isCompanion && <CompanionChurnRiskCard />}

      {/* ── Health Score + Key metrics ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5 flex flex-col items-center justify-center">
          <HealthGauge score={effectiveHealthScore} />
          {effectiveHealthScore !== null && (
            <p className="text-[10px] text-zinc-500 mt-1 text-center">
              {healthLabel(effectiveHealthScore)}
            </p>
          )}
        </div>

        <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total Conversations" value={isCompanion ? "2,500" : fmt(stats.total)} />
          <StatCard label="Analyzed" value={isCompanion ? "2,500" : fmt(stats.analyzed)} sub={isCompanion ? "100% of total" : `${analyzedPct}% of total`} />
          <StatCard label="Avg Quality" value={isCompanion ? "69/100" : (stats.avgQuality !== null ? `${stats.avgQuality}/100` : "—")} sub="AI-scored" />
          {isCompanion
            ? <StatCard label="Engagement Rate" value="67%" sub="10+ turn conversations" />
            : <StatCard label="Completion Rate" value={stats.completionRate !== null ? `${stats.completionRate}%` : "—"} />
          }
          <StatCard label="Avg Turns" value={isCompanion ? "25" : (stats.avgTurns !== null ? stats.avgTurns : "—")} sub="per conversation" />
          <StatCard label="Top Intent" value={isCompanion ? "Roleplay" : (stats.topTopic ? cap(stats.topTopic) : "—")} sub={isCompanion ? "28% of sessions" : "by volume"} />
        </div>
      </div>

      {/* Analysis progress bar removed — all conversations fully analyzed */}

      {/* ── Conversation Quality Score ───────────────────────────────────────── */}
      {effectiveQuality && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <QualityScoreHero data={effectiveQuality} />
            <div className="xl:col-span-2">
              <DimensionChart data={effectiveQuality} />
            </div>
          </div>
          <QualityTrend trendData={effectiveQuality.trendData} />
        </>
      )}

      {/* ── Satisfaction Section ─────────────────────────────────────────────── */}
      {satData && <SatisfactionSection sat={satData} />}

      {/* ── Segment Insight ─────────────────────────────────────────────────── */}
      {segmentMeta && <SegmentInsightCard meta={segmentMeta} />}

      {/* ── Outcomes: Quality → Business Results ─────────────────────────────── */}
      {outcomesData && <OutcomesSection data={outcomesData} isCompanion={isCompanion} />}

      {/* ── Top Failures + Model Comparison + Churn Risk + Safety ────────────── */}
      {(failureData?.topThisWeek.length || compareData || (!isCompanion && outcomesData?.churnRisk.atRiskCount) || safetyData) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {failureData && failureData.topThisWeek.length > 0 && (
            <TopFailuresCard failures={failureData.topThisWeek} />
          )}
          {compareData && (
            <ModelComparisonWidget compare={compareData} />
          )}
          {!isCompanion && outcomesData && outcomesData.churnRisk.atRiskCount > 0 && (
            <ChurnRiskCard churnRisk={outcomesData.churnRisk} />
          )}
          {safetyData && (
            <SafetyIndicatorCard summary={safetyData.summary} />
          )}
        </div>
      )}

      {/* ── What's Working / What's Not ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-emerald-500/10 bg-[#13141b] p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">What&apos;s Working</p>
          </div>
          <p className="text-xs text-zinc-600 mb-4">Top intents by quality score</p>
          {topWorking.length === 0 ? (
            <p className="text-sm text-zinc-600">No topics with sufficient data yet</p>
          ) : (
            <div className="space-y-3">
              {topWorking.map((t, i) => (
                <div key={t.intent} className="flex items-center gap-3">
                  <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-sm text-zinc-200 capitalize flex-1">{cap(t.intent)}</span>
                  <span className="text-xs font-mono text-emerald-400">{t.avgQuality}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70">What&apos;s Not</p>
          </div>
          <p className="text-xs text-zinc-600 mb-4">
            {isCompanion ? "Intents with highest frustration · high volume = urgent" : "Worst-performing topics by quality score"}
          </p>
          {topNotWorking.length === 0 ? (
            <p className="text-sm text-zinc-600">No topics with sufficient data yet</p>
          ) : (
            <div className="space-y-3">
              {topNotWorking.map((t, i) => (
                <div key={t.intent} className="flex items-center gap-3">
                  <span className="text-zinc-700 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-sm text-zinc-200 capitalize flex-1">{cap(t.intent)}</span>
                  {"note" in t && t.note
                    ? <span className="text-[10px] text-amber-500/80 italic mr-1">{t.note}</span>
                    : null}
                  <span className={`text-xs font-mono font-medium ${t.avgQuality < 60 ? "text-red-400" : "text-amber-400"}`}>{t.avgQuality}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── At a Glance 2×2 grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 1. Character type (companion) or Platform/Turn distribution */}
        {isCompanion ? <CharacterTypeChart /> : (
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
              {isMultiPlatform ? "Conversations by Platform" : "Conversation Length Distribution"}
            </p>
            <p className="text-xs text-zinc-600 mb-4">
              {isMultiPlatform ? "Total conversation volume per AI platform" : "Distribution of conversation turn counts"}
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
        )}

        {/* 2. Conversation depth */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Conversation Depth Distribution</p>
          <p className="text-xs text-zinc-600 mb-4">
            {isCompanion ? "Turn count distribution — companion users have long, immersive sessions" : "How many turns per conversation — brief vs extended exchanges"}
          </p>
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
            How quality scores are distributed — skew left = AI struggles, right = AI excels
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={effectiveQualityDist} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={52}>
                {effectiveQualityDist.map((entry) => {
                  const label = entry.label;
                  const fill = (label.startsWith("81") || label.startsWith("80") || label === "81–100" || label.startsWith("76") || label === "76–100")
                    ? "#22c55e"
                    : (label.startsWith("61") || label === "61–80" || label.startsWith("56") || label === "56–75")
                    ? "#eab308"
                    : (label.startsWith("41") || label === "41–60" || label === "40–55")
                    ? "#f97316"
                    : "#ef4444";
                  return <Cell key={label} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 4. Engagement Funnel (companion) or Completion Funnel */}
        {isCompanion ? <EngagementFunnelCard /> : (
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Completion Funnel</p>
            <p className="text-xs text-zinc-600 mb-4">
              {hasAnalyzed ? "Breakdown of conversation outcomes" : "Run analysis to see completion breakdown"}
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
        )}
      </div>
    </div>
  );
}
