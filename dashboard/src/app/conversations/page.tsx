"use client";

import { Fragment, useEffect, useState, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10b981", claude: "#f97316", gemini: "#3b82f6",
  grok: "#ef4444", perplexity: "#a855f7",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};
const ALL_PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"];

const STATUS_COLORS: Record<string, string> = {
  completed: "#34d399", failed: "#f87171", abandoned: "#fbbf24", in_progress: "#60a5fa",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message { role: string; content: string; }
interface Conversation {
  id: string; conversation_id: string; user_id: string; platform: string;
  intent: string | null; quality_score: number | null;
  completion_status: string | null; messages: Message[];
  created_at: string;
}
type SortField = "created_at" | "quality_score" | "intent" | "completion_status";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s.replace(/_/g, " "); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ color, backgroundColor: color + "20" }}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-600 text-xs">—</span>;
  const color = STATUS_COLORS[status] ?? "#a1a1aa";
  return (
    <span
      className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
      style={{ color, backgroundColor: color + "20" }}
    >
      {status}
    </span>
  );
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-4">
      <Bone className="h-7 w-40" />
      <Bone className="h-12 rounded-xl" />
      {Array.from({ length: 8 }).map((_, i) => <Bone key={i} className="h-12 rounded-xl" />)}
    </div>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

function SortTh({
  field, label, sortBy, order, onSort,
}: { field: SortField; label: string; sortBy: SortField; order: string; onSort: (f: SortField) => void }) {
  const active = sortBy === field;
  return (
    <th
      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors"
      onClick={() => onSort(field)}
    >
      {label} {active ? (order === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Conversations() {
  const [convos, setConvos]       = useState<Conversation[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const [intents, setIntents]     = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterIntent,   setFilterIntent]   = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filterMaxScore, setFilterMaxScore] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [order,  setOrder]  = useState<"asc" | "desc">("desc");

  const pageSize = 25;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      sort: sortBy,
      order,
    });
    if (filterIntent)   params.set("intent",    filterIntent);
    if (filterStatus)   params.set("status",    filterStatus);
    if (filterPlatform) params.set("platform",  filterPlatform);
    if (filterMinScore) params.set("min_score", filterMinScore);
    if (filterMaxScore) params.set("max_score", filterMaxScore);

    fetch(`/api/conversations?${params}`)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then((d) => {
        setConvos(d.conversations ?? []);
        setTotal(d.total ?? 0);
        setIntents(d.intents ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [page, sortBy, order, filterIntent, filterStatus, filterPlatform, filterMinScore, filterMaxScore]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setOrder((o) => o === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("desc");
    }
    setPage(0);
  }

  function applyFilters() { setPage(0); fetchData(); }

  const totalPages = Math.ceil(total / pageSize);

  if (loading && convos.length === 0) return <LoadingSkeleton />;

  return (
    <div className="p-8 max-w-7xl space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Conversations</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {total.toLocaleString()} total · page {page + 1} of {totalPages || 1}
        </p>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Platform filter */}
        <select
          value={filterPlatform}
          onChange={(e) => { setFilterPlatform(e.target.value); setPage(0); }}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Platforms</option>
          {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>

        {/* Intent filter */}
        <select
          value={filterIntent}
          onChange={(e) => { setFilterIntent(e.target.value); setPage(0); }}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Intents</option>
          {intents.map((i) => <option key={i} value={i}>{cap(i)}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="">All Statuses</option>
          {["completed", "failed", "abandoned", "in_progress"].map((s) => (
            <option key={s} value={s}>{cap(s)}</option>
          ))}
        </select>

        {/* Quality range */}
        <div className="flex items-center gap-1.5">
          <input
            type="number" placeholder="Min score" value={filterMinScore}
            onChange={(e) => setFilterMinScore(e.target.value)}
            className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 w-24 focus:outline-none focus:border-white/20"
          />
          <span className="text-zinc-600 text-xs">—</span>
          <input
            type="number" placeholder="Max score" value={filterMaxScore}
            onChange={(e) => setFilterMaxScore(e.target.value)}
            className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 w-24 focus:outline-none focus:border-white/20"
          />
        </div>

        <button
          onClick={() => {
            setFilterIntent(""); setFilterStatus(""); setFilterPlatform("");
            setFilterMinScore(""); setFilterMaxScore(""); setPage(0);
          }}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-8 text-zinc-600 text-sm">Loading…</div>
        )}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Platform</th>
                <SortTh field="created_at"        label="Date"       sortBy={sortBy} order={order} onSort={handleSort} />
                <SortTh field="intent"            label="Intent"     sortBy={sortBy} order={order} onSort={handleSort} />
                <SortTh field="quality_score"     label="Quality"    sortBy={sortBy} order={order} onSort={handleSort} />
                <SortTh field="completion_status" label="Status"     sortBy={sortBy} order={order} onSort={handleSort} />
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Preview</th>
              </tr>
            </thead>
            <tbody>
              {convos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-600 text-sm">
                    No conversations found
                  </td>
                </tr>
              ) : (
                convos.map((conv) => (
                  <Fragment key={conv.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        expandedId === conv.id ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3"><PlatformBadge platform={conv.platform} /></td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(conv.created_at)}</td>
                      <td className="px-4 py-3 text-zinc-300 capitalize">
                        {conv.intent ? cap(conv.intent) : <span className="text-zinc-600 italic">Not analyzed</span>}
                      </td>
                      <td className="px-4 py-3">
                        {conv.quality_score !== null ? (
                          <span className={`font-mono font-medium ${conv.quality_score >= 70 ? "text-emerald-400" : conv.quality_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
                            {conv.quality_score}
                          </span>
                        ) : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={conv.completion_status} /></td>
                      <td className="px-4 py-3 text-zinc-600 text-xs truncate max-w-xs">
                        {conv.messages?.[0]?.content?.slice(0, 80) ?? "—"}
                      </td>
                    </tr>

                    {/* Expanded message thread */}
                    {expandedId === conv.id && (
                      <tr className="bg-[#0f101a]">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex items-center gap-3 mb-3 text-xs text-zinc-600">
                            <PlatformBadge platform={conv.platform} />
                            <span>{conv.messages?.length ?? 0} messages</span>
                            {conv.user_id && <span>User: {conv.user_id.slice(-12)}</span>}
                          </div>
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {(conv.messages ?? []).map((m, i) => (
                              <div
                                key={i}
                                className={`rounded-lg px-3 py-2 text-xs max-w-[80%] ${
                                  m.role === "user"
                                    ? "bg-white/[0.06] text-zinc-300 ml-auto text-right"
                                    : "bg-white/[0.03] text-zinc-400"
                                }`}
                              >
                                <span className="font-medium text-zinc-500 mr-1.5">{m.role === "user" ? "User" : "AI"}</span>
                                {m.content.slice(0, 400)}{m.content.length > 400 ? "…" : ""}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-600">
          Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-600 px-2">{page + 1} / {totalPages || 1}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
