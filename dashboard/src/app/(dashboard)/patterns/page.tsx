"use client";

import { useEffect, useState } from "react";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";
import { useAnalysis } from "@/lib/analysis-context";
import { transformUploadToPatterns } from "@/lib/upload-data-transforms";
import { formatLabel } from "@/lib/formatLabel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoliteChurnerExample {
  id: string;
  intent: string;
  turns: number;
  quality: number;
  signals: string[];
}

interface FrustrationTransferExample {
  id: string;
  intent: string;
  turns: number;
  quality: number;
  satisfaction: string;
}

interface ExhaustionLoopExample {
  id: string;
  intent: string;
  turns: number;
  quality: number;
}

interface PatternData {
  total: number;
  politeChurner: {
    count: number;
    pct: number;
    avgQuality: number;
    examples: PoliteChurnerExample[];
  };
  frustrationTransfer: {
    count: number;
    pct: number;
    avgTurns: number;
    examples: FrustrationTransferExample[];
  };
  exhaustionLoop: {
    count: number;
    pct: number;
    avgTurns: number;
    examples: ExhaustionLoopExample[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-56" />
      <Bone className="h-4 w-80" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function PatternBadge({ count, pct, accent }: { count: number; pct: number; accent: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4">
      <span className="text-3xl font-bold font-mono tabular-nums" style={{ color: accent }}>
        {count}
      </span>
      <span className="text-sm text-zinc-500">
        {pct}% of conversations
      </span>
    </div>
  );
}

// ─── Pattern Card Wrapper ─────────────────────────────────────────────────────

function PatternCard({
  title,
  subtitle,
  icon,
  accent,
  borderAccent,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  borderAccent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border bg-[#13141b] p-5 flex flex-col"
      style={{ borderColor: borderAccent }}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
          style={{ backgroundColor: accent + "18", color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Funnel Visual ────────────────────────────────────────────────────────────

function ChurnerFunnel({ count, avgQuality }: { count: number; avgQuality: number }) {
  const steps = [
    { label: "Said thanks", color: "#22c55e", width: "100%" },
    { label: "Quality < 50", color: "#f59e0b", width: "65%" },
    { label: "Likely to churn", color: "#f87171", width: "40%" },
  ];

  return (
    <div className="space-y-2 mb-4">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className="h-6 rounded-md flex items-center px-2.5 transition-all"
            style={{
              width: step.width,
              backgroundColor: step.color + "20",
              borderLeft: `3px solid ${step.color}`,
            }}
          >
            <span className="text-[11px] font-medium truncate" style={{ color: step.color }}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span className="text-zinc-700 text-xs shrink-0">&darr;</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">Avg Quality</p>
          <p className="text-lg font-mono font-bold text-red-400">{avgQuality}/100</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">Affected</p>
          <p className="text-lg font-mono font-bold text-amber-400">{count}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-mono font-medium" style={{ color: accent }}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HiddenPatterns() {
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const { results } = useAnalysis();
  const [data, setData] = useState<PatternData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (results?.data) {
      try {
        setData(transformUploadToPatterns(results.data) as PatternData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to transform upload data");
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetch(`/api/patterns?segment=${segment}&days=${effectiveDays}`)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))
      )
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment, effectiveDays, results]);

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

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Hidden Patterns</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Behavioral patterns that traditional metrics miss &mdash; {data.total.toLocaleString()} conversations analyzed
        </p>
      </div>

      {/* Pattern Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: The Polite Churner */}
        <PatternCard
          title="The Polite Churner"
          subtitle="Users who say &lsquo;thanks&rsquo; but didn&rsquo;t get what they needed"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          }
          accent="#f87171"
          borderAccent="rgba(248, 113, 113, 0.15)"
        >
          <PatternBadge
            count={data.politeChurner.count}
            pct={data.politeChurner.pct}
            accent="#f87171"
          />
          <ChurnerFunnel
            count={data.politeChurner.count}
            avgQuality={data.politeChurner.avgQuality}
          />
          {data.politeChurner.examples.length > 0 && (
            <div className="mt-auto">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
                Example Conversations
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-1.5 pr-2 text-zinc-600 font-medium">Intent</th>
                      <th className="text-right py-1.5 px-2 text-zinc-600 font-medium">Turns</th>
                      <th className="text-right py-1.5 pl-2 text-zinc-600 font-medium">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.politeChurner.examples.map((ex) => (
                      <tr key={ex.id} className="border-b border-white/[0.03]">
                        <td className="py-1.5 pr-2 text-zinc-300 truncate max-w-[140px]">
                          {formatLabel(ex.intent)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-zinc-400 font-mono tabular-nums">
                          {ex.turns}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-red-400">
                          {ex.quality}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PatternCard>

        {/* Card 2: Frustration Transfer */}
        <PatternCard
          title="Frustration Transfer"
          subtitle="Conversations that escalate or generate downstream frustration"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          }
          accent="#fbbf24"
          borderAccent="rgba(251, 191, 36, 0.15)"
        >
          <PatternBadge
            count={data.frustrationTransfer.count}
            pct={data.frustrationTransfer.pct}
            accent="#fbbf24"
          />
          <div className="space-y-0">
            <MetricRow
              label="Avg turns before escalation"
              value={`${data.frustrationTransfer.avgTurns} turns`}
              accent="#fbbf24"
            />
            <MetricRow
              label="Pattern frequency"
              value={`${data.frustrationTransfer.pct}%`}
              accent="#fbbf24"
            />
          </div>
          {data.frustrationTransfer.examples.length > 0 && (
            <div className="mt-auto pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
                Example Conversations
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-1.5 pr-2 text-zinc-600 font-medium">Intent</th>
                      <th className="text-right py-1.5 px-2 text-zinc-600 font-medium">Turns</th>
                      <th className="text-right py-1.5 px-2 text-zinc-600 font-medium">Quality</th>
                      <th className="text-right py-1.5 pl-2 text-zinc-600 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.frustrationTransfer.examples.map((ex) => (
                      <tr key={ex.id} className="border-b border-white/[0.03]">
                        <td className="py-1.5 pr-2 text-zinc-300 truncate max-w-[120px]">
                          {formatLabel(ex.intent)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-zinc-400 font-mono tabular-nums">
                          {ex.turns}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono tabular-nums text-amber-400">
                          {ex.quality}
                        </td>
                        <td className="py-1.5 pl-2 text-right">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              ex.satisfaction === "frustrated"
                                ? "text-amber-400 bg-amber-400/10"
                                : ex.satisfaction === "abandoned"
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-zinc-400 bg-white/[0.05]"
                            }`}
                          >
                            {ex.satisfaction}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PatternCard>

        {/* Card 3: The Exhaustion Loop */}
        <PatternCard
          title="The Exhaustion Loop"
          subtitle="Users who rephrase the same question multiple times"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          }
          accent="#f87171"
          borderAccent="rgba(248, 113, 113, 0.15)"
        >
          <PatternBadge
            count={data.exhaustionLoop.count}
            pct={data.exhaustionLoop.pct}
            accent="#f87171"
          />
          <div className="space-y-0">
            <MetricRow
              label="Avg turns in loop"
              value={`${data.exhaustionLoop.avgTurns} turns`}
              accent="#f87171"
            />
            <MetricRow
              label="Pattern frequency"
              value={`${data.exhaustionLoop.pct}%`}
              accent="#f87171"
            />
          </div>

          {/* Loop visual */}
          <div className="my-4 flex items-center justify-center gap-2">
            {["Ask", "Rephrase", "Retry", "Give up"].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className="px-2.5 py-1.5 rounded-md text-[10px] font-medium"
                  style={{
                    backgroundColor: i < 3 ? "rgba(248, 113, 113, 0.1)" : "rgba(248, 113, 113, 0.2)",
                    color: i < 3 ? "#fca5a5" : "#f87171",
                    border: i === 3 ? "1px solid rgba(248, 113, 113, 0.3)" : "1px solid transparent",
                  }}
                >
                  {step}
                </div>
                {i < 3 && (
                  <span className="text-zinc-700 text-xs">&rarr;</span>
                )}
              </div>
            ))}
          </div>

          {data.exhaustionLoop.examples.length > 0 && (
            <div className="mt-auto pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
                Example Conversations
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-1.5 pr-2 text-zinc-600 font-medium">Intent</th>
                      <th className="text-right py-1.5 px-2 text-zinc-600 font-medium">Turns</th>
                      <th className="text-right py-1.5 pl-2 text-zinc-600 font-medium">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.exhaustionLoop.examples.map((ex) => (
                      <tr key={ex.id} className="border-b border-white/[0.03]">
                        <td className="py-1.5 pr-2 text-zinc-300 truncate max-w-[140px]">
                          {formatLabel(ex.intent)}
                        </td>
                        <td className="py-1.5 px-2 text-right text-zinc-400 font-mono tabular-nums">
                          {ex.turns}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-red-400">
                          {ex.quality}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </PatternCard>
      </div>
    </div>
  );
}
