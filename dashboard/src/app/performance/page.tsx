"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, CartesianGrid, ScatterChart, Scatter, ZAxis,
  AreaChart, Area,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import { DIMENSIONS, dimColor } from "@/lib/mockQualityData";

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
const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

// ─── Companion Constants ──────────────────────────────────────────────────────

const COMPANION_QUALITY_TREND_30D = [
  { date: "Jan 24", quality: 67 }, { date: "Jan 25", quality: 68 }, { date: "Jan 26", quality: 67 },
  { date: "Jan 27", quality: 69 }, { date: "Jan 28", quality: 70 }, { date: "Jan 29", quality: 68 },
  { date: "Jan 30", quality: 67 }, { date: "Jan 31", quality: 65 }, { date: "Feb 1",  quality: 66 },
  { date: "Feb 2",  quality: 67 }, { date: "Feb 3",  quality: 68 }, { date: "Feb 4",  quality: 69 },
  { date: "Feb 5",  quality: 67 }, { date: "Feb 6",  quality: 64 }, { date: "Feb 7",  quality: 66 },
  { date: "Feb 8",  quality: 68 }, { date: "Feb 9",  quality: 69 }, { date: "Feb 10", quality: 70 },
  { date: "Feb 11", quality: 71 }, { date: "Feb 12", quality: 69 }, { date: "Feb 13", quality: 70 },
  { date: "Feb 14", quality: 72 }, { date: "Feb 15", quality: 71 }, { date: "Feb 16", quality: 70 },
  { date: "Feb 17", quality: 71 }, { date: "Feb 18", quality: 74 }, { date: "Feb 19", quality: 72 },
  { date: "Feb 20", quality: 71 }, { date: "Feb 21", quality: 70 }, { date: "Feb 22", quality: 69 },
];

const COMPANION_DIM_BASE: Record<string, number> = {
  helpfulness: 63, relevance: 68, accuracy: 59,
  coherence: 70, satisfaction: 67, naturalness: 76, safety: 71,
};
const COMPANION_DIM_CHANGES: Record<string, number> = {
  helpfulness: 2, relevance: 1, accuracy: -2,
  coherence: 1, satisfaction: -1, naturalness: 2, safety: -1,
};
const COMPANION_DIM_BEST: Record<string, string> = {
  helpfulness: "casual chat", relevance: "roleplay", accuracy: "humor & entertainment",
  coherence: "roleplay", satisfaction: "humor & entertainment",
  naturalness: "humor & entertainment", safety: "casual chat",
};
const COMPANION_DIM_WORST: Record<string, string> = {
  helpfulness: "companionship", relevance: "philosophical discussion", accuracy: "advice seeking",
  coherence: "creative storytelling", satisfaction: "advice seeking",
  naturalness: "learning exploration", safety: "emotional support",
};

// Generate 30-day dimension trend data
const _DATES_30D = [
  "Jan 24","Jan 25","Jan 26","Jan 27","Jan 28","Jan 29","Jan 30","Jan 31",
  "Feb 1","Feb 2","Feb 3","Feb 4","Feb 5","Feb 6","Feb 7","Feb 8","Feb 9",
  "Feb 10","Feb 11","Feb 12","Feb 13","Feb 14","Feb 15","Feb 16","Feb 17",
  "Feb 18","Feb 19","Feb 20","Feb 21","Feb 22",
];
const COMPANION_DIM_TREND: Record<string, string | number | null>[] = _DATES_30D.map((date, i) => {
  const entry: Record<string, string | number | null> = { date };
  Object.entries(COMPANION_DIM_BASE).forEach(([k, base], ki) => {
    const jitter = Math.round(Math.sin(i * 1.3 + ki * 2.7) * 2.5);
    entry[k] = Math.min(100, Math.max(0, base + jitter));
  });
  return entry;
});

const COMPANION_ENGAGEMENT_TREND = _DATES_30D.map((date, i) => ({
  date,
  engRate:    Math.min(75, Math.max(58, 63 + Math.round(i * 0.13 + Math.sin(i * 1.8) * 2.5))),
  deepRate:   Math.min(30, Math.max(16, 20 + Math.round(i * 0.1  + Math.sin(i * 2.1) * 1.5))),
  returnRate: Math.min(48, Math.max(34, 38 + Math.round(i * 0.1  + Math.sin(i * 1.5) * 2))),
}));

const COMPANION_ENGAGEMENT_BY_INTENT = [
  { label: "Roleplay",                 engRate: 82, deepRate: 31, returnRate: 45 },
  { label: "Philosophical Discussion", engRate: 79, deepRate: 38, returnRate: 48 },
  { label: "Creative Storytelling",    engRate: 76, deepRate: 29, returnRate: 40 },
  { label: "Emotional Support",        engRate: 71, deepRate: 28, returnRate: 52 },
  { label: "Companionship",            engRate: 65, deepRate: 19, returnRate: 44 },
  { label: "Casual Chat",              engRate: 58, deepRate: 12, returnRate: 38 },
  { label: "Learning & Exploration",   engRate: 55, deepRate: 14, returnRate: 31 },
  { label: "Humor & Entertainment",    engRate: 52, deepRate:  9, returnRate: 35 },
  { label: "Advice Seeking",           engRate: 48, deepRate:  8, returnRate: 29 },
];

const COMPANION_ENGAGEMENT_BY_MODEL = [
  { model: "Brainiac", engRate: 74, deepRate: 28, returnRate: 47, quality: 71, color: "#6366f1" },
  { model: "Prime",    engRate: 69, deepRate: 23, returnRate: 42, quality: 68, color: "#22c55e" },
  { model: "Flash",    engRate: 61, deepRate: 18, returnRate: 36, quality: 63, color: "#f59e0b" },
];

const COMPANION_FIX_PRIORITIES = [
  {
    rank: 1, urgency: "critical", icon: "😤", color: "#ef4444",
    title: "Tone breaks in emotional_support",
    detail: "AI reverts to clinical/formal tone mid-conversation when users are most vulnerable.",
    metrics: ["450 sessions/wk", "34% frustration rate", "120 DAUs at churn risk"],
  },
  {
    rank: 2, urgency: "high", icon: "🎭", color: "#f97316",
    title: "Character breaks on Flash model",
    detail: "Increased 18% this week. Concentrated in Anime and Fiction character types.",
    metrics: ["+18% this week", "Flash model only", "Anime & Fiction chars"],
  },
  {
    rank: 3, urgency: "high", icon: "🔀", color: "#f59e0b",
    title: "Context loss in long roleplay sessions",
    detail: "Conversations over 50 turns have 3× the context_loss rate vs shorter sessions.",
    metrics: [">50 turns affected", "3× context_loss rate", "700 sessions/wk"],
  },
  {
    rank: 4, urgency: "medium", icon: "🌀", color: "#8b5cf6",
    title: "Hallucinated advice in advice_seeking",
    detail: "Accuracy score of 48 — the lowest of any intent category by a significant margin.",
    metrics: ["Accuracy: 48/100", "200 sessions/wk", "58% satisfaction"],
  },
  {
    rank: 5, urgency: "medium", icon: "⚠️", color: "#6366f1",
    title: "Safety gaps in emotional_support",
    detail: "5% of emotional_support conversations have safety concerns — potential regulatory risk.",
    metrics: ["5% of sessions", "Regulatory risk", "450 sessions/wk"],
  },
];

const MODEL_DIMS = DIMENSIONS.map((d) => d.key);
const COMPANION_MODEL_SCORES: Record<string, Record<string, number>> = {
  Brainiac: { helpfulness: 67, relevance: 72, accuracy: 63, coherence: 73, satisfaction: 71, naturalness: 79, safety: 75, overall: 71 },
  Prime:    { helpfulness: 63, relevance: 69, accuracy: 59, coherence: 70, satisfaction: 68, naturalness: 76, safety: 72, overall: 68 },
  Flash:    { helpfulness: 56, relevance: 63, accuracy: 52, coherence: 66, satisfaction: 62, naturalness: 72, safety: 67, overall: 63 },
};
// p<0.05 significance for Brainiac vs Flash
const BRAINIAC_FLASH_SIG = new Set(["helpfulness", "accuracy", "satisfaction", "overall"]);
const BRAINIAC_PRIME_SIG = new Set(["helpfulness", "accuracy"]);

const COMPANION_SAMPLE_CONVOS = {
  brainiacBetter: [
    {
      id: "conv-7821", turns: 22, brainiacQ: 81, flashQ: 58,
      intent: "Emotional Support",
      summary: "Brainiac maintained a warm, attuned persona for all 22 turns. Flash reverted to clinical, advice-heavy language at turn 12 when the user disclosed anxiety.",
    },
    {
      id: "conv-4453", turns: 38, brainiacQ: 76, flashQ: 54,
      intent: "Roleplay",
      summary: "Brainiac tracked 5 established character relationships across 38 turns. Flash lost track of the antagonist's backstory at turn 18, breaking the narrative.",
    },
    {
      id: "conv-2287", turns: 9, brainiacQ: 72, flashQ: 50,
      intent: "Advice Seeking",
      summary: "Brainiac appropriately hedged relationship advice with caveats. Flash made an overconfident claim about a psychological concept that was factually incorrect.",
    },
  ],
  flashComparable: [
    {
      id: "conv-9914", turns: 6, brainiacQ: 78, flashQ: 75,
      intent: "Casual Chat",
      summary: "Both models achieved similar warmth and engagement in this short, low-complexity session. Quality gap: only 3 points.",
    },
    {
      id: "conv-6642", turns: 8, brainiacQ: 74, flashQ: 76,
      intent: "Humor & Entertainment",
      summary: "Flash actually edged Brainiac here — better comedic timing and more playful callbacks. Flash's faster response style suited the humor format.",
    },
    {
      id: "conv-3371", turns: 7, brainiacQ: 77, flashQ: 73,
      intent: "Companionship",
      summary: "Both models maintained consistent persona well in this straightforward session. Flash performed within 4 points of Brainiac.",
    },
  ],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PerformanceData {
  qualityDistribution: { label: string; count: number }[];
  qualityByTopic: { intent: string; avgQuality: number; count: number }[];
  qualityByPlatform: { platform: string; avgQuality: number | null; completionRate: number | null; count: number }[];
  qualityByTurns: { group: string; avgQuality: number | null; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  completionByTopic: { intent: string; completionRate: number; count: number }[];
  abandonmentHistogram: { turn: number; count: number }[];
  impactMatrix: { intent: string; count: number; failureRate: number; avgQuality: number | null; qualityGap: number; impactScore: number }[];
  fixFirst: { intent: string; count: number; failureRate: number; avgQuality: number | null; qualityGap: number; impactScore: number; examples: string[] }[];
  total: number;
  insights: { qualityDrop: string | null; abandonment: string | null; topFix: string | null };
}

interface QualityScoresData {
  overallScore: number | null;
  scoreDelta: number | null;
  dimensions: { key: string; label: string; weight: number; color: string; score: number | null }[];
  trendData: Record<string, string | number | null>[];
  dimensionBreakdown: {
    key: string; label: string; weight: number;
    currentAvg: number | null; last7Avg: number | null; sevenDayChange: number | null;
    bestIntent: string; worstIntent: string;
  }[];
  intents: string[];
  models: string[];
  total: number;
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
      <Bone className="h-8 w-48" />
      <div className="flex gap-2"><Bone className="h-9 w-28 rounded-lg" /><Bone className="h-9 w-36 rounded-lg" /><Bone className="h-9 w-28 rounded-lg" /></div>
      <Bone className="h-64 rounded-xl" />
      <Bone className="h-72 rounded-xl" />
    </div>
  );
}

function AutoInsight({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 flex items-start gap-3">
      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p className="text-sm text-amber-200">{text}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-[#13141b] p-5 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">{title}</p>
      <p className="text-xs text-zinc-600 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

// ─── Companion: Quality Overview Tab ─────────────────────────────────────────

function CompanionQualityOverviewTab() {
  const best  = COMPANION_QUALITY_TREND_30D.reduce((a, b) => b.quality > a.quality ? b : a);
  const worst = COMPANION_QUALITY_TREND_30D.reduce((a, b) => b.quality < a.quality ? b : a);
  const first = COMPANION_QUALITY_TREND_30D[0].quality;
  const last  = COMPANION_QUALITY_TREND_30D[COMPANION_QUALITY_TREND_30D.length - 1].quality;
  const delta = last - first;

  return (
    <div className="space-y-6">
      {/* 30-day trendline */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Overall Quality — 30-Day Trend</p>
        <p className="text-xs text-zinc-600 mb-4">Composite quality score across all 7 dimensions, daily average</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={COMPANION_QUALITY_TREND_30D} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="qualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
              interval={Math.floor(COMPANION_QUALITY_TREND_30D.length / 7)} />
            <YAxis domain={[55, 80]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}/100`, "Quality"]} />
            <Area type="monotone" dataKey="quality" stroke="#6366f1" strokeWidth={2}
              fill="url(#qualGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Best day */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📈</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-500">Best Day</p>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{best.quality}<span className="text-base text-zinc-500">/100</span></p>
          <p className="text-xs font-semibold text-zinc-300 mb-1">{best.date}</p>
          <p className="text-xs text-zinc-500">Roleplay volume surged +22%. High engagement sessions drove composite score up. Flash model was offline, all traffic on Brainiac.</p>
        </div>

        {/* Worst day */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📉</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Worst Day</p>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{worst.quality}<span className="text-base text-zinc-500">/100</span></p>
          <p className="text-xs font-semibold text-zinc-300 mb-1">{worst.date}</p>
          <p className="text-xs text-zinc-500">Flash model rollout caused character breaks +18%. Emotional support tone failures spiked. Coherence and satisfaction dimensions both dropped 6 pts.</p>
        </div>

        {/* Trend */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{delta >= 0 ? "⬆️" : "⬇️"}</span>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400">30-Day Trend</p>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            <span className={delta >= 0 ? "text-green-400" : "text-red-400"}>{delta >= 0 ? "+" : ""}{delta} pts</span>
          </p>
          <p className="text-xs font-semibold text-zinc-300 mb-1">{first} → {last}</p>
          <p className="text-xs text-zinc-500">Naturalness and Helpfulness improved. Accuracy still declining — advice_seeking hallucinations up week-on-week. Flash model dragging composite score.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Quality Overview (non-companion) ──────────────────────────────────

function QualityTab({ data, isMultiPlatform }: { data: PerformanceData; isMultiPlatform: boolean }) {
  const qColors = (label: string) =>
    label.startsWith("81") ? "#22c55e" : label.startsWith("61") ? "#84cc16" :
    label.startsWith("41") ? "#eab308" : label.startsWith("21") ? "#f97316" : "#ef4444";

  return (
    <div className="space-y-6">
      {data.insights.qualityDrop && <AutoInsight text={data.insights.qualityDrop} />}

      <ChartCard title="Quality Score Distribution"
        subtitle="Distribution of AI quality scores — skew left = AI struggles, skew right = AI excels">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.qualityDistribution} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Conversations"]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.qualityDistribution.map((entry) => <Cell key={entry.label} fill={qColors(entry.label)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Quality by Topic"
        subtitle="Topics sorted worst to best — red = needs improvement, green = performing well">
        {data.qualityByTopic.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">No topic quality data available yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.qualityByTopic.length * 28)}>
            <BarChart data={data.qualityByTopic.map((d) => ({ ...d, label: cap(d.intent).slice(0, 30) }))}
              layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={180} tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}/100`, "Avg Quality"]} />
              <Bar dataKey="avgQuality" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {data.qualityByTopic.map((entry) => <Cell key={entry.intent} fill={qualityColor(entry.avgQuality)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {isMultiPlatform && data.qualityByPlatform.length > 0 && (
        <ChartCard title="Quality by Platform"
          subtitle="Average quality score per AI platform">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.qualityByPlatform.map((d) => ({ ...d, label: PLATFORM_LABELS[d.platform] ?? d.platform }))}
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}/100`, "Avg Quality"]} />
              <Bar dataKey="avgQuality" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {data.qualityByPlatform.map((d) => <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6366f1"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {data.qualityByTurns.length > 0 && (
        <ChartCard title="Quality by Conversation Length"
          subtitle="Does AI quality drop in longer conversations?">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.qualityByTurns.map((d) => ({ group: d.group, quality: d.avgQuality }))}
              margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="group" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}/100`, "Avg Quality"]} />
              <Line type="monotone" dataKey="quality" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ─── Companion: Engagement Analysis Tab ──────────────────────────────────────

function EngagementAnalysisTab() {
  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Engagement Rate", value: "67%", sub: "conversations with 10+ turns", color: "#6366f1", detail: "+4pp vs last 30 days" },
          { label: "Deep Engagement", value: "23%", sub: "conversations with 30+ turns", color: "#22c55e", detail: "+3pp vs last 30 days" },
          { label: "Return Rate",     value: "41%", sub: "returned within 24 hours",     color: "#f59e0b", detail: "+2pp vs last 30 days" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">{s.label}</p>
            <p className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-zinc-500 mb-1">{s.sub}</p>
            <p className="text-[10px] text-green-400">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* Engagement over time */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement Over Time</p>
        <p className="text-xs text-zinc-600 mb-4">Daily % of sessions reaching engagement thresholds — 30 days</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={COMPANION_ENGAGEMENT_TREND} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
              interval={Math.floor(COMPANION_ENGAGEMENT_TREND.length / 7)} />
            <YAxis domain={[10, 80]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v}%`} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [
              `${v}%`,
              name === "engRate" ? "Engagement (10+ turns)" :
              name === "deepRate" ? "Deep (30+ turns)" : "Return Rate (24h)",
            ]} />
            <Line type="monotone" dataKey="engRate"    stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="deepRate"   stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="returnRate" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-6 mt-3 pt-3 border-t border-white/[0.05]">
          {[
            { color: "#6366f1", label: "Engagement Rate (10+ turns)" },
            { color: "#22c55e", label: "Deep Engagement (30+ turns)" },
            { color: "#f59e0b", label: "Return Rate (24h)", dashed: true },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`w-5 h-0.5 inline-block ${l.dashed ? "border-t border-dashed" : ""}`}
                style={{ backgroundColor: l.dashed ? undefined : l.color, borderColor: l.dashed ? l.color : undefined }} />
              <span className="text-[10px] text-zinc-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Engagement by intent */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Engagement by Intent</p>
          <p className="text-xs text-zinc-600 mt-0.5">Which intents drive the deepest engagement and highest return rates?</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Intent", "Engaged (10+ turns)", "Deep (30+ turns)", "Return Rate (24h)"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPANION_ENGAGEMENT_BY_INTENT.map((row) => (
              <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.label}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.engRate}%` }} />
                    </div>
                    <span className="text-xs font-mono text-indigo-400">{row.engRate}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.deepRate * 3}%` }} />
                    </div>
                    <span className="text-xs font-mono text-emerald-400">{row.deepRate}%</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-mono ${row.returnRate >= 44 ? "text-yellow-400" : "text-zinc-400"}`}>
                    {row.returnRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Engagement by model */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement by Model Version</p>
        <p className="text-xs text-zinc-600 mb-4">Brainiac drives significantly higher engagement and return rates vs Flash</p>
        <div className="grid grid-cols-3 gap-4">
          {COMPANION_ENGAGEMENT_BY_MODEL.map((m) => (
            <div key={m.model} className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                <span className="text-sm font-semibold text-white">{m.model}</span>
              </div>
              {[
                { label: "Quality", value: `${m.quality}/100`, color: qualityColor(m.quality) },
                { label: "Engagement", value: `${m.engRate}%`, color: m.color },
                { label: "Deep Eng.", value: `${m.deepRate}%`, color: m.color },
                { label: "Return Rate", value: `${m.returnRate}%`, color: m.color },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between items-center py-1 border-b border-white/[0.04] last:border-0">
                  <span className="text-[11px] text-zinc-500">{stat.label}</span>
                  <span className="text-[11px] font-mono font-semibold" style={{ color: stat.color }}>{stat.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Completion Analysis (non-companion) ───────────────────────────────

function CompletionTab({ data, isMultiPlatform }: { data: PerformanceData; isMultiPlatform: boolean }) {
  const total = data.statusBreakdown.reduce((a, b) => a + b.count, 0);
  const donutData = data.statusBreakdown.map(({ status, count }) => ({
    name: cap(status), value: count, fill: STATUS_COLORS[status] ?? "#6b7280",
  }));

  return (
    <div className="space-y-6">
      {data.insights.abandonment && <AutoInsight text={data.insights.abandonment} />}

      <ChartCard title="Conversation Outcomes"
        subtitle="Overall breakdown of how conversations end — completed, failed, abandoned, or in progress">
        {donutData.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">No completion data — run analysis workers.</p>
        ) : (
          <div className="flex items-center gap-8">
            <ResponsiveContainer width="40%" height={200}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={84} strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined, name: string | undefined) => [fmt(v ?? 0), name ?? ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {donutData.map((d) => {
                const pct = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
                return (
                  <div key={d.name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-sm text-zinc-300 flex-1 capitalize">{d.name}</span>
                    <span className="text-sm font-mono text-zinc-300">{pct}%</span>
                    <span className="text-xs text-zinc-600 font-mono w-20 text-right">{fmt(d.value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Completion Rate by Topic"
        subtitle="Topics sorted worst to best completion — low completion means users don't get what they need">
        {data.completionByTopic.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">No topic completion data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.completionByTopic.length * 28)}>
            <BarChart data={data.completionByTopic.map((d) => ({ ...d, label: cap(d.intent).slice(0, 30) }))}
              layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={180} tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Completion Rate"]} />
              <Bar dataKey="completionRate" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {data.completionByTopic.map((d) => (
                  <Cell key={d.intent} fill={d.completionRate >= 70 ? "#22c55e" : d.completionRate >= 50 ? "#eab308" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {isMultiPlatform && data.qualityByPlatform.length > 0 && (
        <ChartCard title="Completion Rate by Platform"
          subtitle="Which AI platform has the highest rate of users successfully achieving their goals?">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.qualityByPlatform.filter((d) => d.completionRate !== null).map((d) => ({ ...d, label: PLATFORM_LABELS[d.platform] ?? d.platform }))}
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Completion Rate"]} />
              <Bar dataKey="completionRate" radius={[4, 4, 0, 0]} maxBarSize={60}>
                {data.qualityByPlatform.map((d) => <Cell key={d.platform} fill={PLATFORM_COLORS[d.platform] ?? "#6366f1"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {data.abandonmentHistogram.length > 0 && (
        <ChartCard title="Abandonment Patterns"
          subtitle="At which turn do users most often give up?">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.abandonmentHistogram} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="turn" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false}
                label={{ value: "Turn #", position: "insideBottomRight", fill: "#52525b", fontSize: 10, dy: 12 }} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmt(v ?? 0), "Abandoned conversations"]}
                labelFormatter={(l) => `Turn ${l}`} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#fbbf24" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ─── Tab 3: Fix Priorities ────────────────────────────────────────────────────

function FixPrioritiesTab({ data, isCompanion }: { data: PerformanceData; isCompanion: boolean }) {
  if (isCompanion) {
    const urgencyColors: Record<string, string> = {
      critical: "#ef4444", high: "#f97316", medium: "#eab308",
    };
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-sm text-amber-200">5 issues ranked by business impact. Items 1–2 require immediate action — each contributes to measurable churn risk.</p>
        </div>

        <div className="space-y-3">
          {COMPANION_FIX_PRIORITIES.map((item) => (
            <div key={item.rank} className="flex items-start gap-4 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.03] transition-colors">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border"
                style={{ backgroundColor: item.color + "20", borderColor: item.color + "40" }}>
                <span className="text-sm font-bold" style={{ color: item.color }}>{item.rank}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1.5">
                  <span className="text-base">{item.icon}</span>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                    style={{ color: urgencyColors[item.urgency], backgroundColor: urgencyColors[item.urgency] + "20" }}>
                    {item.urgency}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-3">{item.detail}</p>
                <div className="flex flex-wrap gap-2">
                  {item.metrics.map((m) => (
                    <span key={m} className="text-[10px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Non-companion: original logic
  const scatterData = data.impactMatrix.slice(0, 40).map((d) => ({
    x: d.failureRate, y: d.count, z: Math.max(d.qualityGap, 10),
    intent: d.intent, impactScore: d.impactScore,
  }));

  return (
    <div className="space-y-6">
      {data.insights.topFix && <AutoInsight text={data.insights.topFix} />}

      <ChartCard title="Impact Matrix"
        subtitle="Top-right = highest priority: high failure rate + high volume. Bubble size = quality gap.">
        {scatterData.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">No impact data — run analysis workers.</p>
        ) : (
          <div className="relative">
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" dataKey="x" name="Failure Rate" domain={[0, 100]}
                  tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                  label={{ value: "Failure Rate (%)", position: "insideBottom", fill: "#52525b", fontSize: 10, dy: 20 }} />
                <YAxis type="number" dataKey="y" name="Volume"
                  tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                  label={{ value: "Conversations", angle: -90, position: "insideLeft", fill: "#52525b", fontSize: 10, dx: -8 }} />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <Tooltip {...TOOLTIP_STYLE}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0]?.payload as typeof scatterData[0] | undefined;
                    if (!d) return null;
                    return (
                      <div style={{ background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                        <p className="font-medium text-white capitalize mb-1">{cap(d.intent)}</p>
                        <p className="text-zinc-400">Failure rate: <span className="text-red-400">{d.x}%</span></p>
                        <p className="text-zinc-400">Volume: <span className="text-white">{fmt(d.y)}</span></p>
                        <p className="text-zinc-400">Impact: <span className="text-amber-400">{fmt(d.impactScore)}</span></p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} fill="#ef4444" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="absolute top-4 right-8 text-[10px] text-red-400/70 font-semibold">Fix First ↗</div>
            <div className="absolute bottom-10 left-6 text-[10px] text-zinc-600 font-semibold">Monitor</div>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Fix These First"
        subtitle="Ranked by impact score = volume × failure rate × quality gap.">
        {data.fixFirst.length === 0 ? (
          <p className="text-sm text-zinc-600 py-4">No priority data — run analysis workers.</p>
        ) : (
          <div className="space-y-4">
            {data.fixFirst.map((item, i) => (
              <div key={item.intent} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-red-400">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <p className="text-sm font-medium text-white capitalize">{cap(item.intent)}</p>
                    <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">{item.failureRate}% fail</span>
                    {item.avgQuality !== null && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: qualityColor(item.avgQuality), backgroundColor: qualityColor(item.avgQuality) + "20" }}>
                        {item.avgQuality}/100
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600 font-mono">{fmt(item.count)} convos</span>
                  </div>
                  {item.examples.length > 0 && (
                    <p className="text-xs text-zinc-600 italic truncate">&ldquo;{item.examples[0]}&rdquo;</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-zinc-600 mb-0.5">Impact</p>
                  <p className="text-sm font-mono font-bold text-amber-400">{fmt(item.impactScore)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

// ─── Tab 4: Quality Dimensions ────────────────────────────────────────────────

function QualityDimensionsTab({ isCompanion }: { isCompanion: boolean }) {
  const { segment } = useDemoMode();
  const [filterIntent, setFilterIntent] = useState("");
  const [filterModel, setFilterModel]   = useState("");
  const [filterDays, setFilterDays]     = useState("30");
  const [qData, setQData] = useState<QualityScoresData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isCompanion) {
      // Build companion qData from constants
      const companionData: QualityScoresData = {
        overallScore: 69,
        scoreDelta: 2,
        dimensions: DIMENSIONS.map((d) => ({ ...d, score: COMPANION_DIM_BASE[d.key] ?? 69 })),
        trendData: COMPANION_DIM_TREND,
        dimensionBreakdown: DIMENSIONS.map((d) => ({
          key: d.key, label: d.label, weight: d.weight,
          currentAvg: COMPANION_DIM_BASE[d.key] ?? 69,
          last7Avg: (COMPANION_DIM_BASE[d.key] ?? 69) - (COMPANION_DIM_CHANGES[d.key] ?? 0),
          sevenDayChange: COMPANION_DIM_CHANGES[d.key] ?? 0,
          bestIntent: COMPANION_DIM_BEST[d.key] ?? "casual chat",
          worstIntent: COMPANION_DIM_WORST[d.key] ?? "advice seeking",
        })),
        intents: ["roleplay", "emotional_support", "casual_chat", "creative_storytelling",
                  "advice_seeking", "companionship", "humor_entertainment", "learning_exploration", "philosophical_discussion"],
        models: ["Brainiac", "Flash", "Prime"],
        total: 2500,
      };
      setQData(companionData);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ days: filterDays });
    if (filterIntent) params.set("intent", filterIntent);
    if (filterModel)  params.set("model",  filterModel);
    if (segment)      params.set("segment", segment);
    fetch(`/api/quality-scores?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setQData(d))
      .finally(() => setLoading(false));
  }, [filterIntent, filterModel, filterDays, segment, isCompanion]);

  const intents = qData?.intents ?? [];
  const models  = qData?.models  ?? ["v2.0", "v2.1"];
  const SELECT_CLS = "bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20";

  return (
    <div className="space-y-6">
      {!isCompanion && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4 flex flex-wrap gap-3 items-center">
          <p className="text-xs text-zinc-500 font-medium mr-1">Filter:</p>
          <select value={filterIntent} onChange={(e) => setFilterIntent(e.target.value)} className={SELECT_CLS}>
            <option value="">All Intent Categories</option>
            {intents.map((i) => <option key={i} value={i}>{cap(i)}</option>)}
          </select>
          <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className={SELECT_CLS}>
            <option value="">All Model Versions</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterDays} onChange={(e) => setFilterDays(e.target.value)} className={SELECT_CLS}>
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          {(filterIntent || filterModel || filterDays !== "30") && (
            <button onClick={() => { setFilterIntent(""); setFilterModel(""); setFilterDays("30"); }}
              className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5">
              Reset filters
            </button>
          )}
          {qData && <span className="ml-auto text-[10px] text-zinc-600">{fmt(qData.total)} conversations</span>}
        </div>
      )}

      {loading ? (
        <div className="space-y-4"><Bone className="h-72 rounded-xl" /><Bone className="h-48 rounded-xl" /></div>
      ) : !qData || qData.total === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-500 text-sm">No data for selected filters</p>
        </div>
      ) : (
        <>
          <ChartCard title="Quality Dimensions Over Time"
            subtitle="Daily average score per dimension — spot which axes are improving or degrading">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qData.trendData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(qData.trendData.length / 8) - 1)} />
                <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={(v: unknown, name: unknown) => [
                    v != null ? `${v}/100` : "—",
                    DIMENSIONS.find((d) => d.key === String(name))?.label ?? String(name),
                  ]}
                />
                {DIMENSIONS.map((d) => (
                  <Line key={d.key} type="monotone" dataKey={d.key} stroke={d.color}
                    strokeWidth={1.5} dot={false} connectNulls name={d.key} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-white/[0.05]">
              {DIMENSIONS.map((d) => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-zinc-500">{d.label}</span>
                  <span className="text-[10px] text-zinc-700">({Math.round(d.weight * 100)}%)</span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard title="Dimension Breakdown"
            subtitle="Per-dimension averages, 7-day change, and best/worst performing intent category">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Dimension", "Weight", "Avg Score", "7-Day Change", "Best Intent", "Worst Intent"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qData.dimensionBreakdown.map((row) => {
                    const dim = DIMENSIONS.find((d) => d.key === row.key);
                    const change = row.sevenDayChange;
                    return (
                      <tr key={row.key} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dim?.color ?? "#6b7280" }} />
                            <span className="text-zinc-200 text-sm">{row.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-500 text-xs font-mono">{Math.round(row.weight * 100)}%</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${row.currentAvg ?? 0}%`, backgroundColor: dimColor(row.currentAvg) }} />
                            </div>
                            <span className="text-xs font-mono" style={{ color: dimColor(row.currentAvg) }}>{row.currentAvg ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {change !== null ? (
                            <span className={`text-xs font-mono font-medium ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-zinc-500"}`}>
                              {change > 0 ? "+" : ""}{change}
                            </span>
                          ) : <span className="text-zinc-600 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-3 text-zinc-400 text-xs capitalize">{row.bestIntent}</td>
                        <td className="px-3 py-3 text-zinc-400 text-xs capitalize">{row.worstIntent}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ─── Tab 5: Satisfaction ──────────────────────────────────────────────────────

interface SatisfactionData {
  distribution: { key: string; label: string; color: string; icon: string; count: number; pct: number }[];
  topFrustrationSignals: { key: string; label: string; emoji: string; color: string; count: number }[];
  dailyTrend: { date: string; satisfied: number | null; frustrated: number | null; neutral: number | null; abandoned: number | null }[];
  byIntent: { intent: string; label: string; satisfiedPct: number; neutralPct: number; frustratedPct: number; abandonedPct: number; negativePct: number; count: number }[];
  intents: string[];
  models: string[];
  total: number;
}

function SatisfactionTab() {
  const { segment } = useDemoMode();
  const [filterIntent, setFilterIntent] = useState("");
  const [filterModel,  setFilterModel]  = useState("");
  const [filterDays,   setFilterDays]   = useState("30");
  const [satData, setSatData] = useState<SatisfactionData | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: filterDays });
    if (filterIntent) params.set("intent", filterIntent);
    if (filterModel)  params.set("model",  filterModel);
    if (segment)      params.set("segment", segment);
    fetch(`/api/satisfaction?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setSatData(d))
      .finally(() => setLoading(false));
  }, [filterIntent, filterModel, filterDays, segment]);

  const intents = satData?.intents ?? [];
  const models  = satData?.models  ?? ["v2.0", "v2.1"];
  const SELECT_CLS = "bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4 flex flex-wrap gap-3 items-center">
        <p className="text-xs text-zinc-500 font-medium mr-1">Filter:</p>
        <select value={filterIntent} onChange={(e) => setFilterIntent(e.target.value)} className={SELECT_CLS}>
          <option value="">All Intent Categories</option>
          {intents.map((i) => <option key={i} value={i}>{cap(i)}</option>)}
        </select>
        <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className={SELECT_CLS}>
          <option value="">All Model Versions</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterDays} onChange={(e) => setFilterDays(e.target.value)} className={SELECT_CLS}>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </select>
        {(filterIntent || filterModel || filterDays !== "30") && (
          <button onClick={() => { setFilterIntent(""); setFilterModel(""); setFilterDays("30"); }}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5">
            Reset filters
          </button>
        )}
        {satData && <span className="ml-auto text-[10px] text-zinc-600">{fmt(satData.total)} conversations</span>}
      </div>

      {loading ? (
        <div className="space-y-4"><Bone className="h-72 rounded-xl" /><Bone className="h-64 rounded-xl" /></div>
      ) : !satData || satData.total === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-500 text-sm">No data for selected filters</p>
        </div>
      ) : (
        <>
          <ChartCard title="Satisfaction Over Time"
            subtitle="Daily % of satisfied vs frustrated conversations">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={satData.dailyTrend} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(satData.dailyTrend.length / 8) - 1)} />
                <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={(v: unknown, name: unknown) => [
                    v != null ? `${v}%` : "—",
                    name === "satisfied" ? "Satisfied" : name === "frustrated" ? "Frustrated (incl. abandoned)" : "Neutral",
                  ]}
                />
                <Line type="monotone" dataKey="satisfied"  stroke="#22c55e" strokeWidth={2}   dot={false} connectNulls name="satisfied" />
                <Line type="monotone" dataKey="frustrated" stroke="#ef4444" strokeWidth={2}   dot={false} connectNulls name="frustrated" />
                <Line type="monotone" dataKey="neutral"    stroke="#71717a" strokeWidth={1.5} dot={false} connectNulls name="neutral" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Satisfaction by Intent"
            subtitle="Stacked 100% bar — intents sorted by highest frustration rate first">
            <ResponsiveContainer width="100%" height={Math.max(220, satData.byIntent.slice(0, 10).length * 34)}>
              <BarChart data={satData.byIntent.slice(0, 10).map((d) => ({ ...d, label: d.label.slice(0, 28) }))}
                layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="label" width={180} tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={(v: unknown, name: unknown) => [
                    `${v}%`,
                    name === "satisfiedPct" ? "Satisfied" : name === "neutralPct" ? "Neutral" :
                    name === "frustratedPct" ? "Frustrated" : "Abandoned",
                  ]}
                />
                <Bar dataKey="satisfiedPct"  stackId="a" fill="#22c55e" fillOpacity={0.80} maxBarSize={22} />
                <Bar dataKey="neutralPct"    stackId="a" fill="#71717a" fillOpacity={0.60} maxBarSize={22} />
                <Bar dataKey="frustratedPct" stackId="a" fill="#f59e0b" fillOpacity={0.85} maxBarSize={22} />
                <Bar dataKey="abandonedPct"  stackId="a" fill="#ef4444" fillOpacity={0.85} maxBarSize={22} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-white/[0.05]">
              {[{ color: "#22c55e", label: "Satisfied" }, { color: "#71717a", label: "Neutral" }, { color: "#f59e0b", label: "Frustrated" }, { color: "#ef4444", label: "Abandoned" }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}

// ─── Tab 6: Model Comparison (companion only) ─────────────────────────────────

function ModelComparisonTab() {
  const [modelA, setModelA] = useState<"Brainiac" | "Flash" | "Prime">("Brainiac");
  const [modelB, setModelB] = useState<"Brainiac" | "Flash" | "Prime">("Flash");

  const models = ["Brainiac", "Flash", "Prime"] as const;
  const scoresA = COMPANION_MODEL_SCORES[modelA];
  const scoresB = COMPANION_MODEL_SCORES[modelB];

  const sigSet = (modelA === "Brainiac" && modelB === "Flash") || (modelA === "Flash" && modelB === "Brainiac")
    ? BRAINIAC_FLASH_SIG
    : (modelA === "Brainiac" && modelB === "Prime") || (modelA === "Prime" && modelB === "Brainiac")
    ? BRAINIAC_PRIME_SIG
    : new Set<string>();

  const radarData = [...MODEL_DIMS, "overall"].map((k) => ({
    dim: DIMENSIONS.find((d) => d.key === k)?.label ?? "Overall",
    [modelA]: scoresA[k],
    [modelB]: scoresB[k],
  }));

  const overallA = scoresA.overall;
  const overallB = scoresB.overall;
  const overallDiff = overallA - overallB;
  const betterModel = overallDiff > 0 ? modelA : modelB;

  return (
    <div className="space-y-6">
      {/* Model selector */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4 flex flex-wrap items-center gap-4">
        <p className="text-xs text-zinc-500 font-medium">Compare:</p>
        <div className="flex items-center gap-2">
          <select value={modelA} onChange={(e) => setModelA(e.target.value as typeof modelA)}
            className="bg-[#0f101a] border border-indigo-500/30 rounded-lg px-3 py-1.5 text-sm text-indigo-300 focus:outline-none focus:border-indigo-500/60">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span className="text-zinc-600 text-sm font-medium">vs</span>
          <select value={modelB} onChange={(e) => setModelB(e.target.value as typeof modelB)}
            className="bg-[#0f101a] border border-amber-500/30 rounded-lg px-3 py-1.5 text-sm text-amber-300 focus:outline-none focus:border-amber-500/60">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Significant improvement (p&lt;0.05)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Significant regression</span>
        </div>
      </div>

      {/* Side-by-side dimension table */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Quality Score Comparison</p>
          <p className="text-xs text-zinc-600 mt-0.5">All 7 dimensions + overall composite</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Dimension</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-indigo-400">{modelA}</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-amber-400">{modelB}</th>
              <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Δ</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Significance</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((row) => {
              const dimKey = DIMENSIONS.find((d) => d.label === row.dim)?.key ?? "overall";
              const vA = row[modelA] as number;
              const vB = row[modelB] as number;
              const diff = vA - vB;
              const isSig = sigSet.has(dimKey);
              const isOverall = row.dim === "Overall";
              return (
                <tr key={row.dim} className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${isOverall ? "bg-white/[0.02]" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!isOverall && (
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: DIMENSIONS.find((d) => d.label === row.dim)?.color ?? "#6b7280" }} />
                      )}
                      <span className={`text-sm ${isOverall ? "font-semibold text-white" : "text-zinc-300"}`}>{row.dim}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm font-semibold" style={{ color: qualityColor(vA) }}>{vA}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-sm font-semibold" style={{ color: qualityColor(vB) }}>{vB}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-mono font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-zinc-500"}`}>
                      {diff > 0 ? "+" : ""}{diff}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isSig ? (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${diff > 0 ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
                        {diff > 0 ? "✓ sig. better" : "✗ sig. worse"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-600">not significant</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Key finding card */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🔍</span>
          <p className="text-xs font-semibold text-indigo-300 uppercase tracking-widest">Key Finding</p>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="text-white font-semibold">{betterModel}</span> scores{" "}
          <span className="text-indigo-300 font-semibold">+{Math.abs(overallDiff)} pts</span> higher than{" "}
          <span className="text-white font-semibold">{overallDiff > 0 ? modelB : modelA}</span> overall, but{" "}
          {modelB === "Flash" || modelA === "Flash"
            ? "Flash handles casual_chat nearly as well (+2 pts difference). The quality gap is concentrated in emotional_support (+14 pts) and advice_seeking (+12 pts) — complex intents benefit most from the deeper model."
            : "the gap is distributed across most dimensions. Helpfulness and Accuracy show the largest divergence — simpler intents like casual_chat perform comparably across all models."}
        </p>
      </div>

      {/* Regression alert */}
      {(modelA === "Flash" || modelB === "Flash") && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 flex items-start gap-3">
          <span className="text-base shrink-0">⚠️</span>
          <p className="text-sm text-zinc-300">
            <span className="text-red-400 font-semibold">Flash has 2.3× more character_break failures than Brainiac in roleplay</span>{" "}
            — concentrated in Anime/Fiction character types. This regression appeared after the Feb 6 Flash model update and has not been resolved.
          </p>
        </div>
      )}

      {/* Sample conversations */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-green-500/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-400">Where Brainiac Wins</p>
            <p className="text-xs text-zinc-600 mt-0.5">Sessions where quality gap is largest</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {COMPANION_SAMPLE_CONVOS.brainiacBetter.map((c) => (
              <div key={c.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono text-zinc-600">{c.id}</span>
                  <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{c.intent}</span>
                  <span className="text-[9px] text-zinc-600 ml-auto">{c.turns} turns</span>
                </div>
                <div className="flex gap-3 mb-2">
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: qualityColor(c.brainiacQ), backgroundColor: qualityColor(c.brainiacQ) + "18" }}>
                    Brainiac {c.brainiacQ}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: qualityColor(c.flashQ), backgroundColor: qualityColor(c.flashQ) + "18" }}>
                    Flash {c.flashQ}
                  </span>
                  <span className="text-[10px] font-semibold text-green-400 ml-auto">+{c.brainiacQ - c.flashQ} pts</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{c.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] bg-amber-500/[0.04]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">Where Flash Is Comparable</p>
            <p className="text-xs text-zinc-600 mt-0.5">Sessions with small or no quality gap</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {COMPANION_SAMPLE_CONVOS.flashComparable.map((c) => (
              <div key={c.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-mono text-zinc-600">{c.id}</span>
                  <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{c.intent}</span>
                  <span className="text-[9px] text-zinc-600 ml-auto">{c.turns} turns</span>
                </div>
                <div className="flex gap-3 mb-2">
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: qualityColor(c.brainiacQ), backgroundColor: qualityColor(c.brainiacQ) + "18" }}>
                    Brainiac {c.brainiacQ}
                  </span>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: qualityColor(c.flashQ), backgroundColor: qualityColor(c.flashQ) + "18" }}>
                    Flash {c.flashQ}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400 ml-auto">
                    {c.brainiacQ - c.flashQ >= 0 ? "+" : ""}{c.brainiacQ - c.flashQ} pts
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{c.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "quality" | "completion" | "fixes" | "dimensions" | "satisfaction" | "model_comparison";

export default function Performance() {
  const { selectedPlatform, profile } = useProductProfile();
  const { segment } = useDemoMode();
  const isCompanion = segment === "ai_companion";

  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("quality");

  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (segment) params.set("segment", segment);
    else if (selectedPlatform !== "all") params.set("platform", selectedPlatform);
    const url = `/api/performance${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedPlatform, segment]);

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

  // Fix: hardcode 69 for companion; otherwise calculate from platform data
  const overallQuality = isCompanion
    ? 69
    : data.qualityByPlatform.length > 0
      ? Math.round(
          data.qualityByPlatform.reduce((s, p) => s + (p.avgQuality ?? 0) * p.count, 0) /
          data.qualityByPlatform.reduce((s, p) => s + p.count, 0)
        ) || null
      : null;

  const totalCounted   = data.statusBreakdown.reduce((a, b) => a + b.count, 0);
  const completedCount = data.statusBreakdown.find((s) => s.status === "completed")?.count ?? 0;
  const overallCompletion = (!isCompanion && totalCounted > 0)
    ? Math.round((completedCount / totalCounted) * 1000) / 10
    : null;

  const hasData = data.total > 0;

  const TABS: { id: Tab; label: string; badge?: string }[] = [
    { id: "quality",    label: "Quality Overview" },
    { id: "completion", label: isCompanion ? "Engagement Analysis" : "Completion Analysis" },
    { id: "fixes",      label: "Fix Priorities" },
    { id: "dimensions", label: "Quality Dimensions" },
    { id: "satisfaction", label: "Satisfaction" },
    ...(isCompanion ? [{ id: "model_comparison" as Tab, label: "Model Comparison", badge: "New" }] : []),
  ];

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Performance</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {isCompanion ? "Quality, engagement, and model comparison for companion AI" : "Deep dive into quality, completion, and failure patterns"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {overallQuality !== null && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Avg Quality</p>
              <p className="text-2xl font-bold" style={{ color: overallQuality >= 70 ? "#22c55e" : overallQuality >= 50 ? "#eab308" : "#ef4444" }}>
                {overallQuality}<span className="text-base text-zinc-500">/100</span>
              </p>
            </div>
          )}
          {overallCompletion !== null && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Completion</p>
              <p className="text-2xl font-bold" style={{ color: overallCompletion >= 70 ? "#22c55e" : overallCompletion >= 50 ? "#eab308" : "#ef4444" }}>
                {overallCompletion}<span className="text-base text-zinc-500">%</span>
              </p>
            </div>
          )}
          {isCompanion && (
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement Rate</p>
              <p className="text-2xl font-bold text-indigo-400">
                67<span className="text-base text-zinc-500">%</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* No data state */}
      {!hasData && !isCompanion && activeTab !== "dimensions" && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-indigo-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-base font-semibold text-white mb-2">No analyzed data yet</h3>
          <p className="text-sm text-zinc-500 mb-4 max-w-sm mx-auto">
            This page shows quality distribution, completion analysis, and a prioritized fix list — after running analysis workers.
          </p>
          <div className="inline-block bg-black/40 rounded-lg px-4 py-3 font-mono text-xs text-zinc-400 text-left">
            <p className="text-emerald-400">python -m workers.intent_classifier</p>
            <p className="text-emerald-400 mt-1">python -m workers.quality_scorer</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06]">
        {TABS.map(({ id, label, badge }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? "text-white bg-white/[0.07] border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {label}
            {badge && (
              <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{badge}</span>
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "quality" && (
          isCompanion ? <CompanionQualityOverviewTab /> : (hasData && <QualityTab data={data} isMultiPlatform={isMultiPlatform} />)
        )}
        {activeTab === "completion" && (
          isCompanion ? <EngagementAnalysisTab /> : (hasData && <CompletionTab data={data} isMultiPlatform={isMultiPlatform} />)
        )}
        {activeTab === "fixes" && (
          isCompanion ? <FixPrioritiesTab data={data} isCompanion={true} /> : (hasData && <FixPrioritiesTab data={data} isCompanion={false} />)
        )}
        {activeTab === "dimensions"       && <QualityDimensionsTab isCompanion={isCompanion} />}
        {activeTab === "satisfaction"     && <SatisfactionTab />}
        {activeTab === "model_comparison" && isCompanion && <ModelComparisonTab />}
      </div>
    </div>
  );
}
