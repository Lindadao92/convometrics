"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorstIntent {
  intent: string;
  avgQuality: number;
  volume: number;
}

interface FastestGrowing {
  intent: string;
  pctChange: number;
  thisWeekCount: number;
  prevWeekCount: number;
}

interface FeatureGap {
  intent: string;
  completionRate: number;
  volume: number;
}

interface SegmentData {
  completed: number;
  total: number;
  rate: number;
}

interface SparkPoint {
  date: string;
  rate: number;
}

interface ApiData {
  briefing: {
    successRateThisWeek: number;
    successRatePrevWeek: number;
    successRateDelta: number;
    failedUsersThisWeek: number;
    worstIntent: WorstIntent | null;
    fastestGrowing: FastestGrowing | null;
  };
  kpis: {
    successRate: { current: number; delta: number; sparkline: SparkPoint[] };
    revenueAtRisk: {
      current: number;
      usersAtRisk: number;
      thisWeekUsers: number;
      lastWeekUsers: number;
      failedSessions: number;
      abandonedSessions: number;
    };
    topFeatureGap: FeatureGap | null;
    allFeatureGaps: FeatureGap[];
    worstIntent: WorstIntent | null;
    usersAffected: { thisWeek: number; lastWeek: number; delta: number };
    segmentPerformance: {
      beginner: SegmentData;
      designer: SegmentData;
      developer: SegmentData;
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function label(intent: string): string {
  return intent.replace(/_/g, " ");
}

function fmtMoney(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;
}

function todayStr(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: SparkPoint[]; color: string }) {
  if (data.length < 2) return null;
  const W = 80, H = 28, PAD = 2;
  const vals = data.map((d) => d.rate);
  const lo = Math.min(...vals), hi = Math.max(...vals), range = hi - lo || 1;
  const pts = vals.map((v, i) => [
    PAD + (i / (vals.length - 1)) * (W - PAD * 2),
    PAD + (1 - (v - lo) / range) * (H - PAD * 2),
  ]);
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Delta pill ───────────────────────────────────────────────────────────────

function TrendBadge({
  delta,
  unit = "pp",
  invert = false,
}: {
  delta: number;
  unit?: string;
  invert?: boolean;
}) {
  if (delta === 0) return <span className="text-xs text-zinc-600">unchanged</span>;
  const positive = invert ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "↑" : "↓";
  return (
    <span
      className={`inline-flex items-center gap-px text-xs font-medium px-1.5 py-0.5 rounded ${
        positive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
      }`}
    >
      {arrow} {Math.abs(delta)}{unit} vs last week
    </span>
  );
}

// ─── Quality score bar ────────────────────────────────────────────────────────

function QualityBar({ score }: { score: number }) {
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Mini horizontal bar (segments) ──────────────────────────────────────────

function MiniBar({ label: lbl, rate, color }: { label: string; rate: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-zinc-500 w-[72px] capitalize shrink-0">{lbl}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${rate}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-zinc-300 w-7 text-right">{rate}%</span>
    </div>
  );
}

// ─── KPI card shell ───────────────────────────────────────────────────────────

function Card({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip?: React.ReactNode;
}) {
  const [tip, setTip] = useState(false);
  return (
    <div
      className="relative rounded-xl border border-white/[0.07] bg-[#13141b] p-5 cursor-default
                 transition-colors hover:border-white/[0.13] hover:bg-[#14151c]"
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      {children}
      {/* info dot */}
      {tooltip && (
        <div className="absolute top-3.5 right-3.5 w-3.5 h-3.5 rounded-full border border-white/10
                        flex items-center justify-center">
          <span className="text-[8px] text-zinc-600 font-bold">i</span>
        </div>
      )}
      {/* tooltip panel */}
      {tip && tooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 w-68 min-w-[260px] rounded-xl
                        border border-white/[0.08] bg-[#1c1d28] p-3.5 shadow-2xl pointer-events-none">
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ─── Card label ───────────────────────────────────────────────────────────────

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
      {children}
    </p>
  );
}

// ─── 1. AI Success Rate ───────────────────────────────────────────────────────

function SuccessRateCard({ data }: { data: ApiData["kpis"]["successRate"] }) {
  const up = data.delta >= 0;
  const arrowColor = up ? "text-emerald-400" : "text-red-400";
  const lineColor  = up ? "#34d399" : "#f87171";
  const arrow = up ? "↑" : "↓";

  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">AI Success Rate — daily (14d)</p>
          <p className="text-xs text-zinc-400">Conversations reaching completed status ÷ total.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
            {data.sparkline.slice(-8).map((d) => (
              <div key={d.date} className="flex justify-between text-xs">
                <span className="text-zinc-600">{d.date}</span>
                <span className="text-zinc-300 font-mono">{d.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <CardLabel>AI Success Rate</CardLabel>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white tabular-nums">{data.current}%</span>
            <span className={`text-xl font-bold ${arrowColor}`}>{arrow}</span>
          </div>
          <div className="mt-2">
            <TrendBadge delta={data.delta} />
          </div>
        </div>
        <div className="pb-1 opacity-80">
          <Sparkline data={data.sparkline} color={lineColor} />
        </div>
      </div>
    </Card>
  );
}

// ─── 2. Revenue at Risk ───────────────────────────────────────────────────────

function RevenueAtRiskCard({ data }: { data: ApiData["kpis"]["revenueAtRisk"] }) {
  const weekDelta = (data.thisWeekUsers - data.lastWeekUsers) * 35;
  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Revenue at Risk</p>
          <p className="text-xs text-zinc-400">
            Unique users with failed or abandoned sessions × $35 estimated MRR.
          </p>
          <div className="space-y-1 pt-1 border-t border-white/[0.06]">
            {[
              ["Failed sessions",    data.failedSessions,   "text-red-400"],
              ["Abandoned sessions", data.abandonedSessions, "text-amber-400"],
              ["Unique at-risk users",     data.usersAtRisk, "text-zinc-200"],
              ["This week users",   data.thisWeekUsers,    "text-zinc-200"],
              ["Last week users",   data.lastWeekUsers,    "text-zinc-200"],
            ].map(([lbl, val, cls]) => (
              <div key={lbl as string} className="flex justify-between text-xs">
                <span className="text-zinc-500">{lbl}</span>
                <span className={`font-mono ${cls}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <CardLabel>Revenue at Risk</CardLabel>
      <p className="text-4xl font-bold text-white tabular-nums">{fmtMoney(data.current)}</p>
      <p className="text-xs text-zinc-500 mt-1">{data.usersAtRisk} users · $35 MRR est.</p>
      <div className="mt-2">
        <TrendBadge delta={weekDelta} unit="" invert={true} />
      </div>
    </Card>
  );
}

// ─── 3. Top Feature Gap ───────────────────────────────────────────────────────

function TopFeatureGapCard({
  gap,
  allGaps,
}: {
  gap: FeatureGap | null;
  allGaps: FeatureGap[];
}) {
  if (!gap) {
    return (
      <Card>
        <CardLabel>Top Feature Gap</CardLabel>
        <p className="text-zinc-500 text-sm">No intents below 50%</p>
      </Card>
    );
  }
  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">All intents below 50% completion</p>
          <div className="space-y-1.5">
            {allGaps.slice(0, 8).map((g) => (
              <div key={g.intent} className="flex justify-between text-xs">
                <span className="text-zinc-400 capitalize truncate max-w-[160px]">{label(g.intent)}</span>
                <span className="text-red-400 font-mono shrink-0 ml-2">{g.completionRate}% · {g.volume} sess</span>
              </div>
            ))}
            {allGaps.length > 8 && (
              <p className="text-zinc-600 text-xs">+{allGaps.length - 8} more</p>
            )}
          </div>
        </div>
      }
    >
      <CardLabel>Top Feature Gap</CardLabel>
      <p className="text-base font-semibold text-white capitalize leading-snug">
        {label(gap.intent)}
      </p>
      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-3xl font-bold text-red-400 tabular-nums">{gap.completionRate}%</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">completion</p>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div>
          <p className="text-3xl font-bold text-zinc-300 tabular-nums">{gap.volume}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">sessions</p>
        </div>
      </div>
    </Card>
  );
}

// ─── 4. Worst Intent ──────────────────────────────────────────────────────────

function WorstIntentCard({ data }: { data: WorstIntent | null }) {
  if (!data) {
    return (
      <Card>
        <CardLabel>Worst Intent</CardLabel>
        <p className="text-zinc-500 text-sm">Not enough data</p>
      </Card>
    );
  }
  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Worst Intent by Quality</p>
          <p className="text-xs text-zinc-400">
            Average quality score across all sessions for this intent. Scale 0–100.
          </p>
          <div className="space-y-1 pt-1 border-t border-white/[0.06]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Intent</span>
              <span className="text-zinc-200 capitalize">{label(data.intent)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Avg quality</span>
              <span className="text-red-400 font-mono">{data.avgQuality} / 100</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Sessions</span>
              <span className="text-zinc-200 font-mono">{data.volume}</span>
            </div>
          </div>
        </div>
      }
    >
      <CardLabel>Worst Intent</CardLabel>
      <p className="text-base font-semibold text-white capitalize leading-snug">
        {label(data.intent)}
      </p>
      <p className="text-3xl font-bold text-red-400 tabular-nums mt-2">{data.avgQuality}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5">avg quality score · {data.volume} sessions</p>
      <QualityBar score={data.avgQuality} />
    </Card>
  );
}

// ─── 5. Users Affected ────────────────────────────────────────────────────────

function UsersAffectedCard({ data }: { data: ApiData["kpis"]["usersAffected"] }) {
  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Users Affected</p>
          <p className="text-xs text-zinc-400">
            Unique users who had at least one <span className="text-zinc-200">failed</span>{" "}
            conversation this week. Does not count abandoned sessions.
          </p>
          <div className="space-y-1 pt-1 border-t border-white/[0.06]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">This week</span>
              <span className="text-zinc-200 font-mono">{data.thisWeek}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Last week</span>
              <span className="text-zinc-200 font-mono">{data.lastWeek}</span>
            </div>
          </div>
        </div>
      }
    >
      <CardLabel>Users Affected</CardLabel>
      <p className="text-4xl font-bold text-white tabular-nums">{data.thisWeek}</p>
      <p className="text-xs text-zinc-500 mt-1">unique users with failed sessions this week</p>
      <div className="mt-2">
        <TrendBadge delta={data.delta} unit="" invert={true} />
      </div>
    </Card>
  );
}

// ─── 6. Segment Performance ───────────────────────────────────────────────────

function SegmentCard({ data }: { data: ApiData["kpis"]["segmentPerformance"] }) {
  const rows: { key: keyof typeof data; color: string }[] = [
    { key: "developer", color: "#818cf8" },
    { key: "designer",  color: "#a78bfa" },
    { key: "beginner",  color: "#60a5fa" },
  ];
  return (
    <Card
      tooltip={
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Segment Performance</p>
          <p className="text-xs text-zinc-400">
            Completion rates by <span className="text-zinc-200">metadata.user_experience</span>.
          </p>
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            {rows.map(({ key, color }) => {
              const s = data[key];
              return (
                <div key={key} className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-300 capitalize">{key}</span>
                    <span className="text-zinc-500 font-mono">{s.completed}/{s.total}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${s.rate}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    >
      <CardLabel>Segment Performance</CardLabel>
      <div className="space-y-3 mt-1">
        {rows.map(({ key, color }) => (
          <MiniBar key={key} label={key} rate={data[key].rate} color={color} />
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-3">completion rate by experience level</p>
    </Card>
  );
}

// ─── Three summary stat cards ─────────────────────────────────────────────────

function SummaryStats() {
  const stats = [
    {
      label: "Total Conversations",
      value: "500",
      comparison: "↑ 12% vs last week",
      compCls: "text-green-400",
    },
    {
      label: "Avg Quality Score",
      value: "61/100",
      comparison: "↓ 3 points vs last week",
      compCls: "text-red-400",
    },
    {
      label: "Completion Rate",
      value: "52%",
      comparison: "↓ from 57% last week",
      compCls: "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-5">
      {stats.map(({ label, value, comparison, compCls }) => (
        <div
          key={label}
          className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
          <p className={`text-xs mt-1.5 ${compCls}`}>{comparison}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly Briefing card ─────────────────────────────────────────────────────

function BriefingCard() {
  return (
    <div className="flex rounded-xl border border-white/[0.06] bg-zinc-900 overflow-hidden">
      {/* amber left border */}
      <div className="w-1 shrink-0 bg-amber-400" />

      <div className="flex-1 px-5 py-4">
        <p className="text-xs font-semibold text-amber-400 mb-2">
          📋 Weekly Briefing
        </p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          This week: AI Success Rate <strong className="text-white">52%</strong>{" "}
          <span className="text-red-400">(↓ from 57%)</span>. 14 users had failed experiences.
          Worst performing: <strong className="text-white">fix_break_loop</strong> — only 12% of
          users succeed, most get trapped in fix-break-fix cycles. Biggest opportunity:{" "}
          <strong className="text-amber-300">connect_api</strong> (87 sessions, 25% success) —
          your fastest-growing use case but AI hallucinates API endpoints. Recommended: prioritize
          API integration quality and add regression testing to bug fix flows.
        </p>
      </div>
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
      <div className="space-y-2">
        <Bone className="h-7 w-32" />
        <Bone className="h-3.5 w-56" />
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6 space-y-3">
        <Bone className="h-3 w-32" />
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-4 w-3/5" />
        <div className="flex gap-2 pt-2">
          {[28, 32, 40, 36].map((w, i) => <Bone key={i} className={`h-5 w-${w} rounded-lg`} />)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-[#13141b] p-5 space-y-3">
            <Bone className="h-2.5 w-24" />
            <Bone className="h-9 w-20" />
            <Bone className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [data, setData]     = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefing")
      .then((r) => (r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? e : String(e)))
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

  const { briefing, kpis } = data;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* page header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-zinc-500 mt-0.5">AI performance summary · {todayStr()}</p>
      </div>

      {/* briefing */}
      <BriefingCard />

      {/* summary stats */}
      <SummaryStats />

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <SuccessRateCard   data={kpis.successRate} />
        <RevenueAtRiskCard data={kpis.revenueAtRisk} />
        <TopFeatureGapCard gap={kpis.topFeatureGap} allGaps={kpis.allFeatureGaps} />
        <WorstIntentCard   data={kpis.worstIntent} />
        <UsersAffectedCard data={kpis.usersAffected} />
        <SegmentCard       data={kpis.segmentPerformance} />
      </div>
    </div>
  );
}
