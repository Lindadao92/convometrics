"use client";

import { useEffect, useState } from "react";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RealityCheckData {
  total: number;
  reported: {
    resolution: number;
    csat: number;
    avgMessages: number;
    conversations: number;
  };
  actual: {
    resolution: number;
    csat: number;
    avgMessages: number;
    actualAvgMessages: number;
    conversations: number;
    falsePositives: number;
    loops: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Bone className="h-[420px] rounded-xl" />
        <Bone className="h-[420px] rounded-xl" />
      </div>
      <Bone className="h-32 rounded-xl" />
    </div>
  );
}

function DeltaBadge({ reported, actual, suffix = "%", inverted = false }: { reported: number; actual: number; suffix?: string; inverted?: boolean }) {
  const diff = actual - reported;
  const absDiff = Math.abs(diff);
  const formatted = absDiff < 0.1 ? "0" : absDiff.toFixed(1);

  // For metrics where lower is better (e.g., avg messages), we invert the color logic
  const isNegative = inverted ? diff > 0 : diff < 0;
  const isPositive = inverted ? diff < 0 : diff > 0;

  if (absDiff < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-500">
        ~0{suffix}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full ${
        isNegative
          ? "bg-red-500/10 text-red-400"
          : isPositive
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-zinc-500/10 text-zinc-500"
      }`}
    >
      {diff > 0 ? "+" : "-"}{formatted}{suffix}
    </span>
  );
}

// ─── Metric Row ──────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  suffix = "",
  muted = false,
  accent,
  explanation,
  delta,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  muted?: boolean;
  accent?: string;
  explanation?: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-white/[0.04] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${muted ? "text-zinc-600" : "text-zinc-400"}`}>
            {label}
          </p>
          {explanation && (
            <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">{explanation}</p>
          )}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {delta}
          <span
            className={`text-xl font-bold font-mono tabular-nums ${muted ? "text-zinc-500" : ""}`}
            style={accent ? { color: accent } : undefined}
          >
            {value}{suffix}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RealityCheck() {
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const [data, setData] = useState<RealityCheckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/reality-check?segment=${segment}&days=${effectiveDays}`)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))
      )
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment, effectiveDays]);

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

  const { reported, actual } = data;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Reality Check</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          What your dashboard reports vs what is actually happening &mdash; {data.total.toLocaleString()} conversations analyzed
        </p>
      </div>

      {/* Two-column comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Column: Reported */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-500/10 text-zinc-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-400">What Your Dashboard Says</h2>
              <p className="text-[11px] text-zinc-600">Surface-level metrics from raw conversation data</p>
            </div>
          </div>

          <MetricRow
            label="Resolution Rate"
            value={reported.resolution}
            suffix="%"
            muted
          />
          <MetricRow
            label="CSAT Score"
            value={reported.csat}
            suffix="/5"
            muted
          />
          <MetricRow
            label="Avg Messages to Resolution"
            value={reported.avgMessages}
            muted
          />
          <MetricRow
            label="Total Conversations"
            value={reported.conversations.toLocaleString()}
            muted
          />
        </div>

        {/* Right Column: Actual */}
        <div className="rounded-xl border border-red-500/15 bg-[#13141b] p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10 text-red-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">What&rsquo;s Actually Happening</h2>
              <p className="text-[11px] text-zinc-500">Adjusted for false positives, loops, and abandoned sessions</p>
            </div>
          </div>

          <MetricRow
            label="Resolution Rate"
            value={actual.resolution}
            suffix="%"
            accent={actual.resolution < reported.resolution ? "#f87171" : "#34d399"}
            explanation={`${actual.falsePositives} false positives removed — conversations marked resolved but user was frustrated or had multiple failures`}
            delta={<DeltaBadge reported={reported.resolution} actual={actual.resolution} />}
          />
          <MetricRow
            label="CSAT Score"
            value={actual.csat}
            suffix="/5"
            accent={actual.csat < reported.csat ? "#fbbf24" : "#34d399"}
            explanation="Excludes polite-but-unsatisfied users who expressed gratitude despite low quality scores"
            delta={<DeltaBadge reported={reported.csat} actual={actual.csat} suffix="" />}
          />
          <MetricRow
            label="Avg Messages (Successful Only)"
            value={actual.actualAvgMessages}
            accent="#60a5fa"
            explanation="Only counts conversations where the user was genuinely satisfied — excludes abandoned and frustrated sessions"
            delta={<DeltaBadge reported={reported.avgMessages} actual={actual.actualAvgMessages} inverted />}
          />
          <MetricRow
            label="Meaningful Conversations"
            value={actual.conversations.toLocaleString()}
            accent={actual.conversations < reported.conversations ? "#fbbf24" : "#34d399"}
            explanation={`${actual.loops} conversations excluded — loops, dead-end exchanges, and premature closures with 2-3 messages`}
            delta={<DeltaBadge reported={reported.conversations} actual={actual.conversations} suffix="" />}
          />
        </div>
      </div>

      {/* Summary insight bar */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Gap Analysis
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Resolution gap */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Resolution Gap</span>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-400">
              {Math.abs(reported.resolution - actual.resolution).toFixed(1)}%
            </p>
            <p className="text-[11px] text-zinc-600 leading-snug">
              {actual.falsePositives} conversations counted as resolved but users left frustrated or faced repeated failures.
            </p>
          </div>

          {/* CSAT gap */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300">CSAT Gap</span>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">
              {Math.abs(reported.csat - actual.csat).toFixed(2)}
            </p>
            <p className="text-[11px] text-zinc-600 leading-snug">
              Polite users inflate satisfaction scores. Real CSAT drops when you filter for genuine resolution.
            </p>
          </div>

          {/* Noise ratio */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300">Noise Ratio</span>
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-blue-400">
              {data.total > 0 ? Math.round((actual.loops / data.total) * 100) : 0}%
            </p>
            <p className="text-[11px] text-zinc-600 leading-snug">
              {actual.loops} of {data.total.toLocaleString()} conversations were loops, dead-ends, or premature closures that add noise to your metrics.
            </p>
          </div>
        </div>
      </div>

      {/* Visual gap bar */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
          Resolution Rate Comparison
        </p>
        <div className="space-y-4">
          {/* Reported bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Reported</span>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">{reported.resolution}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-600 transition-all duration-700"
                style={{ width: `${Math.min(reported.resolution, 100)}%` }}
              />
            </div>
          </div>

          {/* Actual bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Actual</span>
              <span className="text-xs font-mono text-red-400 tabular-nums">{actual.resolution}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(actual.resolution, 100)}%`,
                  backgroundColor: actual.resolution >= 70 ? "#34d399" : actual.resolution >= 50 ? "#fbbf24" : "#f87171",
                }}
              />
            </div>
          </div>

          {/* Gap indicator */}
          <div className="flex items-center gap-2 pt-1">
            <div
              className="h-1.5 rounded-full bg-red-500/30"
              style={{ width: `${Math.abs(reported.resolution - actual.resolution)}%` }}
            />
            <span className="text-[10px] text-red-400 font-mono whitespace-nowrap">
              {Math.abs(reported.resolution - actual.resolution).toFixed(1)}% gap
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
