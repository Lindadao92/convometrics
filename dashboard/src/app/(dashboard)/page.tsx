"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";
import { useAnalysis } from "@/lib/analysis-context";
import { transformUploadToOverview } from "@/lib/upload-data-transforms";
import { formatLabel } from "@/lib/formatLabel";
import { StatCard } from "@/components/StatCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverviewStats {
  total: number;
  analyzed: number;
  avgQuality: number | null;
  completionRate: number | null;
  failureRate: number | null;
  avgTurns: number | null;
  totalMessages: number;
  topTopic: string | null;
}

interface QualityBucket {
  label: string;
  count: number;
}

interface StatusBucket {
  status: string;
  count: number;
}

interface TopPerformingTopic {
  intent: string;
  avgQuality: number;
  count: number;
  completionRate: number;
}

interface WorstPerformingTopic {
  intent: string;
  avgQuality: number;
  count: number;
  failRate: number;
}

interface OverviewData {
  stats: OverviewStats;
  healthScore: number | null;
  qualityDistribution: QualityBucket[];
  statusBreakdown: StatusBucket[];
  topPerformingTopics: TopPerformingTopic[];
  worstPerformingTopics: WorstPerformingTopic[];
}

// ─── Quick Nav Links ──────────────────────────────────────────────────────────

const QUICK_NAV: { href: string; label: string; description: string; icon: React.ReactNode }[] = [
  {
    href: "/intents",
    label: "Intent Analysis",
    description: "Drill into each conversation intent",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/conversations",
    label: "Conversations",
    description: "Browse and search all conversations",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/patterns",
    label: "Hidden Patterns",
    description: "Discover unexpected conversation trends",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    href: "/reality-check",
    label: "Reality Check",
    description: "Compare expectations vs actual performance",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    href: "/actions",
    label: "Recommendations",
    description: "AI-powered action items to improve",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString();
}

function pct(n: number | null): string {
  return n !== null ? `${n}%` : "--";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function healthColor(score: number): { ring: string; text: string; bg: string; label: string } {
  if (score > 70) return { ring: "#34d399", text: "text-emerald-400", bg: "bg-emerald-500/10", label: "Healthy" };
  if (score > 40) return { ring: "#fbbf24", text: "text-amber-400", bg: "bg-amber-500/10", label: "Needs Work" };
  return { ring: "#f87171", text: "text-red-400", bg: "bg-red-500/10", label: "Critical" };
}

function timeRangeLabel(days: number): string {
  if (days <= 1) return "today";
  if (days <= 2) return "yesterday";
  if (days <= 7) return "last 7 days";
  if (days <= 30) return "last 30 days";
  if (days <= 90) return "last 3 months";
  if (days <= 180) return "last 6 months";
  return "last 12 months";
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function OverviewSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Bone className="h-7 w-40" />
        <Bone className="h-4 w-72" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>

      {/* Health score */}
      <Bone className="h-52 rounded-xl" />

      {/* Two-column section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Bone className="h-56 rounded-xl" />
        <Bone className="h-56 rounded-xl" />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Health Score Gauge ───────────────────────────────────────────────────────

function HealthGauge({ score }: { score: number }) {
  const { ring, text, bg, label } = healthColor(score);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
        Health Score
      </p>

      <div className="flex items-center gap-8">
        {/* Circular gauge */}
        <div className="relative w-36 h-36 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            {/* Background ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="8"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              fill="none"
              stroke={ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${text}`}>{score}</span>
            <span className="text-[10px] text-zinc-500">/ 100</span>
          </div>
        </div>

        {/* Explanation */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
              {label}
            </span>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {score > 70
              ? "Your AI conversations are performing well overall. Users are completing tasks and quality scores are strong."
              : score > 40
                ? "There is room for improvement. Some intents have high failure rates or low quality scores that need attention."
                : "Several conversation areas need urgent attention. Review the worst-performing topics below and check the Recommendations page."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Topic List Item ──────────────────────────────────────────────────────────

function TopicItem({
  intent,
  quality,
  count,
  metric,
  metricLabel,
  variant,
}: {
  intent: string;
  quality: number;
  count: number;
  metric: number;
  metricLabel: string;
  variant: "good" | "bad";
}) {
  const isGood = variant === "good";
  const dotColor = isGood ? "bg-emerald-400" : "bg-red-400";
  const qualityColor = scoreColor(quality);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 truncate">{formatLabel(intent)}</p>
        <p className="text-xs text-zinc-600">{fmt(count)} conversations</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-mono font-medium tabular-nums ${qualityColor}`}>
          {quality}
        </p>
        <p className="text-[10px] text-zinc-600">{metricLabel}: {metric}%</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const { results } = useAnalysis();

  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If we have uploaded CSV results, use those directly
    if (results?.data) {
      try {
        setData(transformUploadToOverview(results.data) as OverviewData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to transform upload data");
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = `/api/overview?segment=${segment}&days=${effectiveDays}`;

    fetch(url)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))
      )
      .then((d: OverviewData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment, effectiveDays, results]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return <OverviewSkeleton />;

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load overview</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const { stats, healthScore, topPerformingTopics, worstPerformingTopics } = data;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Overview</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {fmt(stats.total)} conversations analyzed over the {timeRangeLabel(effectiveDays)}
        </p>
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Conversations"
          value={fmt(stats.total)}
          sub={`${fmt(stats.analyzed)} analyzed`}
        />
        <StatCard
          label="Avg Quality Score"
          value={stats.avgQuality !== null ? stats.avgQuality : "--"}
          sub={stats.avgQuality !== null ? "out of 100" : "no data yet"}
        />
        <StatCard
          label="Completion Rate"
          value={pct(stats.completionRate)}
          sub={stats.completionRate !== null ? "tasks completed" : "no data yet"}
        />
        <StatCard
          label="Failure Rate"
          value={pct(stats.failureRate)}
          sub={stats.failureRate !== null ? "failed or abandoned" : "no data yet"}
        />
      </div>

      {/* ── Health Score Gauge ───────────────────────────────────────────── */}
      {healthScore !== null ? (
        <HealthGauge score={healthScore} />
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">
            Health Score
          </p>
          <p className="text-sm text-zinc-500">
            Not enough analyzed conversations to calculate a health score yet.
          </p>
        </div>
      )}

      {/* ── Top / Worst Performing ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Performing */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">
            Top Performing
          </p>
          <p className="text-xs text-zinc-600 mb-4">Highest quality intents by score</p>

          {topPerformingTopics.length > 0 ? (
            <div>
              {topPerformingTopics.slice(0, 3).map((t) => (
                <TopicItem
                  key={t.intent}
                  intent={t.intent}
                  quality={t.avgQuality}
                  count={t.count}
                  metric={t.completionRate}
                  metricLabel="completion"
                  variant="good"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No data available yet.</p>
          )}
        </div>

        {/* Needs Attention */}
        <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-5">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">
            Needs Attention
          </p>
          <p className="text-xs text-zinc-600 mb-4">Lowest quality intents that need improvement</p>

          {worstPerformingTopics.length > 0 ? (
            <div>
              {worstPerformingTopics.slice(0, 3).map((t) => (
                <TopicItem
                  key={t.intent}
                  intent={t.intent}
                  quality={t.avgQuality}
                  count={t.count}
                  metric={t.failRate}
                  metricLabel="fail rate"
                  variant="bad"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">No data available yet.</p>
          )}
        </div>
      </div>

      {/* ── Quick Nav Links ─────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">
          Explore
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {QUICK_NAV.map(({ href, label, description, icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-white/[0.07] bg-[#13141b] p-4 hover:border-indigo-500/30 hover:bg-indigo-500/[0.04] transition-all"
            >
              <div className="text-zinc-500 group-hover:text-indigo-400 transition-colors mb-2">
                {icon}
              </div>
              <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                {label}
              </p>
              <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
