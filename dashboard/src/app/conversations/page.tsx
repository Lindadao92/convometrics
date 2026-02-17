"use client";

import { Fragment, useEffect, useState, useCallback } from "react";

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  conversation_id: string;
  user_id: string | null;
  intent: string | null;
  quality_score: number | null;
  completion_status: string | null;
  messages: Message[];
  created_at: string;
}

type SortField =
  | "created_at"
  | "user_id"
  | "intent"
  | "quality_score"
  | "completion_status";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-300",
  partial: "bg-amber-500/15 text-amber-300",
  abandoned: "bg-zinc-500/15 text-zinc-400",
  failed: "bg-red-500/15 text-red-300",
};

const INTENT_COLORS = [
  "bg-blue-500/15 text-blue-300",
  "bg-violet-500/15 text-violet-300",
  "bg-cyan-500/15 text-cyan-300",
  "bg-pink-500/15 text-pink-300",
  "bg-teal-500/15 text-teal-300",
  "bg-orange-500/15 text-orange-300",
  "bg-indigo-500/15 text-indigo-300",
  "bg-rose-500/15 text-rose-300",
  "bg-sky-500/15 text-sky-300",
  "bg-fuchsia-500/15 text-fuchsia-300",
];

function intentColor(intent: string): string {
  // Stable color based on string hash
  let hash = 0;
  for (let i = 0; i < intent.length; i++) {
    hash = (hash * 31 + intent.charCodeAt(i)) | 0;
  }
  return INTENT_COLORS[Math.abs(hash) % INTENT_COLORS.length];
}

function scoreColor(s: number | null): string {
  if (s === null) return "text-zinc-600";
  if (s > 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  return "text-red-400";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }) +
    ", " +
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
}

function truncateUid(uid: string | null): string {
  if (!uid) return "--";
  return uid.length > 8 ? uid.slice(0, 8) : uid;
}

function firstUserPreview(msgs: Message[]): string {
  const m = msgs.find((m) => m.role === "user");
  if (!m) return "--";
  return m.content.length > 100 ? m.content.slice(0, 100) + "..." : m.content;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [intents, setIntents] = useState<string[]>([]);
  const [filterIntent, setFilterIntent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("sort", sortBy);
      params.set("order", sortOrder);
      if (filterIntent) params.set("intent", filterIntent);
      if (filterStatus) params.set("status", filterStatus);
      if (minScore) params.set("min_score", minScore);
      if (maxScore) params.set("max_score", maxScore);

      const res = await fetch(`/api/conversations?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `API returned ${res.status}`);
        return;
      }
      const data = await res.json();
      setConversations(data.conversations);
      setTotal(data.total);
      setPageSize(data.pageSize);
      if (data.intents) setIntents(data.intents);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, filterIntent, filterStatus, minScore, maxScore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder(field === "quality_score" ? "desc" : "asc");
    }
    setPage(0);
  };

  const applyFilters = () => {
    setPage(0);
    fetchData();
  };

  const clearFilters = () => {
    setFilterIntent("");
    setFilterStatus("");
    setMinScore("");
    setMaxScore("");
    setPage(0);
  };

  const totalPages = Math.ceil(total / pageSize);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="text-zinc-700 ml-1">↕</span>;
    return (
      <span className="text-blue-400 ml-1">
        {sortOrder === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Conversations</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Browse and filter all tracked conversations
      </p>

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect
            label="Intent"
            value={filterIntent}
            onChange={(v) => {
              setFilterIntent(v);
              setPage(0);
            }}
            options={intents}
          />
          <FilterSelect
            label="Completion Status"
            value={filterStatus}
            onChange={(v) => {
              setFilterStatus(v);
              setPage(0);
            }}
            options={["completed", "partial", "abandoned", "failed"]}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500">Quality Score</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-16 bg-[#0f1117] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
              />
              <span className="text-zinc-600 text-xs">–</span>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="w-16 bg-[#0f1117] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>
          {(filterIntent || filterStatus || minScore || maxScore) && (
            <button
              onClick={clearFilters}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-md border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              Clear all
            </button>
          )}
          <div className="ml-auto text-xs text-zinc-500 self-end pb-1">
            {total.toLocaleString()} result{total !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th field="created_at" label="Date" onSort={handleSort}>
                  <SortIcon field="created_at" />
                </Th>
                <Th field="user_id" label="User" onSort={handleSort}>
                  <SortIcon field="user_id" />
                </Th>
                <Th field="intent" label="Intent" onSort={handleSort}>
                  <SortIcon field="intent" />
                </Th>
                <Th field="quality_score" label="Quality" onSort={handleSort}>
                  <SortIcon field="quality_score" />
                </Th>
                <Th
                  field="completion_status"
                  label="Status"
                  onSort={handleSort}
                >
                  <SortIcon field="completion_status" />
                </Th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Preview
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-zinc-600">
                    Loading...
                  </td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-zinc-600">
                    No conversations found
                  </td>
                </tr>
              ) : (
                conversations.map((conv) => {
                  const isExpanded = expandedId === conv.id;
                  return (
                    <Fragment key={conv.id}>
                      <tr
                        onClick={() =>
                          setExpandedId(isExpanded ? null : conv.id)
                        }
                        className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-white/[0.03]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                          {formatDate(conv.created_at)}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 font-mono text-xs">
                          {truncateUid(conv.user_id)}
                        </td>
                        <td className="px-4 py-3">
                          {conv.intent ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${intentColor(conv.intent)}`}
                            >
                              {conv.intent}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">--</span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 font-semibold tabular-nums ${scoreColor(conv.quality_score)}`}
                        >
                          {conv.quality_score ?? "--"}
                        </td>
                        <td className="px-4 py-3">
                          {conv.completion_status ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[conv.completion_status] || "bg-zinc-500/15 text-zinc-400"}`}
                            >
                              {conv.completion_status}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate">
                          {firstUserPreview(conv.messages)}
                        </td>
                      </tr>

                      {/* Expanded chat thread */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-[#0c0d12]">
                            <div className="px-6 py-5">
                              <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
                                <span className="font-mono">
                                  {conv.conversation_id}
                                </span>
                                <span>
                                  {conv.messages.length} message
                                  {conv.messages.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="flex flex-col gap-3 max-w-2xl">
                                {conv.messages.map((msg, i) => (
                                  <div
                                    key={i}
                                    className={`flex ${
                                      msg.role === "user"
                                        ? "justify-end"
                                        : "justify-start"
                                    }`}
                                  >
                                    <div
                                      className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                                        msg.role === "user"
                                          ? "bg-blue-600/20 text-blue-100 rounded-br-sm"
                                          : "bg-white/[0.05] text-zinc-300 rounded-bl-sm"
                                      }`}
                                    >
                                      <div
                                        className={`text-xs font-medium mb-1 ${
                                          msg.role === "user"
                                            ? "text-blue-400"
                                            : "text-zinc-500"
                                        }`}
                                      >
                                        {msg.role}
                                      </div>
                                      <p className="whitespace-pre-wrap break-words">
                                        {msg.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-xs rounded-md border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-xs rounded-md border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Th({
  field,
  label,
  onSort,
  children,
}: {
  field: SortField;
  label: string;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 select-none transition-colors"
    >
      {label}
      {children}
    </th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-zinc-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#0f1117] border border-white/[0.06] rounded-md px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500/50 min-w-[160px]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
