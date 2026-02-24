"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, CartesianGrid, ScatterChart, Scatter, ZAxis,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";
import { DIMENSIONS, DimensionKey, dimColor } from "@/lib/mockQualityData";

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

// ─── Tab 1: Quality Overview ──────────────────────────────────────────────────

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
          subtitle="Average quality score per AI platform — identifies which platform serves users best">
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
          subtitle="Does AI quality drop in longer conversations? Longer = harder to maintain context and relevance">
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

// ─── Tab 2: Completion Analysis ───────────────────────────────────────────────

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
          subtitle="At which turn do users most often give up? Peaks reveal where AI consistently fails to satisfy users">
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

function FixPrioritiesTab({ data }: { data: PerformanceData }) {
  const scatterData = data.impactMatrix.slice(0, 40).map((d) => ({
    x: d.failureRate,
    y: d.count,
    z: Math.max(d.qualityGap, 10),
    intent: d.intent,
    impactScore: d.impactScore,
  }));

  return (
    <div className="space-y-6">
      {data.insights.topFix && <AutoInsight text={data.insights.topFix} />}

      <ChartCard title="Impact Matrix"
        subtitle="Top-right quadrant = highest priority: high failure rate + high volume. Bubble size = quality gap.">
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
                <Tooltip
                  {...TOOLTIP_STYLE}
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
        subtitle="Ranked by impact score = volume × failure rate × quality gap. Fix the top items for maximum improvement.">
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
                    <p className="text-xs text-zinc-600 italic truncate">
                      &ldquo;{item.examples[0]}&rdquo;
                    </p>
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

function QualityDimensionsTab() {
  const [filterIntent, setFilterIntent] = useState("");
  const [filterModel, setFilterModel]   = useState("");
  const [filterDays, setFilterDays]     = useState("30");
  const [qData, setQData] = useState<QualityScoresData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ days: filterDays });
    if (filterIntent) params.set("intent", filterIntent);
    if (filterModel)  params.set("model",  filterModel);
    fetch(`/api/quality-scores?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setQData(d))
      .finally(() => setLoading(false));
  }, [filterIntent, filterModel, filterDays]);

  const intents = qData?.intents ?? [];
  const models  = qData?.models  ?? ["v2.0", "v2.1"];

  const SELECT_CLS = "bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20";

  return (
    <div className="space-y-6">

      {/* ── Filters ───────────────────────────────────────────────────────── */}
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
          <button
            onClick={() => { setFilterIntent(""); setFilterModel(""); setFilterDays("30"); }}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5"
          >
            Reset filters
          </button>
        )}

        {qData && (
          <span className="ml-auto text-[10px] text-zinc-600">
            {fmt(qData.total)} conversations
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Bone className="h-72 rounded-xl" />
          <Bone className="h-48 rounded-xl" />
        </div>
      ) : !qData || qData.total === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-500 text-sm">No data for selected filters</p>
        </div>
      ) : (
        <>
          {/* ── 7 Dimension Trendlines ───────────────────────────────────── */}
          <ChartCard
            title="Quality Dimensions Over Time"
            subtitle="Daily average score per dimension — spot which axes are improving or degrading"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qData.trendData} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(qData.trendData.length / 8) - 1)}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: unknown, name: unknown) => [
                    v != null ? `${v}/100` : "—",
                    DIMENSIONS.find((d) => d.key === String(name))?.label ?? String(name),
                  ]}
                />
                {DIMENSIONS.map((d) => (
                  <Line
                    key={d.key}
                    type="monotone"
                    dataKey={d.key}
                    stroke={d.color}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                    name={d.key}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Custom legend */}
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

          {/* ── Dimension Breakdown Table ────────────────────────────────── */}
          <ChartCard
            title="Dimension Breakdown"
            subtitle="Per-dimension averages, 7-day change, and best/worst performing intent category"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Dimension</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Weight</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Avg Score</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">7-Day Change</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Best Intent</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Worst Intent</th>
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
                        <td className="px-3 py-3 text-zinc-500 text-xs font-mono">
                          {Math.round(row.weight * 100)}%
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${row.currentAvg ?? 0}%`, backgroundColor: dimColor(row.currentAvg) }}
                              />
                            </div>
                            <span className="text-xs font-mono" style={{ color: dimColor(row.currentAvg) }}>
                              {row.currentAvg ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          {change !== null ? (
                            <span className={`text-xs font-mono font-medium ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-zinc-500"}`}>
                              {change > 0 ? "+" : ""}{change}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "quality" | "completion" | "fixes" | "dimensions";

export default function Performance() {
  const { selectedPlatform, profile } = useProductProfile();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("quality");

  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  useEffect(() => {
    setLoading(true);
    const url = `/api/performance${selectedPlatform !== "all" ? `?platform=${selectedPlatform}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedPlatform]);

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

  const overallQuality = data.qualityByPlatform.length > 0
    ? Math.round(data.qualityByPlatform.reduce((s, p) => s + (p.avgQuality ?? 0) * p.count, 0) /
        data.qualityByPlatform.reduce((s, p) => s + p.count, 0))
    : null;

  const totalCounted   = data.statusBreakdown.reduce((a, b) => a + b.count, 0);
  const completedCount = data.statusBreakdown.find((s) => s.status === "completed")?.count ?? 0;
  const overallCompletion = totalCounted > 0 ? Math.round((completedCount / totalCounted) * 1000) / 10 : null;

  const hasData = data.total > 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: "quality",    label: "Quality Overview" },
    { id: "completion", label: "Completion Analysis" },
    { id: "fixes",      label: "Fix Priorities" },
    { id: "dimensions", label: "Quality Dimensions" },
  ];

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI Performance</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Deep dive into quality, completion, and failure patterns</p>
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
        </div>
      </div>

      {/* No data state */}
      {!hasData && activeTab !== "dimensions" && (
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
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? "text-white bg-white/[0.07] border-b-2 border-indigo-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}>
            {label}
            {id === "dimensions" && (
              <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">New</span>
            )}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "quality"     && hasData && <QualityTab data={data} isMultiPlatform={isMultiPlatform} />}
        {activeTab === "completion"  && hasData && <CompletionTab data={data} isMultiPlatform={isMultiPlatform} />}
        {activeTab === "fixes"       && hasData && <FixPrioritiesTab data={data} />}
        {activeTab === "dimensions"  && <QualityDimensionsTab />}
      </div>
    </div>
  );
}
