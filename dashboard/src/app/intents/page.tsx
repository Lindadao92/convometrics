"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface IntentSummary {
  intent: string;
  count: number;
  countThisWeek: number;
  avgScore: number | null;
  completionRate: number;
  failureRate: number;
  impactScore: number;
  statuses: Record<string, number>;
}

interface Message {
  role: string;
  content: string;
}

interface FailedConversation {
  id: string;
  conversation_id: string;
  user_id: string | null;
  quality_score: number | null;
  completion_status: string | null;
  abandon_point: number | null;
  created_at: string;
  messages: Message[];
}

interface FailurePattern {
  label:   string;
  pct:     number;
  example: string;
}

interface IntentDetail {
  intent: string;
  completionBreakdown: Record<string, number>;
  failedConversations: FailedConversation[];
  typicalAbandonPoint: number | null;
  abandonmentAiResponse: string | null;
  failurePatterns: FailurePattern[] | null;
}

const PIE_COLORS: Record<string, string> = {
  completed: "#10b981",
  partial:   "#f59e0b",
  abandoned: "#475569",
  failed:    "#ef4444",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  partial:   "bg-amber-500/15 text-amber-300",
  abandoned: "bg-zinc-500/15 text-zinc-400",
  failed:    "bg-red-500/15 text-red-300",
};

const RECOMMENDED_ACTIONS: Record<string, string> = {
  scaffold_app:
    "✅ Working well. Protect this — any model changes should be regression-tested against scaffold quality.",
  add_feature:
    "⚠️ Quality degrades as app complexity grows. Consider: limit scope per prompt, suggest users break features into smaller steps, add pre-check that validates existing code before modifying.",
  fix_bug:
    "🔴 High volume, low success. Root cause: AI patches symptoms not causes. Action: add architectural context to the prompt so AI understands the full codebase before fixing.",
  connect_api:
    "🔴 Fastest growing intent, worst success rate. Action: build pre-built integrations for top 5 APIs (Stripe, Auth0, SendGrid, Twilio, OpenAI) instead of relying on generic code generation.",
  fix_break_loop:
    "🚨 Critical. 88% of users who enter this pattern churn. Action: detect when a user is on their 3rd consecutive fix attempt and intervene — offer to reset to last working state or connect with support.",
};

const SUGGESTED_ACTIONS: Record<string, string> = {
  fix_break_loop:
    "Add a recovery flow for stuck conversations. Surface a 'start fresh' option after 3 failed attempts and offer human escalation when users loop more than twice.",
  connect_api:
    "Improve API error messages with specific troubleshooting steps. Add example payloads, authentication guides, and common error-code explanations inline.",
  make_responsive:
    "Provide a responsive design checklist with a real-time preview toggle. Offer pre-built responsive templates for the most common layouts.",
  add_feature:
    "Break complex feature requests into step-by-step guided prompts. Add a complexity indicator so users calibrate expectations before starting.",
  fix_bug:
    "Add a diagnostic flow that asks clarifying questions before generating fixes. Surface similar previously resolved bugs as references.",
  change_styling:
    "Introduce a visual style picker with before/after previews. Let users reference a URL or upload a screenshot to match a target style.",
  add_auth:
    "Create a guided auth setup wizard: provider selection → configuration → testing. Aim to reduce setup to 3 clear steps.",
  deploy_app:
    "Add a deployment readiness checklist with pre-flight checks. Offer one-click deploy to Vercel/Netlify with real-time status updates.",
  scaffold_app:
    "This intent performs well. Consider making it the recommended starting point for new users during onboarding.",
};

const DEFAULT_ACTION =
  "Review the recent failed conversations to identify the most common failure point, then add targeted guidance or guardrails for that specific step.";

const SEGMENTS = [
  { value: "all",       label: "All Users" },
  { value: "beginner",  label: "Beginner"  },
  { value: "designer",  label: "Designer"  },
  { value: "developer", label: "Developer" },
] as const;

type SegmentValue = (typeof SEGMENTS)[number]["value"];

interface SegmentStats {
  avgScore: number | null;
  completionRate: number;
  count: number;
}

function scoreColor(s: number | null) {
  if (s === null) return "text-zinc-600";
  if (s > 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  return "text-red-400";
}

function impactBarColor(failureRate: number) {
  if (failureRate >= 50) return "bg-red-500";
  if (failureRate >= 25) return "bg-amber-500";
  return "bg-yellow-400";
}

export default function IntentsPage() {
  const [summary, setSummary]               = useState<IntentSummary[]>([]);
  const [segmentSummary, setSegmentSummary] = useState<Record<string, SegmentStats>>({});
  const [segment, setSegment]               = useState<SegmentValue>("all");
  const [detail, setDetail]                 = useState<IntentDetail | null>(null);
  const [selected, setSelected]             = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [detailLoading, setDetailLoading]   = useState(false);
  const [expandedId, setExpandedId]         = useState<string | null>(null);

  const fetchSummary = useCallback(async (seg: SegmentValue) => {
    setLoading(true);
    try {
      const params = seg !== "all" ? `?segment=${encodeURIComponent(seg)}` : "";
      const res    = await fetch(`/api/intents${params}`);
      const data   = await res.json();
      setSummary(data.summary ?? []);
      setSegmentSummary(data.segmentSummary ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (intent: string, seg: SegmentValue) => {
    setDetailLoading(true);
    setExpandedId(null);
    try {
      const params = seg !== "all" ? `&segment=${encodeURIComponent(seg)}` : "";
      const res    = await fetch(`/api/intents?intent=${encodeURIComponent(intent)}${params}`);
      const data   = await res.json();
      setDetail(data.detail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(segment); }, [fetchSummary, segment]);

  const handleSelect = (intent: string) => {
    if (selected === intent) {
      setSelected(null);
      setDetail(null);
    } else {
      setSelected(intent);
      fetchDetail(intent, segment);
    }
  };

  const segmentLabel = SEGMENTS.find((s) => s.value === segment)?.label ?? "Segment";

  const top3              = summary.slice(0, 3);
  const top3WeeklyUsers   = top3.reduce((sum, r) => sum + r.countThisWeek, 0);
  const maxImpact         = summary.length ? Math.max(...summary.map((r) => r.impactScore), 1) : 1;

  const pieData = detail
    ? Object.entries(detail.completionBreakdown).map(([name, value]) => ({
        name,
        value,
        color: PIE_COLORS[name] ?? "#64748b",
      }))
    : [];

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-semibold text-white">Where Users Struggle</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Segment by</span>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as SegmentValue)}
            className="text-sm bg-[#1e1f2b] border border-white/[0.08] text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-zinc-500 mb-6">
        Intents ranked by impact — volume × failure rate
      </p>

      {/* Summary banner */}
      {!loading && top3.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#13141b] px-5 py-4 mb-6">
          <p className="text-sm text-zinc-300 leading-relaxed">
            Your users struggle most with:{" "}
            {top3.map((r, i) => (
              <Fragment key={r.intent}>
                <button
                  onClick={() => handleSelect(r.intent)}
                  className="font-semibold text-white hover:text-indigo-300 transition-colors underline decoration-white/20 underline-offset-2"
                >
                  {r.intent.replace(/_/g, " ")}
                </button>
                {i < top3.length - 1 ? ", " : ""}
              </Fragment>
            ))}
            .{" "}
            <span className="text-zinc-400">
              Fixing these would help{" "}
              <span className="text-white font-semibold">~{top3WeeklyUsers}</span>{" "}
              users per week.
            </span>
          </p>
        </div>
      )}

      {/* Main table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider w-10">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Intent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Convos / week</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Success rate
                  {segment !== "all" && <span className="ml-1 text-indigo-400 normal-case font-normal">/ {segmentLabel}</span>}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Avg quality
                  {segment !== "all" && <span className="ml-1 text-indigo-400 normal-case font-normal">/ {segmentLabel}</span>}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Impact</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-600">
                    Loading...
                  </td>
                </tr>
              ) : (
                summary.map((row, i) => {
                  const isActive   = selected === row.intent;
                  const barWidth   = maxImpact > 0 ? Math.round((row.impactScore / maxImpact) * 100) : 0;
                  const barColor   = impactBarColor(row.failureRate);
                  const srColor    = row.completionRate >= 60
                    ? "text-emerald-400"
                    : row.completionRate >= 40
                    ? "text-amber-400"
                    : "text-red-400";

                  const segStats = segmentSummary[row.intent] ?? null;
                  const segSrColor = segStats
                    ? segStats.completionRate >= 60 ? "text-emerald-400"
                    : segStats.completionRate >= 40 ? "text-amber-400"
                    : "text-red-400"
                    : "";

                  return (
                    <tr
                      key={row.intent}
                      onClick={() => handleSelect(row.intent)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        isActive ? "bg-indigo-500/[0.07]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3 text-zinc-600 text-xs tabular-nums">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                          )}
                          <span className="text-zinc-200 font-medium">
                            {row.intent.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 tabular-nums">{row.countThisWeek}</td>
                      <td className="px-4 py-3 tabular-nums font-medium">
                        {segment !== "all" && segStats ? (
                          <div>
                            <span className={segSrColor}>{segStats.completionRate}%</span>
                            <div className="text-xs text-zinc-600 mt-0.5 font-normal">{row.completionRate}% overall</div>
                          </div>
                        ) : (
                          <span className={srColor}>{row.completionRate}%</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {segment !== "all" && segStats ? (
                          <div>
                            <span className={scoreColor(segStats.avgScore)}>{segStats.avgScore ?? "--"}</span>
                            <div className="text-xs text-zinc-600 mt-0.5 font-normal">{row.avgScore ?? "--"} overall</div>
                          </div>
                        ) : (
                          <span className={scoreColor(row.avgScore)}>{row.avgScore ?? "--"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor} transition-all`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 tabular-nums">{row.impactScore}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white capitalize">
              {selected.replace(/_/g, " ")}
            </h2>
            <button
              onClick={() => { setSelected(null); setDetail(null); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-white/[0.04]"
            >
              Close ×
            </button>
          </div>

          {detailLoading ? (
            <div className="text-zinc-600 text-sm py-12 text-center">Loading...</div>
          ) : detail ? (
            <div className="p-5 space-y-6">
              {/* Suggested action */}
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] px-4 py-3">
                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">
                  Suggested Action
                </p>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {SUGGESTED_ACTIONS[selected] ?? DEFAULT_ACTION}
                </p>
              </div>

              {/* Common Failure Patterns */}
              {detail.failurePatterns && detail.failurePatterns.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                    Common Failure Patterns
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {detail.failurePatterns.map((p, i) => {
                      const rank = i === 0 ? "border-red-500/30 bg-red-500/[0.04]"
                                 : i === 1 ? "border-amber-500/30 bg-amber-500/[0.04]"
                                 :           "border-white/[0.06] bg-zinc-900/40";
                      const pctColor = i === 0 ? "text-red-400"
                                     : i === 1 ? "text-amber-400"
                                     :           "text-zinc-400";
                      return (
                        <div key={i} className={`rounded-lg border ${rank} p-4 flex flex-col gap-2.5`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-zinc-200 leading-snug">
                              {p.label}
                            </p>
                            <span className={`shrink-0 text-sm font-bold tabular-nums ${pctColor}`}>
                              {p.pct}%
                            </span>
                          </div>
                          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                i === 0 ? "bg-red-500" : i === 1 ? "bg-amber-500" : "bg-zinc-600"
                              }`}
                              style={{ width: `${p.pct}%` }}
                            />
                          </div>
                          <blockquote className="text-xs text-zinc-500 italic leading-relaxed border-l-2 border-zinc-700 pl-2.5 line-clamp-3">
                            "{p.example}"
                          </blockquote>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Abandonment insight */}
              {detail.typicalAbandonPoint !== null && (
                <div className="rounded-lg border border-white/[0.06] bg-zinc-900/60 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">
                      Drop-off Point
                    </p>
                    <p className="text-sm text-white">
                      Users typically give up after message{" "}
                      <span className="font-bold text-amber-400">{detail.typicalAbandonPoint + 1}</span>
                      <span className="text-zinc-500 font-normal text-xs ml-1.5">
                        (turn {detail.typicalAbandonPoint + 1} in the conversation)
                      </span>
                    </p>
                  </div>
                  {detail.abandonmentAiResponse && (
                    <div className="px-4 py-3">
                      <p className="text-xs font-medium text-zinc-500 mb-2">
                        AI response they saw before giving up:
                      </p>
                      <blockquote className="border-l-2 border-zinc-700 pl-3 text-sm text-zinc-400 leading-relaxed italic line-clamp-4">
                        {detail.abandonmentAiResponse.length > 400
                          ? detail.abandonmentAiResponse.slice(0, 400) + "…"
                          : detail.abandonmentAiResponse}
                      </blockquote>
                    </div>
                  )}
                </div>
              )}

              {/* Failure breakdown pie */}
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-4">
                  Failure Breakdown
                </h3>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-8">
                    <div className="w-44 h-44 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={42}
                            outerRadius={70}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e1f2b",
                              border: "1px solid rgba(255,255,255,0.06)",
                              borderRadius: "8px",
                              color: "#e4e4e7",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-3">
                      {pieData.map((d) => {
                        const total = pieData.reduce((s, x) => s + x.value, 0);
                        const pct   = total ? Math.round((d.value / total) * 100) : 0;
                        return (
                          <div key={d.name} className="flex items-center gap-3 text-sm">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: d.color }}
                            />
                            <span className="text-zinc-400 capitalize w-20">{d.name}</span>
                            <span className="text-zinc-200 font-medium tabular-nums w-8">{d.value}</span>
                            <span className="text-zinc-600 text-xs tabular-nums">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-zinc-600 text-sm py-4">No breakdown data.</div>
                )}
              </div>

              {/* Recommended Action */}
              {RECOMMENDED_ACTIONS[selected] && (
                <div className="flex rounded-lg overflow-hidden bg-zinc-900 border border-white/[0.06]">
                  <div className="w-1 shrink-0 bg-indigo-500" />
                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">
                      Recommended Action
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {RECOMMENDED_ACTIONS[selected]}
                    </p>
                  </div>
                </div>
              )}

              {/* Recent failed conversations */}
              <div>
                <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                  Recent Failed Conversations
                  <span className="text-zinc-700 ml-2 normal-case font-normal">
                    ({detail.failedConversations.length})
                  </span>
                </h3>
                {detail.failedConversations.length === 0 ? (
                  <div className="text-zinc-600 text-sm">No failed conversations found.</div>
                ) : (
                  <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Quality</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">First message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.failedConversations.map((conv) => {
                          const date     = new Date(conv.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day:   "numeric",
                          });
                          const userMsg  = conv.messages?.find((m) => m.role === "user");
                          const preview  = userMsg
                            ? userMsg.content.length > 90
                              ? userMsg.content.slice(0, 90) + "…"
                              : userMsg.content
                            : "--";
                          const isExpanded = expandedId === conv.id;

                          return (
                            <Fragment key={conv.id}>
                              <tr
                                onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                                className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap text-xs">{date}</td>
                                <td className={`px-4 py-2.5 font-medium text-xs tabular-nums ${scoreColor(conv.quality_score)}`}>
                                  {conv.quality_score ?? "--"}
                                </td>
                                <td className="px-4 py-2.5">
                                  {conv.completion_status ? (
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                        STATUS_BADGE[conv.completion_status] ?? "bg-zinc-500/15 text-zinc-400"
                                      }`}
                                    >
                                      {conv.completion_status}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600 text-xs">--</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-zinc-500 text-xs max-w-xs truncate">{preview}</td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={4} className="bg-[#0f1015] px-6 py-4">
                                    <div className="flex flex-col gap-3 max-w-2xl">
                                      {conv.messages?.map((msg, i) => (
                                        <div key={i} className="flex gap-3">
                                          <span
                                            className={`shrink-0 w-16 text-xs font-medium pt-0.5 ${
                                              msg.role === "user" ? "text-blue-400" : "text-purple-400"
                                            }`}
                                          >
                                            {msg.role}
                                          </span>
                                          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                                            {msg.content}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
