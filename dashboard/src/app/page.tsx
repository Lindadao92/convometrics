"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Regression {
  intent: string;
  drop: number;
  thisWeek: number;
  prevWeek: number;
}

interface FastestGrowing {
  intent: string;
  pctChange: number;
  thisWeekCount: number;
  prevWeekCount: number;
}

interface BriefingSection {
  successRateThisWeek: number;
  successRatePrevWeek: number;
  successRateDelta: number;
  failedUsersThisWeek: number;
  biggestRegression: Regression | null;
  fastestGrowing: FastestGrowing | null;
  totalThisWeek: number;
}

interface SparkPoint { date: string; rate: number }

interface SegmentData {
  completed: number;
  total: number;
  rate: number;
}

interface ReleaseIntentRow {
  intent: string;
  last7: number;
  prev7: number;
  delta: number;
}

interface FeatureGap {
  intent: string;
  completionRate: number;
  volume: number;
}

interface BriefingResponse {
  briefing: BriefingSection;
  kpis: {
    successRate: { current: number; delta: number; sparkline: SparkPoint[] };
    revenueAtRisk: {
      current: number;
      usersAtRisk: number;
      delta: number;
      thisWeekUsers: number;
      lastWeekUsers: number;
      failedSessions: number;
      abandonedSessions: number;
    };
    timeToValue: { avgMessages: number; delta: number; thisWeek: number; lastWeek: number };
    topFeatureGap: FeatureGap | null;
    allFeatureGaps: FeatureGap[];
    releaseImpact: {
      last7: number;
      prev7: number;
      delta: number;
      byIntent: ReleaseIntentRow[];
    };
    segmentPerformance: {
      beginner: SegmentData;
      designer: SegmentData;
      developer: SegmentData;
    };
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function formatIntent(intent: string): string {
  const parts = intent.split(" > ");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function formatIntentFull(intent: string): string {
  return intent.replace(/_/g, " ");
}

function fmt$(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = "#6366f1",
  width = 88,
  height = 32,
}: {
  data: SparkPoint[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.rate);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 2;
  const pts = vals.map((v, i) => [
    pad + (i / (vals.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / range) * (height - pad * 2),
  ]);
  const pathD = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-zinc-500 w-16 capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${rate}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-200 w-7 text-right">{rate}%</span>
    </div>
  );
}

// ─── Delta badge ─────────────────────────────────────────────────────────────

function Delta({
  value,
  unit = "pp",
  invert = false,
  showZero = false,
}: {
  value: number;
  unit?: string;
  invert?: boolean;
  showZero?: boolean;
}) {
  if (value === 0 && !showZero)
    return <span className="text-xs text-zinc-500">No change</span>;
  const good = invert ? value < 0 : value > 0;
  const arrow = value > 0 ? "↑" : "↓";
  const abs = Math.abs(value);
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-md ${
        good
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {arrow} {abs}{unit} vs last week
    </span>
  );
}

// ─── Tooltip wrapper ─────────────────────────────────────────────────────────

function KPICard({
  children,
  tooltip,
  className = "",
}: {
  children: React.ReactNode;
  tooltip: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`relative rounded-2xl border border-white/[0.06] bg-[#13141b] p-5 cursor-pointer transition-colors hover:border-white/[0.12] hover:bg-[#15161e] ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {/* Info icon */}
      <div className="absolute top-4 right-4 w-4 h-4 rounded-full border border-white/10 flex items-center justify-center">
        <span className="text-[9px] text-zinc-500 font-bold leading-none">i</span>
      </div>
      {/* Tooltip */}
      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 w-72 rounded-xl border border-white/[0.08] bg-[#1a1b26] p-4 shadow-2xl pointer-events-none"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}

// ─── KPI: AI Success Rate ─────────────────────────────────────────────────────

function SuccessRateCard({ data }: { data: BriefingResponse["kpis"]["successRate"] }) {
  const color = data.delta >= 0 ? "#34d399" : "#f87171";
  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">AI Success Rate — 14-day trend</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Percentage of conversations that reached <span className="text-zinc-200">completed</span>{" "}
            status. Measures how often users successfully accomplish their goal in a single session.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {data.sparkline.slice(-7).map((d) => (
              <div key={d.date} className="flex justify-between text-xs">
                <span className="text-zinc-500">{d.date}</span>
                <span className="text-zinc-300 font-mono">{d.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        AI Success Rate
      </p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-bold text-white tabular-nums">{data.current}%</p>
          <div className="mt-2">
            <Delta value={data.delta} />
          </div>
        </div>
        <div className="pb-1">
          <Sparkline data={data.sparkline} color={color} />
        </div>
      </div>
    </KPICard>
  );
}

// ─── KPI: Revenue at Risk ────────────────────────────────────────────────────

function RevenueAtRiskCard({ data }: { data: BriefingResponse["kpis"]["revenueAtRisk"] }) {
  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">Revenue at Risk calculation</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Unique users who experienced a <span className="text-zinc-200">failed</span> or{" "}
            <span className="text-zinc-200">abandoned</span> session × $35 estimated MRR per user.
          </p>
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Failed sessions</span>
              <span className="text-red-400 font-mono">{data.failedSessions}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Abandoned sessions</span>
              <span className="text-amber-400 font-mono">{data.abandonedSessions}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Unique at-risk users (all-time)</span>
              <span className="text-zinc-200 font-mono">{data.usersAtRisk}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-white/[0.06]">
              <span className="text-zinc-300 font-medium">This week users at risk</span>
              <span className="text-zinc-200 font-mono">{data.thisWeekUsers}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-300 font-medium">Last week users at risk</span>
              <span className="text-zinc-200 font-mono">{data.lastWeekUsers}</span>
            </div>
          </div>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Revenue at Risk
      </p>
      <p className="text-4xl font-bold text-white tabular-nums">{fmt$(data.current)}</p>
      <p className="text-xs text-zinc-500 mt-1">{data.usersAtRisk} unique users · $35 MRR est.</p>
      <div className="mt-2">
        <Delta value={data.delta} unit="" invert={true} />
      </div>
    </KPICard>
  );
}

// ─── KPI: Time to Value ───────────────────────────────────────────────────────

function TimeToValueCard({ data }: { data: BriefingResponse["kpis"]["timeToValue"] }) {
  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">Time to Value</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Average number of prompts a user sends before their session reaches{" "}
            <span className="text-zinc-200">completed</span> status. Lower = faster value delivery.
          </p>
          <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">This week avg</span>
              <span className="text-zinc-200 font-mono">{data.thisWeek} prompts</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Last week avg</span>
              <span className="text-zinc-200 font-mono">{data.lastWeek} prompts</span>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            A rising TtV signals users are struggling to get the outcome they want — typically indicating prompt quality issues or model regressions.
          </p>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Time to Value
      </p>
      <p className="text-4xl font-bold text-white tabular-nums">{data.avgMessages}</p>
      <p className="text-xs text-zinc-500 mt-1">avg prompts to completion</p>
      <div className="mt-2">
        {/* Higher is worse for TtV */}
        <Delta value={data.delta} unit=" prompts" invert={true} />
      </div>
    </KPICard>
  );
}

// ─── KPI: Top Feature Gap ─────────────────────────────────────────────────────

function TopFeatureGapCard({
  gap,
  allGaps,
}: {
  gap: FeatureGap | null;
  allGaps: FeatureGap[];
}) {
  if (!gap)
    return (
      <KPICard tooltip={<p className="text-xs text-zinc-400">No intents below 50% completion.</p>}>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Top Feature Gap
        </p>
        <p className="text-zinc-400 text-sm">No gaps detected</p>
      </KPICard>
    );

  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">
            All intents below 50% completion ({allGaps.length})
          </p>
          <div className="space-y-1.5">
            {allGaps.slice(0, 7).map((g) => (
              <div key={g.intent} className="flex items-center justify-between text-xs gap-2">
                <span className="text-zinc-400 truncate">{formatIntentFull(g.intent)}</span>
                <span className="shrink-0 text-red-400 font-mono">{g.completionRate}%</span>
              </div>
            ))}
            {allGaps.length > 7 && (
              <p className="text-xs text-zinc-600">+{allGaps.length - 7} more</p>
            )}
          </div>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Top Feature Gap
      </p>
      <p className="text-lg font-semibold text-white capitalize leading-tight">
        {formatIntent(gap.intent)}
      </p>
      <p className="text-xs text-zinc-500 mt-0.5 capitalize">
        {gap.intent.split(" > ")[0].replace(/_/g, " ")}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div>
          <p className="text-2xl font-bold text-red-400 tabular-nums">{gap.completionRate}%</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">completion rate</p>
        </div>
        <div className="w-px h-8 bg-white/[0.06]" />
        <div>
          <p className="text-2xl font-bold text-zinc-200 tabular-nums">{gap.volume}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">sessions</p>
        </div>
      </div>
    </KPICard>
  );
}

// ─── KPI: Release Impact ──────────────────────────────────────────────────────

function ReleaseImpactCard({ data }: { data: BriefingResponse["kpis"]["releaseImpact"] }) {
  const deltaColor = data.delta >= 0 ? "text-emerald-400" : "text-red-400";
  const sign = data.delta >= 0 ? "+" : "";
  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">Release Impact — last 7 days vs prior 7</p>
          <p className="text-xs text-zinc-400">
            Average quality score shift between periods. A negative delta indicates a model update
            or release that degraded response quality.
          </p>
          <div className="space-y-1 pt-1 border-t border-white/[0.06]">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Last 7 days avg quality</span>
              <span className="text-zinc-200 font-mono">{data.last7}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Prior 7 days avg quality</span>
              <span className="text-zinc-200 font-mono">{data.prev7}</span>
            </div>
          </div>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Release Impact
      </p>
      <div className="flex items-end gap-2 mb-3">
        <p className={`text-4xl font-bold tabular-nums ${deltaColor}`}>
          {sign}{data.delta} pts
        </p>
      </div>
      <p className="text-xs text-zinc-500 mb-3">overall quality · last 7d vs prior 7d</p>
      {/* Per-intent breakdown */}
      <div className="space-y-1.5">
        {data.byIntent.slice(0, 5).map((row) => {
          const d = row.delta;
          const c = d >= 0 ? "text-emerald-400" : "text-red-400";
          const s = d >= 0 ? "+" : "";
          return (
            <div key={row.intent} className="flex items-center justify-between text-xs">
              <span className="text-zinc-500 truncate max-w-[148px] capitalize">
                {formatIntentFull(row.intent)}
              </span>
              <span className={`font-mono shrink-0 ${c}`}>
                {s}{d}
              </span>
            </div>
          );
        })}
      </div>
    </KPICard>
  );
}

// ─── KPI: Segment Performance ─────────────────────────────────────────────────

function SegmentPerformanceCard({
  data,
}: {
  data: BriefingResponse["kpis"]["segmentPerformance"];
}) {
  const segments: { key: keyof typeof data; color: string }[] = [
    { key: "developer", color: "#818cf8" },
    { key: "designer", color: "#a78bfa" },
    { key: "beginner", color: "#60a5fa" },
  ];

  return (
    <KPICard
      tooltip={
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-white">Segment Performance</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Completion rates by user experience level, derived from{" "}
            <span className="text-zinc-200">metadata.user_experience</span> field.
          </p>
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            {segments.map(({ key, color }) => {
              const s = data[key];
              return (
                <div key={key} className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-300 capitalize">{key}</span>
                    <span className="text-zinc-400 font-mono">
                      {s.completed}/{s.total} sessions
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.rate}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Segment Performance
      </p>
      <div className="space-y-3 mt-1">
        {segments.map(({ key, color }) => (
          <MiniBar
            key={key}
            label={key}
            rate={data[key].rate}
            color={color}
          />
        ))}
      </div>
      <p className="text-xs text-zinc-600 mt-4">completion rate by experience level</p>
    </KPICard>
  );
}

// ─── Briefing Card ────────────────────────────────────────────────────────────

function BriefingCard({ data }: { data: BriefingSection }) {
  const {
    successRateThisWeek,
    successRatePrevWeek,
    successRateDelta,
    failedUsersThisWeek,
    biggestRegression,
    fastestGrowing,
  } = data;

  const srDir = successRateDelta >= 0 ? "↑" : "↓";
  const srColor = successRateDelta >= 0 ? "text-emerald-400" : "text-red-400";

  // Recommendation logic
  let recommendation = "review completion rates across all intent categories";
  if (biggestRegression && Math.abs(biggestRegression.drop) >= 3) {
    recommendation = `investigate the ${formatIntent(biggestRegression.intent)} quality regression before it escalates`;
  } else if (fastestGrowing && fastestGrowing.pctChange > 20) {
    recommendation = `ensure quality keeps pace with ${formatIntent(fastestGrowing.intent)} growth`;
  }

  return (
    <div className="relative rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.06] via-[#13141b] to-blue-500/[0.04] p-6 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-blue-500/8 rounded-full blur-2xl pointer-events-none" />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* Pulse dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
              This Week&apos;s Briefing
            </span>
          </div>
          <span className="text-xs text-zinc-600">Auto-generated · {today()}</span>
        </div>

        {/* Narrative */}
        <div className="text-sm text-zinc-300 leading-[1.85] space-y-0 max-w-4xl">
          {/* Sentence 1: Success rate */}
          <p>
            This week: AI Success Rate{" "}
            <strong className="text-white font-semibold">{successRateThisWeek}%</strong>{" "}
            <span className={srColor}>
              ({srDir} from {successRatePrevWeek}% last week)
            </span>
            .{" "}
            {/* Sentence 2: Failed users */}
            <strong className="text-white font-semibold">{failedUsersThisWeek}</strong>{" "}
            {failedUsersThisWeek === 1 ? "user" : "users"} had failed or abandoned
            experiences this week.{" "}
            {/* Sentence 3: Regression */}
            {biggestRegression ? (
              <>
                Biggest regression:{" "}
                <strong className="text-white font-semibold">
                  {formatIntentFull(biggestRegression.intent)}
                </strong>{" "}
                quality dropped{" "}
                <strong className="text-red-400 font-semibold">
                  {Math.abs(biggestRegression.drop)} pts
                </strong>{" "}
                ({biggestRegression.prevWeek} → {biggestRegression.thisWeek}) vs last week.{" "}
              </>
            ) : (
              "No significant quality regressions detected this week. "
            )}
            {/* Sentence 4: Fastest growing */}
            {fastestGrowing ? (
              <>
                Fastest growing intent:{" "}
                <strong className="text-white font-semibold">
                  {formatIntentFull(fastestGrowing.intent)}
                </strong>{" "}
                up{" "}
                <strong className="text-emerald-400 font-semibold">
                  +{fastestGrowing.pctChange}%
                </strong>{" "}
                week-over-week ({fastestGrowing.prevWeekCount} → {fastestGrowing.thisWeekCount} sessions).{" "}
              </>
            ) : (
              "Intent volume distribution is stable week-over-week. "
            )}
            {/* Sentence 5: Recommendation */}
            <span className="text-zinc-400">
              Recommended: {recommendation}.
            </span>
          </p>
        </div>

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-white/[0.04]">
          <Pill
            label="This week"
            value={`${successRateThisWeek}% success`}
            color={successRateDelta >= 0 ? "emerald" : "red"}
          />
          <Pill
            label="At-risk users"
            value={`${failedUsersThisWeek} this week`}
            color="amber"
          />
          {biggestRegression && (
            <Pill
              label="Worst regression"
              value={`${Math.abs(biggestRegression.drop)}pt drop in ${formatIntent(biggestRegression.intent)}`}
              color="red"
            />
          )}
          {fastestGrowing && (
            <Pill
              label="Fastest growing"
              value={`+${fastestGrowing.pctChange}% ${formatIntent(fastestGrowing.intent)}`}
              color="indigo"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "amber" | "indigo";
}) {
  const styles = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    red: "bg-red-500/10 border-red-500/20 text-red-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${styles[color]}`}>
      <span className="text-zinc-500">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className}`} />
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Briefing skeleton */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#13141b] p-6 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-28 rounded-lg" />
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-6 w-36 rounded-lg" />
        </div>
      </div>
      {/* KPI grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#13141b] p-5 space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-4 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Overview() {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefing")
      .then((r) => {
        if (!r.ok) return r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`));
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(typeof e === "string" ? e : "Failed to load briefing"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load briefing</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const { briefing, kpis } = data;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Briefing</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          AI performance summary for product leadership · {today()}
        </p>
      </div>

      {/* Briefing narrative */}
      <BriefingCard data={briefing} />

      {/* KPI grid — 3 × 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <SuccessRateCard data={kpis.successRate} />
        <RevenueAtRiskCard data={kpis.revenueAtRisk} />
        <TimeToValueCard data={kpis.timeToValue} />
        <TopFeatureGapCard gap={kpis.topFeatureGap} allGaps={kpis.allFeatureGaps} />
        <ReleaseImpactCard data={kpis.releaseImpact} />
        <SegmentPerformanceCard data={kpis.segmentPerformance} />
      </div>
    </div>
  );
}
