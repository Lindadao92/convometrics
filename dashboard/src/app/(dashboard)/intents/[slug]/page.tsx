"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";

// ── Types ────────────────────────────────────────────────────────────────────

interface DimensionAvg {
  key: string;
  label: string;
  avg: number;
}

interface SentimentBreakdown {
  satisfied: number;
  neutral: number;
  frustrated: number;
  abandoned: number;
}

interface FailureEntry {
  type: string;
  label: string;
  count: number;
}

interface SampleConversation {
  id: string;
  timestamp: string;
  turns: number;
  quality: number;
  satisfaction: string;
  failureTags: string[];
  firstMessage: string;
}

interface IntentDetailData {
  name: string;
  slug: string;
  totalConversations: number;
  resolutionRate: number;
  avgTurns: number;
  avgQuality: number;
  dimensions: DimensionAvg[];
  sentimentBreakdown: SentimentBreakdown;
  topFailures: FailureEntry[];
  sampleConversations: SampleConversation[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 55) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-red-400";
}

function severityBadge(quality: number): { label: string; className: string } {
  if (quality < 40) return { label: "Critical", className: "bg-red-500/15 text-red-400 border-red-500/20" };
  if (quality < 60) return { label: "Needs Attention", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
  return { label: "Healthy", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
}

function satisfactionColor(s: string): string {
  switch (s) {
    case "satisfied": return "text-emerald-400";
    case "neutral": return "text-zinc-400";
    case "frustrated": return "text-amber-400";
    case "abandoned": return "text-red-400";
    default: return "text-zinc-500";
  }
}

function satisfactionLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Back + title */}
      <Bone className="h-4 w-24" />
      <div className="space-y-2">
        <Bone className="h-8 w-64" />
        <Bone className="h-5 w-20" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>

      {/* Sentiment */}
      <Bone className="h-32 rounded-xl" />

      {/* Dimensions */}
      <Bone className="h-80 rounded-xl" />

      {/* Failures */}
      <Bone className="h-40 rounded-xl" />

      {/* Table */}
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function IntentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();

  const [data, setData] = useState<IntentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/intents/${slug}?segment=${segment}&days=${effectiveDays}`)
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`))
      )
      .then((d: IntentDetailData) => setData(d))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [slug, segment, effectiveDays]);

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) return <DetailSkeleton />;

  // ── Error ──────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load intent detail</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const badge = severityBadge(data.avgQuality);
  const sentiment = data.sentimentBreakdown;
  const sentimentTotal = sentiment.satisfied + sentiment.neutral + sentiment.frustrated + sentiment.abandoned;

  const sentimentSegments = [
    { key: "satisfied", count: sentiment.satisfied, color: "bg-emerald-400", label: "Satisfied" },
    { key: "neutral", count: sentiment.neutral, color: "bg-zinc-500", label: "Neutral" },
    { key: "frustrated", count: sentiment.frustrated, color: "bg-amber-400", label: "Frustrated" },
    { key: "abandoned", count: sentiment.abandoned, color: "bg-red-400", label: "Abandoned" },
  ];

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* ── Back Button ──────────────────────────────────────────────────── */}
      <Link
        href="/intents"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Intents
      </Link>

      {/* ── Title + Badge ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold text-white">{data.name}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* ── 4-Stat Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
            Total Conversations
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {data.totalConversations.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
            Resolution Rate
          </p>
          <p className={`text-2xl font-bold tabular-nums ${scoreColor(data.resolutionRate)}`}>
            {data.resolutionRate}%
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
            Avg Turns
          </p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {data.avgTurns}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
            Avg Quality
          </p>
          <p className={`text-2xl font-bold tabular-nums ${scoreColor(data.avgQuality)}`}>
            {data.avgQuality}
          </p>
        </div>
      </div>

      {/* ── Sentiment Breakdown ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
          Sentiment Breakdown
        </p>

        {/* Stacked horizontal bar */}
        <div className="h-6 rounded-full overflow-hidden flex bg-white/[0.04]">
          {sentimentSegments.map((seg) => {
            const pct = sentimentTotal > 0 ? (seg.count / sentimentTotal) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={seg.key}
                className={`${seg.color} transition-all duration-500`}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${seg.count} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
          {sentimentSegments.map((seg) => {
            const pct = sentimentTotal > 0 ? Math.round((seg.count / sentimentTotal) * 100) : 0;
            return (
              <div key={seg.key} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
                <span className="text-xs text-zinc-400">{seg.label}</span>
                <span className="text-xs font-mono text-zinc-500">
                  {seg.count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quality Dimensions ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
          Quality Dimensions
        </p>

        <div className="space-y-3">
          {data.dimensions.map((dim) => (
            <div key={dim.key} className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 w-24 shrink-0 text-right">
                {dim.label}
              </span>
              <div className="flex-1 h-5 rounded bg-white/[0.04] overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all duration-500 ${barColor(dim.avg)}`}
                  style={{ width: `${dim.avg}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-semibold w-8 text-right tabular-nums ${scoreColor(dim.avg)}`}>
                {dim.avg}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Top Failures ─────────────────────────────────────────────────── */}
      {data.topFailures.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
            Top Failures
          </p>

          <div className="space-y-2">
            {data.topFailures.map((f) => (
              <div
                key={f.type}
                className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-sm text-zinc-300">{f.label}</span>
                <span className="text-xs font-mono font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-2.5 py-0.5">
                  {f.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sample Conversations ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
          Sample Conversations
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 pr-4">
                  ID
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 px-4">
                  Turns
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 px-4">
                  Quality
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 px-4">
                  Satisfaction
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 pl-4">
                  Failures
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sampleConversations.map((c) => {
                const isExpanded = expandedRow === c.id;
                return (
                  <tr key={c.id} className="group">
                    <td colSpan={5} className="p-0">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : c.id)}
                        className="w-full text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center py-2.5 border-b border-white/[0.04]">
                          <div className="pr-4 min-w-0">
                            <span className="text-xs font-mono text-zinc-400 truncate block">
                              {c.id}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {formatDate(c.timestamp)}
                            </span>
                          </div>
                          <div className="px-4 text-right shrink-0">
                            <span className="text-xs font-mono text-zinc-300 tabular-nums">
                              {c.turns}
                            </span>
                          </div>
                          <div className="px-4 text-right shrink-0">
                            <span className={`text-xs font-mono font-semibold tabular-nums ${scoreColor(c.quality)}`}>
                              {c.quality}
                            </span>
                          </div>
                          <div className="px-4 shrink-0">
                            <span className={`text-xs font-medium ${satisfactionColor(c.satisfaction)}`}>
                              {satisfactionLabel(c.satisfaction)}
                            </span>
                          </div>
                          <div className="pl-4 flex-1 min-w-0">
                            {c.failureTags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.failureTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] font-mono text-red-400 bg-red-400/10 rounded px-1.5 py-0.5"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600">--</span>
                            )}
                          </div>
                          <div className="pl-2 shrink-0">
                            <svg
                              className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded row: first message */}
                        {isExpanded && (
                          <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.04]">
                            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">
                              First Message
                            </p>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                              {c.firstMessage}
                            </p>
                          </div>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.sampleConversations.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-4">
            No sample conversations available.
          </p>
        )}
      </div>
    </div>
  );
}
