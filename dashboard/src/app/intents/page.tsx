"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface IntentSummary {
  intent: string;
  count: number;
  avgScore: number | null;
  completionRate: number;
  trend: "up" | "down" | "flat";
  statuses: Record<string, number>;
}

interface TrendPoint {
  date: string;
  avg_score: number;
}

interface Message {
  role: string;
  content: string;
}

interface DetailConversation {
  id: string;
  conversation_id: string;
  user_id: string | null;
  quality_score: number | null;
  completion_status: string | null;
  created_at: string;
  messages: Message[];
}

interface IntentDetail {
  intent: string;
  qualityTrend: TrendPoint[];
  completionBreakdown: Record<string, number>;
  conversations: DetailConversation[];
}

const PIE_COLORS: Record<string, string> = {
  completed: "#6366f1",
  partial: "#a78bfa",
  abandoned: "#475569",
  failed: "#ef4444",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-indigo-500/15 text-indigo-300",
  partial: "bg-purple-500/15 text-purple-300",
  abandoned: "bg-zinc-500/15 text-zinc-400",
  failed: "bg-red-500/15 text-red-300",
};

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "text-zinc-600";
  if (s >= 80) return "text-emerald-400";
  if (s >= 60) return "text-amber-400";
  return "text-red-400";
};

const TREND_ICON: Record<string, { symbol: string; color: string }> = {
  up: { symbol: "↑", color: "text-emerald-400" },
  down: { symbol: "↓", color: "text-red-400" },
  flat: { symbol: "→", color: "text-zinc-500" },
};

type SortField = "intent" | "count" | "avgScore" | "completionRate" | "trend";

export default function IntentsPage() {
  const [summary, setSummary] = useState<IntentSummary[]>([]);
  const [detail, setDetail] = useState<IntentDetail | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intents");
      const data = await res.json();
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (intent: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/intents?intent=${encodeURIComponent(intent)}`);
      const data = await res.json();
      setDetail(data.detail);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSelect = (intent: string) => {
    if (selected === intent) {
      setSelected(null);
      setDetail(null);
    } else {
      setSelected(intent);
      setExpandedId(null);
      fetchDetail(intent);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "intent" ? "asc" : "desc");
    }
  };

  const sorted = [...summary].sort((a, b) => {
    const dir = sortOrder === "asc" ? 1 : -1;
    switch (sortBy) {
      case "intent":
        return dir * a.intent.localeCompare(b.intent);
      case "count":
        return dir * (a.count - b.count);
      case "avgScore":
        return dir * ((a.avgScore ?? 0) - (b.avgScore ?? 0));
      case "completionRate":
        return dir * (a.completionRate - b.completionRate);
      case "trend": {
        const rank = { up: 2, flat: 1, down: 0 };
        return dir * (rank[a.trend] - rank[b.trend]);
      }
      default:
        return 0;
    }
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="text-zinc-700 ml-1">↕</span>;
    return (
      <span className="text-blue-400 ml-1">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const pieData = detail
    ? Object.entries(detail.completionBreakdown).map(([name, value]) => ({
        name,
        value,
        color: PIE_COLORS[name] || "#64748b",
      }))
    : [];

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-semibold text-white mb-1">
        Intent Analytics
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        Analyze performance by conversation intent
      </p>

      {/* Summary table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {(
                  [
                    ["intent", "Intent"],
                    ["count", "Count"],
                    ["avgScore", "Avg Quality"],
                    ["completionRate", "Completion Rate"],
                    ["trend", "Trend"],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 select-none transition-colors"
                  >
                    {label}
                    <SortIcon field={field} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-600">
                    Loading...
                  </td>
                </tr>
              ) : (
                sorted.map((row) => {
                  const t = TREND_ICON[row.trend];
                  const isActive = selected === row.intent;
                  return (
                    <tr
                      key={row.intent}
                      onClick={() => handleSelect(row.intent)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-blue-500/[0.06]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3 text-zinc-200 font-medium">
                        {isActive && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                        )}
                        {row.intent}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{row.count}</td>
                      <td
                        className={`px-4 py-3 font-medium ${SCORE_COLOR(row.avgScore)}`}
                      >
                        {row.avgScore ?? "--"}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${row.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs">{row.completionRate}%</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 font-medium ${t.color}`}>
                        {t.symbol}
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
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white">{selected}</h2>
            <button
              onClick={() => {
                setSelected(null);
                setDetail(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Close
            </button>
          </div>

          {detailLoading ? (
            <div className="text-zinc-600 text-sm py-8 text-center">
              Loading detail...
            </div>
          ) : detail ? (
            <>
              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
                {/* Quality over time */}
                <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">
                    Quality Over Time
                  </h3>
                  {detail.qualityTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart
                        data={detail.qualityTrend}
                        margin={{ left: 0, right: 10, top: 5, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.04)"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#71717a", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fill: "#71717a", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e1f2b",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: "8px",
                            color: "#e4e4e7",
                            fontSize: "12px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg_score"
                          stroke="#818cf8"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#818cf8" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
                      No scored data
                    </div>
                  )}
                </div>

                {/* Completion breakdown */}
                <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
                  <h3 className="text-sm font-medium text-zinc-400 mb-4">
                    Completion Breakdown
                  </h3>
                  {pieData.length > 0 ? (
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={80}
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
                      <div className="flex flex-col gap-2 shrink-0">
                        {pieData.map((d) => (
                          <div
                            key={d.name}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: d.color }}
                            />
                            <span className="text-zinc-400 capitalize">
                              {d.name}
                            </span>
                            <span className="text-zinc-300 font-medium ml-auto pl-3">
                              {d.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
                      No data
                    </div>
                  )}
                </div>
              </div>

              {/* Conversations for this intent */}
              <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <h3 className="text-sm font-medium text-zinc-400">
                    Recent Conversations
                    <span className="text-zinc-600 ml-2">
                      ({detail.conversations.length})
                    </span>
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Quality
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.conversations.map((conv) => {
                      const date = new Date(conv.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      );
                      const userMsg = conv.messages.find(
                        (m) => m.role === "user"
                      );
                      const preview = userMsg
                        ? userMsg.content.length > 80
                          ? userMsg.content.slice(0, 80) + "..."
                          : userMsg.content
                        : "--";
                      const isExpanded = expandedId === conv.id;

                      return (
                        <Fragment key={conv.id}>
                          <tr
                            onClick={() =>
                              setExpandedId(isExpanded ? null : conv.id)
                            }
                            className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap text-xs">
                              {date}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-300 font-mono text-xs">
                              {conv.user_id || "--"}
                            </td>
                            <td
                              className={`px-4 py-2.5 font-medium text-xs ${SCORE_COLOR(conv.quality_score)}`}
                            >
                              {conv.quality_score ?? "--"}
                            </td>
                            <td className="px-4 py-2.5">
                              {conv.completion_status ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[conv.completion_status] || "bg-zinc-500/15 text-zinc-400"}`}
                                >
                                  {conv.completion_status}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs">
                                  --
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-zinc-500 text-xs max-w-xs truncate">
                              {preview}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-[#0f1015]">
                                <div className="px-6 py-4 max-w-3xl">
                                  <div className="flex flex-col gap-3">
                                    {conv.messages.map((msg, i) => (
                                      <div key={i} className="flex gap-3">
                                        <span
                                          className={`shrink-0 w-16 text-xs font-medium pt-0.5 ${
                                            msg.role === "user"
                                              ? "text-blue-400"
                                              : "text-purple-400"
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
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Need Fragment for expandable rows
import { Fragment } from "react";
