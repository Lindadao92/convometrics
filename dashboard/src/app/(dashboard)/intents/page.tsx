"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";
import { useAnalysis } from "@/lib/analysis-context";
import { transformUploadToTopics } from "@/lib/upload-data-transforms";
import { formatLabel } from "@/lib/formatLabel";
import { IntentBlock } from "@/components/IntentBlock";

// ── Types ────────────────────────────────────────────────────────────────────

interface IntentTopic {
  label: string;
  count: number;
  avgQuality: number | null;
  failureRate: number;
  completionRate?: number;
}

interface TopicsApiResponse {
  unclustered: IntentTopic[];
  totalConversations: number;
  uniqueTopicsCount: number;
}

type Severity = "critical" | "warning" | "good";

interface ClassifiedIntent extends IntentTopic {
  severity: Severity;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifySeverity(t: IntentTopic): Severity {
  const q = t.avgQuality ?? 100;
  const f = t.failureRate;
  if (q < 40 || f > 60) return "critical";
  if (q < 60 || f > 30) return "warning";
  return "good";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function IntentsSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Bone className="h-7 w-48" />
        <Bone className="h-4 w-80" />
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-[72px] rounded-xl" />
        ))}
      </div>

      {/* Section headers + grid */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="space-y-3">
          <Bone className="h-5 w-32" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Bone key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntentsPage() {
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const { results } = useAnalysis();

  const [data, setData] = useState<TopicsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (results?.data) {
      try {
        setData(transformUploadToTopics(results.data) as TopicsApiResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to transform upload data");
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/topics?segment=${segment}&days=${effectiveDays}`)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))
      )
      .then((d: TopicsApiResponse) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment, effectiveDays, results]);

  // ── Classify intents by severity ───────────────────────────────────────────

  const { critical, warning, good, avgQuality, criticalCount } = useMemo(() => {
    if (!data) return { critical: [], warning: [], good: [], avgQuality: null, criticalCount: 0 };

    const classified: ClassifiedIntent[] = data.unclustered.map((t) => ({
      ...t,
      severity: classifySeverity(t),
    }));

    const crit = classified.filter((t) => t.severity === "critical");
    const warn = classified.filter((t) => t.severity === "warning");
    const gd = classified.filter((t) => t.severity === "good");

    const allScores = data.unclustered
      .filter((t) => t.avgQuality !== null)
      .map((t) => t.avgQuality!);
    const avg =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : null;

    return { critical: crit, warning: warn, good: gd, avgQuality: avg, criticalCount: crit.length };
  }, [data]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) return <IntentsSkeleton />;

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load intents</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const totalIntents = data.unclustered.length;

  // ── Section renderer ───────────────────────────────────────────────────────

  function renderSection(
    title: string,
    items: ClassifiedIntent[],
    dotColor: string
  ) {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
          <span className="text-xs text-zinc-600 font-mono">({items.length})</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((t) => (
            <IntentBlock
              key={t.label}
              name={formatLabel(t.label)}
              sessions={t.count}
              success={t.avgQuality !== null ? Math.round(t.avgQuality) : null}
              status={t.severity}
              href={`/intents/${t.label}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Intent Analysis</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {data.totalConversations.toLocaleString()} conversations across{" "}
          {totalIntents} intents
        </p>
      </div>

      {/* ── Summary Stats Bar ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Total Intents
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">{totalIntents}</p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Critical
          </p>
          <p className={`text-2xl font-bold tabular-nums ${criticalCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {criticalCount}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Avg Quality
          </p>
          <p className={`text-2xl font-bold tabular-nums ${scoreColor(avgQuality)}`}>
            {avgQuality !== null ? avgQuality : "--"}
          </p>
        </div>
      </div>

      {/* ── Severity Sections ───────────────────────────────────────────── */}
      {renderSection("Critical", critical, "bg-red-400")}
      {renderSection("Needs Attention", warning, "bg-amber-400")}
      {renderSection("Performing Well", good, "bg-emerald-400")}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {totalIntents === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-12 text-center">
          <p className="text-zinc-500 text-sm">
            No intent data available for the selected time range.
          </p>
        </div>
      )}
    </div>
  );
}
