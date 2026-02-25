"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, XAxis, YAxis, AreaChart, Area,
} from "recharts";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { SATISFACTION_META, InferredSatisfaction } from "@/lib/mockQualityData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US");
const cap = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface SatisfactionDist { key: string; label: string; count: number; pct: number; color: string; }
interface FrustrationSignal { key: string; label: string; emoji: string; count: number; color: string; }
interface SatisfactionData { distribution: SatisfactionDist[]; topFrustrationSignals: FrustrationSignal[]; total: number; }
interface TopFailureItem { key: string; label: string; icon: string; thisWeek: number; delta: number; isAlert: boolean; }
interface FailureTaxonomyData { topThisWeek: TopFailureItem[]; }
// ─── Quality vs Return Rate data ──────────────────────────────────────────────

const QUALITY_RETURN_CURVE = [
  { qualityBin: "0–30",  returnPct: 22 },
  { qualityBin: "30–50", returnPct: 31 },
  { qualityBin: "50–70", returnPct: 48 },
  { qualityBin: "70–85", returnPct: 58 },
  { qualityBin: "85–100", returnPct: 67 },
];

const RETENTION_BY_INTENT = [
  { intent: "Roleplay",            sessions: 812, avgQuality: 68, returnRate: 61 },
  { intent: "Emotional Support",   sessions: 504, avgQuality: 59, returnRate: 54 },
  { intent: "Casual Chat",         sessions: 421, avgQuality: 52, returnRate: 47 },
  { intent: "Creative Storytelling", sessions: 337, avgQuality: 71, returnRate: 64 },
  { intent: "Knowledge Q&A",       sessions: 226, avgQuality: 45, returnRate: 38 },
];

// ─── KPI chart data ───────────────────────────────────────────────────────────

const KPI_RETENTION_DATA = [
  { label: "< 1 Wk", value: 100 },
  { label: "Week 1", value: 43 },
  { label: "Week 2", value: 41 },
  { label: "Week 3", value: 46 },
  { label: "Week 4", value: 45 },
];

// 30 days of daily engagement rate (% deep conversations)
const KPI_ENGAGEMENT_DATA = (() => {
  const base = [64, 66, 68, 65, 67, 69, 66, 63, 65, 67, 70, 68, 66, 64, 67, 69, 71, 68, 66, 65, 67, 68, 70, 67, 65, 66, 68, 69, 67, 67];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

// 30 days of daily satisfaction rate (slight downward trend ~52% → ~50%)
const KPI_SATISFACTION_DATA = (() => {
  const base = [53, 52, 54, 53, 51, 52, 53, 51, 50, 52, 51, 53, 52, 50, 51, 50, 52, 51, 49, 50, 51, 50, 49, 51, 50, 49, 50, 51, 50, 50];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

// 30 days of daily at-risk DAU count (slight upward trend ending at 87)
const KPI_ATRISK_DATA = (() => {
  const base = [72, 74, 71, 75, 78, 76, 79, 77, 80, 78, 81, 79, 82, 80, 83, 81, 84, 82, 85, 83, 86, 84, 85, 86, 84, 87, 85, 88, 86, 87];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

// ─── Character table data ─────────────────────────────────────────────────────

interface CharacterRow {
  name: string;
  type: string;
  sessions: number;
  avgQuality: number;
  satisfaction: number;
  avgTurns: number;
  trend: "up" | "down" | "flat";
  warning?: string;
}

const CHARACTER_TABLE: CharacterRow[] = [
  { name: "Sakura-chan",          type: "Anime/Fiction",      sessions: 312, avgQuality: 74, satisfaction: 58, avgTurns: 34, trend: "up" },
  { name: "Shadow Knight Kael",  type: "Anime/Fiction",      sessions: 245, avgQuality: 71, satisfaction: 52, avgTurns: 41, trend: "flat" },
  { name: "Captain Drake",       type: "Anime/Fiction",      sessions: 198, avgQuality: 76, satisfaction: 61, avgTurns: 28, trend: "up" },
  { name: "Luna the Wolf",       type: "Original Character", sessions: 187, avgQuality: 68, satisfaction: 49, avgTurns: 37, trend: "down", warning: "Satisfaction dropped 8pts" },
  { name: "Dr. Elena",           type: "Therapist/Advisor",  sessions: 156, avgQuality: 62, satisfaction: 42, avgTurns: 18, trend: "down", warning: "High frustration rate" },
  { name: "Alex (boyfriend)",    type: "Romantic Partner",    sessions: 143, avgQuality: 65, satisfaction: 47, avgTurns: 52, trend: "flat" },
  { name: "Nyx (shadow entity)", type: "Original Character", sessions: 134, avgQuality: 72, satisfaction: 55, avgTurns: 45, trend: "up" },
  { name: "AI Taylor",           type: "Celebrity",          sessions: 128, avgQuality: 59, satisfaction: 38, avgTurns: 14, trend: "down", warning: "Lowest quality score" },
  { name: "Ember Rose",          type: "Original Character", sessions: 112, avgQuality: 70, satisfaction: 53, avgTurns: 31, trend: "flat" },
  { name: "Dark Lord Zephyr",    type: "Game Character",     sessions: 98,  avgQuality: 73, satisfaction: 56, avgTurns: 39, trend: "up" },
];

type SortKey = "sessions" | "avgQuality" | "satisfaction" | "avgTurns";

// ─── Worst intent data ────────────────────────────────────────────────────────

const WORST_INTENTS = [
  { intent: "advice_seeking",       quality: 59, issue: "AI gives generic advice without asking clarifying questions" },
  { intent: "emotional_support",    quality: 65, issue: "Tone breaks — cheerful responses to users in distress" },
  { intent: "learning_exploration", quality: 63, issue: "Gives answers directly instead of guiding discovery" },
];

// ─── Smart Briefing ───────────────────────────────────────────────────────────

function SmartBriefingCard({ effectiveDays, preset }: { effectiveDays: number; preset: string }) {
  // Different briefing content based on time range
  let title = "Weekly AI Briefing";
  let subtitle = "Feb 17–23, 2026 · auto-generated";
  let bullets: { text: string; type: "alert" | "warn" | "info" }[] = [];

  if (preset === "1d" || preset === "yesterday") {
    title = "Daily Snapshot";
    subtitle = preset === "1d" ? "Today · auto-generated" : "Yesterday · auto-generated";
    bullets = [
      { text: "342 conversations analyzed — quality holding at 69/100.", type: "info" },
      { text: "emotional_support frustration rate spiked to 38% today (vs 34% weekly avg).", type: "alert" },
      { text: "No new character_break incidents in the last 24 hours.", type: "info" },
    ];
  } else if (effectiveDays <= 7) {
    title = "Weekly AI Briefing";
    subtitle = "Feb 17–23, 2026 · auto-generated";
    bullets = [
      { text: "Overall conversation quality held steady at 69 (↑1 from last week).", type: "info" },
      { text: "emotional_support intent has the highest frustration rate (34%) — tone_break failures are the primary cause. Users in crisis moments are getting cheerful or dismissive responses.", type: "alert" },
      { text: "character_break failures increased 18% this week, concentrated in Anime/Fiction characters on the Flash model.", type: "warn" },
      { text: "Biggest opportunity: Fix tone_break in emotional_support. 450 sessions/week, only 58% satisfaction. Improving this could reduce churn risk for ~120 daily active users.", type: "alert" },
      { text: "Power users are 2.8× more likely to have high-quality roleplay experiences than new users — onboarding quality gap is widening.", type: "info" },
    ];
  } else if (effectiveDays <= 30) {
    title = "Monthly AI Briefing";
    subtitle = "Last 30 days · auto-generated";
    bullets = [
      { text: "Quality improved from 66 → 69 over the past month (+4.5%). Brainiac model leads at 73 avg.", type: "info" },
      { text: "emotional_support remains the top problem intent at 34% frustration — unchanged for 3 weeks despite flagging.", type: "alert" },
      { text: "Anime/Fiction characters improved 3 pts after the roleplay coherence fix in week 2.", type: "info" },
      { text: "87 DAUs consistently at risk — concentrated in emotional_support and roleplay with context loss.", type: "warn" },
      { text: "Retention multiplier: users with quality > 75 retain at 2.1× the rate of users below 50.", type: "info" },
    ];
  } else {
    title = "Period Summary";
    subtitle = `Last ${effectiveDays} days · auto-generated (showing 30 days of data)`;
    bullets = [
      { text: "Quality trended from ~64 to 69 over the observable period — steady upward trajectory.", type: "info" },
      { text: "Top recurring issue: tone_break in emotional_support has persisted across the entire period.", type: "alert" },
      { text: "Character types with best improvement: Anime/Fiction (+5 pts), Game Character (+3 pts).", type: "info" },
      { text: "Retention correlation is strong and consistent: quality > 75 → 2.1× retention rate.", type: "info" },
    ];
  }

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.04] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⚡</span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-[10px] text-indigo-400/70">{subtitle}</p>
          </div>
        </div>
        <a href="/report" className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30 rounded-lg px-2.5 py-1">
          View full report →
        </a>
      </div>
      <div className="space-y-2.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className={`text-xs mt-0.5 shrink-0 ${b.type === "alert" ? "text-amber-400" : b.type === "warn" ? "text-red-400" : "text-indigo-400/60"}`}>
              {b.type === "alert" ? "⚠" : b.type === "warn" ? "↑" : "·"}
            </span>
            <p className={`text-xs leading-relaxed ${b.type === "alert" ? "text-amber-100/80" : "text-zinc-400"}`}>{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, detail, chartData, color, alert, yDomain, yFormat, tooltipLabel, dataRow }: {
  label: string; value: string; sub: string; detail: string;
  chartData: { label: string; value: number }[]; color: string; alert?: boolean;
  yDomain: [number, number]; yFormat?: (v: number) => string;
  tooltipLabel: string; dataRow?: { labels: string[]; values: string[] };
}) {
  const gradientId = `kpi-grad-${label.replace(/\s/g, "")}`;
  const fmtY = yFormat ?? ((v: number) => `${v}`);
  return (
    <div className={`rounded-xl border bg-[#13141b] p-4 flex flex-col ${alert ? "border-red-500/25" : "border-white/[0.07]"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${alert ? "text-red-400/80" : "text-zinc-500"}`}>{label}</p>
      <p className={`text-3xl font-bold font-mono leading-none ${alert ? "text-red-300" : "text-white"}`}>{value}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5 mb-3">{sub}</p>
      <div className="flex-1 min-h-0" style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={yDomain} tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={36} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [fmtY(v ?? 0), tooltipLabel]} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`}
              dot={chartData.length <= 7 ? { fill: color, r: 3.5, strokeWidth: 0 } : false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {dataRow && (
        <div className="flex justify-between mt-2 px-1">
          {dataRow.labels.map((l, i) => (
            <div key={l} className="text-center">
              <p className="text-[9px] text-zinc-600">{l}</p>
              <p className="text-[10px] font-mono text-zinc-400 font-semibold">{dataRow.values[i]}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-zinc-600 leading-relaxed mt-2">{detail}</p>
    </div>
  );
}

// ─── Top Characters Table ─────────────────────────────────────────────────────

function TopCharactersTable() {
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...CHARACTER_TABLE].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const qColor = (v: number) => v > 75 ? "text-emerald-400" : v >= 55 ? "text-amber-400" : "text-red-400";
  const sColor = (v: number) => v > 55 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-red-400";
  const trendIcon = (t: string) => t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const trendColor = (t: string) => t === "up" ? "text-emerald-400" : t === "down" ? "text-red-400" : "text-zinc-600";

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-zinc-700 ml-0.5">↕</span>;
    return <span className="text-indigo-400 ml-0.5">{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Top Characters</p>
        <p className="text-xs text-zinc-600">Performance by character — click column headers to sort</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Character</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Type</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("sessions")}>
                Sessions{sortArrow("sessions")}
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("avgQuality")}>
                Avg Quality{sortArrow("avgQuality")}
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("satisfaction")}>
                Satisfaction{sortArrow("satisfaction")}
              </th>
              <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("avgTurns")}>
                Avg Turns{sortArrow("avgTurns")}
              </th>
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.name} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    {row.warning && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title={row.warning} />}
                    <a href="#" className="text-zinc-200 hover:text-indigo-300 transition-colors font-medium">{row.name}</a>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-500">{row.type}</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{fmt(row.sessions)}</td>
                <td className={`px-3 py-2.5 text-right font-mono font-semibold ${qColor(row.avgQuality)}`}>{row.avgQuality}</td>
                <td className={`px-3 py-2.5 text-right font-mono font-semibold ${sColor(row.satisfaction)}`}>{row.satisfaction}%</td>
                <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{row.avgTurns}</td>
                <td className={`px-3 py-2.5 text-center font-mono ${trendColor(row.trend)}`}>{trendIcon(row.trend)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-zinc-600">
          <span className="text-amber-400 font-semibold">3 characters</span> flagged with warnings ·
          AI Taylor has the lowest quality (59) — mostly short, low-engagement celebrity chats
        </p>
      </div>
    </div>
  );
}

// ─── What's Failing Section ───────────────────────────────────────────────────

function WhatsFailingSection({ failures }: { failures: TopFailureItem[] }) {
  const hasAlert = failures.some((f) => f.isAlert);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Left: Top failures */}
      <div className={`rounded-xl border bg-[#13141b] p-5 ${hasAlert ? "border-red-500/20" : "border-white/[0.07]"}`}>
        <div className="flex items-center gap-2 mb-1">
          {hasAlert && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Failures This Week</p>
        </div>
        <p className="text-xs text-zinc-600 mb-4">Most frequent failure patterns · vs. last week</p>
        <div className="space-y-3">
          {failures.slice(0, 3).map((f) => {
            const isUp = f.delta > 0;
            const isDown = f.delta < 0;
            const arrow = isUp ? "↑" : isDown ? "↓" : "→";
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

      {/* Right: Worst intents */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Worst Performing Intents</p>
        <p className="text-xs text-zinc-600 mb-4">Lowest quality intents with primary issues</p>
        <div className="space-y-4">
          {WORST_INTENTS.map((w) => (
            <a key={w.intent} href={`/topics?intent=${w.intent}`} className="block group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-200 capitalize group-hover:text-indigo-300 transition-colors">{cap(w.intent)}</span>
                <span className={`text-xs font-mono font-semibold ${w.quality < 60 ? "text-red-400" : "text-amber-400"}`}>{w.quality}/100</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{w.issue}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Satisfaction Section ──────────────────────────────────────────────────────

function SatisfactionSection({ sat }: { sat: SatisfactionData }) {
  const { distribution, topFrustrationSignals, total } = sat;
  const satisfiedItem = distribution.find(d => d.key === "satisfied");
  const frustratedItem = distribution.find(d => d.key === "frustrated");
  const abandonedItem = distribution.find(d => d.key === "abandoned");
  const negPct = ((frustratedItem?.count ?? 0) + (abandonedItem?.count ?? 0)) / Math.max(total, 1) * 100;

  const donutData = distribution.map(d => ({ name: d.label, value: d.count, fill: d.color }));

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Inferred Satisfaction</p>
          <p className="text-xs text-zinc-600">Estimated from behavioral signals — no surveys required</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">Top frustration signals</p>
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
                      <span className="text-xs text-zinc-300">{sig.emoji} {sig.label}</span>
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

// ─── Quality vs Return Rate Section ───────────────────────────────────────────

function QualityReturnSection() {
  const returnColor = (v: number) => v > 55 ? "text-emerald-400" : v >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-base">📈</span>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Quality → Retention</p>
        </div>
        <p className="text-xs text-zinc-600 mt-0.5">How conversation quality drives user return rates</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-white/[0.06]">
        {/* Left: Quality vs Return Rate chart */}
        <div className="xl:col-span-3 p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-zinc-300 mb-0.5">Quality Score vs. Return Rate</p>
            <p className="text-[10px] text-zinc-600">% of users who returned within 7 days, by quality bucket</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={QUALITY_RETURN_CURVE} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="qualReturnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="qualityBin" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "7-day return"]} />
              <Area type="monotone" dataKey="returnPct" stroke="#6366f1" strokeWidth={2.5} fill="url(#qualReturnGrad)"
                dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/20 px-4 py-2.5 flex items-start gap-2.5">
            <span className="text-amber-400 text-sm shrink-0 mt-0.5">⭐</span>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Users with quality <span className="font-semibold text-amber-300">&gt; 75</span> retain at{" "}
              <span className="font-bold text-amber-300 text-sm">2.1×</span> the rate of users with quality{" "}
              <span className="font-semibold text-amber-300">&lt; 50</span>
            </p>
          </div>
          <p className="text-[10px] text-zinc-700">Based on 2,847 users over 30 days</p>
        </div>

        {/* Right: Return Rate by Intent */}
        <div className="xl:col-span-2 p-5 space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-300 mb-0.5">Return Rate by Intent</p>
            <p className="text-[10px] text-zinc-600">7-day return rate broken down by conversation intent</p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sessions</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Avg Qual</th>
                <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">7-Day Return</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_BY_INTENT.map((row) => (
                <tr key={row.intent} className="border-b border-white/[0.03]">
                  <td className="py-2 text-zinc-300">{row.intent}</td>
                  <td className="py-2 text-right text-zinc-500 font-mono">{fmt(row.sessions)}</td>
                  <td className="py-2 text-right text-zinc-500 font-mono">{row.avgQuality}</td>
                  <td className={`py-2 text-right font-mono font-semibold ${returnColor(row.returnRate)}`}>{row.returnRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-zinc-700 leading-relaxed">Return rate = % of users who started another session within 7 days</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const { segment } = useDemoMode();
  const { effectiveDays, timeRange } = useTimeRange();
  const [satData, setSatData] = useState<SatisfactionData | null>(null);
  const [failureData, setFailureData] = useState<FailureTaxonomyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const seg = segment;
    const sp = seg ? `&segment=${seg}` : "";
    Promise.all([
      fetch(`/api/satisfaction?days=${effectiveDays}${sp}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/failure-taxonomy?days=${effectiveDays}${sp}`).then((r) => r.ok ? r.json() : null),
    ])
      .then(([satisfaction, failures]) => {
        setSatData(satisfaction);
        setFailureData(failures);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment, effectiveDays]);

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl space-y-6">

      {/* 1. Smart Briefing */}
      <SmartBriefingCard effectiveDays={effectiveDays} preset={timeRange.preset} />

      {/* 2. Four KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Retention"
          value="45%"
          sub="Week 4 retention rate"
          detail="Classic drop-off then stabilization — users who survive Week 1 tend to stay"
          chartData={KPI_RETENTION_DATA}
          color="#6366f1"
          yDomain={[0, 100]}
          yFormat={(v) => `${v}%`}
          tooltipLabel="Retention"
          dataRow={{ labels: ["< 1 Wk", "Wk 1", "Wk 2", "Wk 3", "Wk 4"], values: ["100%", "43%", "41%", "46%", "45%"] }}
        />
        <KPICard
          label="Engagement"
          value="67%"
          sub="Deep conversations (10+ turns)"
          detail="Avg 25 turns per session · 35% reach 30+ turns"
          chartData={KPI_ENGAGEMENT_DATA}
          color="#8b5cf6"
          yDomain={[0, 100]}
          yFormat={(v) => `${v}%`}
          tooltipLabel="Deep rate"
        />
        <KPICard
          label="Satisfaction"
          value="50%"
          sub="Inferred satisfied · ↓ 2pp"
          detail="Signal-based — slight downward trend over 30 days"
          chartData={KPI_SATISFACTION_DATA}
          color="#f59e0b"
          yDomain={[0, 100]}
          yFormat={(v) => `${v}%`}
          tooltipLabel="Satisfied"
        />
        <KPICard
          label="At Risk"
          value="87"
          sub="DAUs at risk this week"
          detail="41 emotional_support · 29 roleplay · 17 other"
          chartData={KPI_ATRISK_DATA}
          color="#ef4444"
          alert
          yDomain={[0, 150]}
          tooltipLabel="At-risk DAUs"
        />
      </div>

      {/* 3. Top Characters Table */}
      <TopCharactersTable />

      {/* 4. What's Failing */}
      {failureData && failureData.topThisWeek.length > 0 && (
        <WhatsFailingSection failures={failureData.topThisWeek} />
      )}

      {/* 5. Inferred Satisfaction */}
      {satData && <SatisfactionSection sat={satData} />}

      {/* 6. Quality → Retention */}
      <QualityReturnSection />

      {/* Summary links */}
      <div className="flex items-center gap-4 pt-2">
        <a href="/topics" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Explore all topics →
        </a>
        <a href="/conversations" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Browse conversations →
        </a>
        <a href="/report" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Full report →
        </a>
      </div>
    </div>
  );
}
