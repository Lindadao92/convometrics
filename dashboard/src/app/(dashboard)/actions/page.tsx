"use client";

import { useEffect, useState } from "react";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Action {
  priority: number;
  title: string;
  description: string;
  intent: string;
  effort: "low" | "medium" | "high";
  impact: string;
  metric: string;
  conversations: number;
  failCount: number;
}

interface ActionsData {
  actions: Action[];
  totalConversations: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div className="space-y-2">
        <Bone className="h-7 w-56" />
        <Bone className="h-4 w-80" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <Bone key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

const EFFORT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:    { label: "Low Effort",    color: "#34d399", bg: "rgba(52, 211, 153, 0.1)" },
  medium: { label: "Medium Effort", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" },
  high:   { label: "High Effort",   color: "#f87171", bg: "rgba(248, 113, 113, 0.1)" },
};

const PRIORITY_COLORS = [
  "#f87171", // 1 - red
  "#fb923c", // 2 - orange
  "#fbbf24", // 3 - amber
  "#60a5fa", // 4 - blue
  "#a78bfa", // 5 - purple
];

function fmt(n: number): string {
  return n.toLocaleString();
}

// ─── Action Card ──────────────────────────────────────────────────────────────

function ActionCard({ action }: { action: Action }) {
  const effortCfg = EFFORT_CONFIG[action.effort] ?? EFFORT_CONFIG.medium;
  const priorityColor = PRIORITY_COLORS[action.priority - 1] ?? "#a1a1aa";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5 hover:border-white/[0.12] transition-colors">
      <div className="flex items-start gap-4">
        {/* Priority badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold font-mono"
          style={{
            backgroundColor: priorityColor + "15",
            color: priorityColor,
            border: `1px solid ${priorityColor}30`,
          }}
        >
          {action.priority}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-semibold text-white leading-snug">
              {action.title}
            </h3>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
              style={{
                color: effortCfg.color,
                backgroundColor: effortCfg.bg,
              }}
            >
              {effortCfg.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            {action.description}
          </p>

          {/* Metrics row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Impact */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xs text-emerald-400 font-medium">{action.impact}</span>
            </div>

            {/* Failure metric */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-red-400 font-mono">{action.metric}</span>
            </div>

            {/* Conversations */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs text-zinc-500">{fmt(action.conversations)} conversations</span>
            </div>

            {/* Fail count */}
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="text-xs text-zinc-500">{fmt(action.failCount)} failures</span>
            </div>
          </div>

          {/* Impact bar */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, action.failCount > 0 ? (action.failCount / action.conversations) * 100 : 0)}%`,
                  backgroundColor: action.effort === "high" ? "#f87171" : action.effort === "medium" ? "#fbbf24" : "#34d399",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Recommendations() {
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const [data, setData] = useState<ActionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/actions?segment=${segment}&days=${effectiveDays}`)
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

  const totalFailures = data.actions.reduce((s, a) => s + a.failCount, 0);
  const totalProjected = data.actions.reduce((s, a) => s + Math.round(a.failCount * 0.6), 0);

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Recommendations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Prioritized actions to improve conversation quality &mdash; based on {data.totalConversations.toLocaleString()} conversations
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Action Items</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">{data.actions.length}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Total Failures</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-400 mt-1">{fmt(totalFailures)}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Projected Savings</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">~{fmt(totalProjected)}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">fewer failures if addressed</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Conversations</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">{fmt(data.totalConversations)}</p>
        </div>
      </div>

      {/* Action cards */}
      {data.actions.length > 0 ? (
        <div className="space-y-4">
          {data.actions.map((action) => (
            <ActionCard key={action.priority} action={action} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center">
          <p className="text-zinc-400 text-sm mb-1">No recommendations available</p>
          <p className="text-zinc-600 text-xs">
            Not enough conversation data to generate actionable recommendations.
          </p>
        </div>
      )}

      {/* Footer note */}
      {data.actions.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4">
          <div className="flex items-start gap-3">
            <svg className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Recommendations are sorted by failure count. Impact projections assume ~60% of failures are addressable through prompt engineering, knowledge base improvements, or conversation flow redesign. Effort estimates are based on failure rate severity.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
