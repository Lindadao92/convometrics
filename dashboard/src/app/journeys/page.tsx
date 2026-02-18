"use client";

import { useEffect, useState, Fragment } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelStage {
  stage:      string;
  count:      number;
  pctOfFirst: number;
  pctOfPrev:  number;
}

interface Conversation {
  conversation_id:   string | null;
  intent:            string | null;
  quality_score:     number | null;
  completion_status: string | null;
  created_at:        string;
}

interface User {
  user_id:       string;
  totalSessions: number;
  firstSeen:     string;
  lastSeen:      string;
  intents:       string[];
  successRate:   number;
  status:        "active" | "churned";
  conversations: Conversation[];
}

interface JourneyData {
  funnel: FunnelStage[];
  users:  User[];
}

// ── Visual constants ──────────────────────────────────────────────────────────

const FUNNEL_COLORS = [
  { bg: "bg-indigo-500/25",  border: "border-indigo-500/30",  text: "text-indigo-200"  },
  { bg: "bg-blue-500/20",    border: "border-blue-500/25",    text: "text-blue-300"    },
  { bg: "bg-violet-500/20",  border: "border-violet-500/25",  text: "text-violet-300"  },
  { bg: "bg-purple-500/15",  border: "border-purple-500/20",  text: "text-purple-300"  },
  { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/20", text: "text-fuchsia-300" },
] as const;

const INTENT_COLORS: Record<string, string> = {
  scaffold_app:    "bg-violet-500/20 text-violet-300 border-violet-500/30",
  add_feature:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  fix_bug:         "bg-red-500/20 text-red-300 border-red-500/30",
  change_styling:  "bg-pink-500/20 text-pink-300 border-pink-500/30",
  connect_api:     "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  make_responsive: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  add_auth:        "bg-amber-500/20 text-amber-300 border-amber-500/30",
  deploy_app:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  fix_break_loop:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  failed:    "bg-red-500/15 text-red-400",
  abandoned: "bg-zinc-500/15 text-zinc-500",
  partial:   "bg-amber-500/15 text-amber-300",
};

function intentColor(intent: string) {
  return INTENT_COLORS[intent] ?? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
}

function scoreColor(s: number | null) {
  if (s === null) return "text-zinc-600";
  if (s >= 75)   return "text-emerald-400";
  if (s >= 50)   return "text-amber-400";
  return "text-red-400";
}

function srColor(rate: number) {
  if (rate >= 60) return "text-emerald-400";
  if (rate >= 40) return "text-amber-400";
  return "text-red-400";
}

// ── Funnel chart ──────────────────────────────────────────────────────────────

function FunnelChart({ funnel }: { funnel: FunnelStage[] }) {
  if (!funnel.length) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
      <h2 className="text-sm font-semibold text-zinc-300 mb-1">Activation Funnel</h2>
      <p className="text-xs text-zinc-600 mb-6">
        Unique users who completed each stage at least once
      </p>

      <div className="space-y-0">
        {funnel.map((stage, i) => {
          const color    = FUNNEL_COLORS[Math.min(i, FUNNEL_COLORS.length - 1)];
          const barWidth = Math.max(stage.pctOfFirst, 8);
          const convPct  = stage.pctOfPrev;
          const convColor =
            convPct >= 70 ? "text-emerald-500" :
            convPct >= 50 ? "text-amber-500"   : "text-red-500";

          return (
            <div key={stage.stage}>
              {/* Conversion indicator between stages */}
              {i > 0 && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="h-4 w-px bg-white/[0.07]" />
                  <span className={`text-[11px] font-medium ${convColor}`}>
                    ↓ {convPct}% continued
                  </span>
                  <div className="h-4 w-px bg-white/[0.07]" />
                </div>
              )}

              {/* Bar row */}
              <div className="flex items-center gap-4">
                {/* Left: stage name */}
                <div className="w-44 shrink-0 text-right">
                  <span className="text-[11px] text-zinc-600 font-mono tabular-nums">{i + 1}.</span>{" "}
                  <span className="text-sm text-zinc-300 font-medium">{stage.stage}</span>
                </div>

                {/* Center: the bar — centered by mx-auto */}
                <div className="flex-1 flex items-center">
                  <div
                    className={`h-11 rounded-lg ${color.bg} border ${color.border} mx-auto
                               flex items-center justify-center px-4 transition-all`}
                    style={{ width: `${barWidth}%` }}
                  >
                    {barWidth >= 22 && (
                      <span className={`text-xs font-semibold ${color.text} whitespace-nowrap`}>
                        {stage.pctOfFirst}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: count */}
                <div className="w-28 shrink-0 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-white tabular-nums">{stage.count}</span>
                  <span className="text-xs text-zinc-600">users</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      {funnel.length >= 2 && (
        <div className="mt-6 pt-4 border-t border-white/[0.05] flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-zinc-600">Total in funnel</p>
            <p className="text-lg font-bold text-white tabular-nums">{funnel[0].count}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Reached end</p>
            <p className="text-lg font-bold text-fuchsia-400 tabular-nums">
              {funnel[funnel.length - 1].count}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Overall conversion</p>
            <p className="text-lg font-bold text-white tabular-nums">
              {funnel[funnel.length - 1].pctOfFirst}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Biggest drop-off</p>
            {(() => {
              let worst = funnel[1];
              for (const s of funnel.slice(2)) {
                if (s.pctOfPrev < worst.pctOfPrev) worst = s;
              }
              return (
                <p className="text-lg font-bold text-red-400">
                  {worst?.stage}{" "}
                  <span className="text-sm font-normal text-red-500">({worst?.pctOfPrev}%)</span>
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Intent badge ──────────────────────────────────────────────────────────────

function IntentBadge({ intent, small = false }: { intent: string; small?: boolean }) {
  return (
    <span
      className={`inline-block border rounded font-medium capitalize whitespace-nowrap
                  ${intentColor(intent)} ${small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"}`}
    >
      {intent.replace(/_/g, " ")}
    </span>
  );
}

// ── Conversation timeline (expanded row) ──────────────────────────────────────

function ConversationTimeline({ conversations }: { conversations: Conversation[] }) {
  return (
    <div className="px-8 py-5 bg-[#0c0d12]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-4">
        Conversation History · {conversations.length} sessions
      </p>
      <div className="space-y-0 pl-1">
        {conversations.map((conv, i) => {
          const isLast = i === conversations.length - 1;
          const date   = new Date(conv.created_at).toLocaleDateString("en-US", {
            month: "short",
            day:   "numeric",
          });
          const statusCls = conv.completion_status
            ? (STATUS_BADGE[conv.completion_status] ?? "bg-zinc-500/15 text-zinc-500")
            : "";

          return (
            <div key={i} className="flex gap-4">
              {/* Timeline spine */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-indigo-500/50 mt-[18px] shrink-0" />
                {!isLast && <div className="w-px flex-1 bg-white/[0.05] mt-1" style={{ minHeight: 20 }} />}
              </div>

              {/* Row content */}
              <div className="flex items-center gap-3 flex-wrap py-2.5 min-w-0">
                <span className="text-xs text-zinc-600 w-12 shrink-0 tabular-nums">{date}</span>

                {conv.intent ? (
                  <IntentBadge intent={conv.intent} small />
                ) : (
                  <span className="text-xs text-zinc-700 italic">no intent</span>
                )}

                {conv.quality_score !== null && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${scoreColor(conv.quality_score)}`}>
                    {conv.quality_score}
                  </span>
                )}

                {conv.completion_status && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${statusCls}`}>
                    {conv.completion_status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── User table row ────────────────────────────────────────────────────────────

function UserRow({
  user,
  isExpanded,
  onToggle,
}: {
  user:       User;
  isExpanded: boolean;
  onToggle:   () => void;
}) {
  const MAX_BADGES    = 2;
  const visibleIntents = user.intents.slice(0, MAX_BADGES);
  const overflow       = user.intents.length - MAX_BADGES;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className={`border-b border-white/[0.04] cursor-pointer transition-colors
                    ${isExpanded ? "bg-indigo-500/[0.05]" : "hover:bg-white/[0.02]"}`}
      >
        {/* User ID */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isExpanded && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
            )}
            <span className="text-xs font-mono text-zinc-400">
              {user.user_id.slice(0, 8)}
              <span className="text-zinc-700">…</span>
            </span>
          </div>
        </td>

        {/* Sessions */}
        <td className="px-4 py-3 text-sm text-zinc-300 tabular-nums">{user.totalSessions}</td>

        {/* First seen */}
        <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
          {fmt(user.firstSeen)}
        </td>

        {/* Last seen */}
        <td className="px-4 py-3 text-xs text-zinc-500 tabular-nums whitespace-nowrap">
          {fmt(user.lastSeen)}
        </td>

        {/* Intents */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {visibleIntents.map((intent) => (
              <IntentBadge key={intent} intent={intent} small />
            ))}
            {overflow > 0 && (
              <span className="text-[10px] text-zinc-600 font-medium">+{overflow}</span>
            )}
          </div>
        </td>

        {/* Success rate */}
        <td className="px-4 py-3">
          <span className={`text-sm font-semibold tabular-nums ${srColor(user.successRate)}`}>
            {user.successRate}%
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <span
            className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full
                        ${user.status === "active"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-zinc-500/15 text-zinc-500"}`}
          >
            {user.status}
          </span>
        </td>

        {/* Chevron */}
        <td className="px-4 py-3 text-zinc-700 text-xs">
          <span className={`transition-transform inline-block ${isExpanded ? "rotate-180" : ""}`}>▼</span>
        </td>
      </tr>

      {/* Expanded timeline */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <ConversationTimeline conversations={user.conversations} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JourneysPage() {
  const [data,         setData]         = useState<JourneyData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [filter,       setFilter]       = useState<"all" | "active" | "churned">("all");

  useEffect(() => {
    fetch("/api/journeys")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-sm">Loading journeys…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-red-400 text-sm">Failed to load data.</span>
      </div>
    );
  }

  const { funnel, users } = data;

  const filteredUsers =
    filter === "all" ? users : users.filter((u) => u.status === filter);

  const activeCount  = users.filter((u) => u.status === "active").length;
  const churnedCount = users.filter((u) => u.status === "churned").length;

  const toggleUser = (id: string) =>
    setExpandedUser((prev) => (prev === id ? null : id));

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">User Journeys</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Funnel progression and per-user conversation history
        </p>
      </div>

      {/* Funnel */}
      <FunnelChart funnel={funnel} />

      {/* User table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
        {/* Table header bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-300">User Journeys</h2>
            <span className="text-xs text-zinc-600">{users.length} users</span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {(["all", "active", "churned"] as const).map((f) => {
              const count = f === "all" ? users.length : f === "active" ? activeCount : churnedCount;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    filter === f
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {f} <span className="text-zinc-700 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["User", "Sessions", "First Seen", "Last Seen", "Intents Attempted", "Success Rate", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-700 text-sm">
                    No users match this filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <UserRow
                    key={user.user_id}
                    user={user}
                    isExpanded={expandedUser === user.user_id}
                    onToggle={() => toggleUser(user.user_id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
