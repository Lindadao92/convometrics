"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useProductProfile } from "@/lib/product-profile-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
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
  created_at: string; turns: number | null; firstUserMessage: string;
}
type SortField = "created_at" | "quality_score" | "intent" | "completion_status";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function qualityColor(q: number) {
  if (q >= 75) return "#22c55e";
  if (q >= 60) return "#84cc16";
  if (q >= 45) return "#eab308";
  if (q >= 30) return "#f97316";
  return "#ef4444";
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string }) {
  const color = PLATFORM_COLORS[platform] ?? "#6b7280";
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ color, backgroundColor: color + "20" }}>
      {PLATFORM_LABELS[platform] ?? platform}
    </span>
  );
}
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-600 text-xs">—</span>;
  const color = STATUS_COLORS[status] ?? "#a1a1aa";
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium capitalize"
      style={{ color, backgroundColor: color + "20" }}>
      {cap(status)}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-4">
      <Bone className="h-7 w-48" />
      <Bone className="h-12 rounded-xl" />
      {Array.from({ length: 8 }).map((_, i) => <Bone key={i} className="h-11 rounded-xl" />)}
    </div>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

function SortTh({ field, label, sortBy, order, onSort }: {
  field: SortField; label: string; sortBy: SortField; order: string; onSort: (f: SortField) => void;
}) {
  const active = sortBy === field;
  return (
    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors"
      onClick={() => onSort(field)}>
      {label} {active ? (order === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

// ─── Conversation Drawer ──────────────────────────────────────────────────────

function ConversationDrawer({
  conv, allConvos, currentIndex, onClose, onNavigate, flagged, onToggleFlag,
}: {
  conv: Conversation;
  allConvos: Conversation[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  flagged: Set<string>;
  onToggleFlag: (id: string) => void;
}) {
  const isFlagged = flagged.has(conv.id);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[#13141b] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-3">
            <PlatformBadge platform={conv.platform} />
            <span className="text-sm text-zinc-300 capitalize">
              {conv.intent ? cap(conv.intent) : <span className="italic text-zinc-600">Not analyzed</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Flag button */}
            <button
              onClick={() => onToggleFlag(conv.id)}
              title={isFlagged ? "Remove flag" : "Flag this conversation"}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isFlagged ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"}`}
            >
              <svg className="w-4 h-4" fill={isFlagged ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
            {/* Close button */}
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Two-pane body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {(conv.messages ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600 text-center mt-8">No messages available</p>
            ) : (
              (conv.messages ?? []).map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-xs max-w-[85%] ${
                    m.role === "user"
                      ? "bg-indigo-600/25 text-zinc-200 rounded-br-sm"
                      : "bg-white/[0.05] text-zinc-400 rounded-bl-sm"
                  }`}>
                    <p className={`text-[10px] font-semibold mb-1 ${m.role === "user" ? "text-indigo-300" : "text-zinc-500"}`}>
                      {m.role === "user" ? "User" : "AI"}
                    </p>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content.slice(0, 800)}{m.content.length > 800 ? "…" : ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar metadata */}
          <div className="w-52 shrink-0 border-l border-white/[0.06] bg-[#0f101a] px-4 py-4 overflow-y-auto space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Intent</p>
              <p className="text-xs text-zinc-300 capitalize">{conv.intent ? cap(conv.intent) : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Quality</p>
              {conv.quality_score !== null ? (
                <span className="text-sm font-mono font-bold" style={{ color: qualityColor(conv.quality_score) }}>
                  {conv.quality_score}/100
                </span>
              ) : <p className="text-xs text-zinc-600">Not scored</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Status</p>
              <StatusBadge status={conv.completion_status} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Platform</p>
              <PlatformBadge platform={conv.platform} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Turns</p>
              <p className="text-xs text-zinc-300">{conv.turns ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Date</p>
              <p className="text-xs text-zinc-300">{fmtDate(conv.created_at)}</p>
            </div>
            {conv.user_id && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">User ID</p>
                <p className="text-xs text-zinc-500 font-mono">{conv.user_id.slice(-12)}</p>
              </div>
            )}
            {isFlagged && (
              <div className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                </svg>
                Flagged
              </div>
            )}
          </div>
        </div>

        {/* Drawer footer: Prev / Next */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.07] shrink-0 bg-[#0f101a]">
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span className="text-xs text-zinc-600">{currentIndex + 1} of {allConvos.length}</span>
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex >= allConvos.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Conversations() {
  const { selectedPlatform, profile } = useProductProfile();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [intents, setIntents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Filters
  const [filterIntent, setFilterIntent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filterMaxScore, setFilterMaxScore] = useState("");
  const [filterTurnsMin, setFilterTurnsMin] = useState("");
  const [filterTurnsMax, setFilterTurnsMax] = useState("");
  const [searchText, setSearchText] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const pageSize = 25;

  // Load flagged IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("convometrics_flagged");
      if (stored) setFlagged(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  // Sync global platform filter
  useEffect(() => {
    if (selectedPlatform !== "all") {
      setFilterPlatform(selectedPlatform);
      setPage(0);
    }
  }, [selectedPlatform]);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort: sortBy, order });
    if (filterIntent)   params.set("intent",    filterIntent);
    if (filterStatus)   params.set("status",    filterStatus);
    const effectivePlatform = filterPlatform || (selectedPlatform !== "all" ? selectedPlatform : "");
    if (effectivePlatform) params.set("platform", effectivePlatform);
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
  }, [page, sortBy, order, filterIntent, filterStatus, filterPlatform, filterMinScore, filterMaxScore, selectedPlatform]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSort(field: SortField) {
    if (sortBy === field) setOrder((o) => o === "asc" ? "desc" : "asc");
    else { setSortBy(field); setOrder("desc"); }
    setPage(0);
  }

  function handleExportCSV() {
    const params = new URLSearchParams({ format: "csv", sort: sortBy, order });
    if (filterIntent)   params.set("intent",    filterIntent);
    if (filterStatus)   params.set("status",    filterStatus);
    if (filterPlatform) params.set("platform",  filterPlatform);
    if (filterMinScore) params.set("min_score", filterMinScore);
    if (filterMaxScore) params.set("max_score", filterMaxScore);
    window.open(`/api/conversations?${params}`, "_blank");
  }

  function handleToggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("convometrics_flagged", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function clearFilters() {
    setFilterIntent(""); setFilterStatus(""); setFilterPlatform("");
    setFilterMinScore(""); setFilterMaxScore(""); setFilterTurnsMin(""); setFilterTurnsMax("");
    setSearchText(""); setPage(0);
  }

  const totalPages = Math.ceil(total / pageSize);
  const expandedConv = expandedIndex !== null ? convos[expandedIndex] ?? null : null;

  // Client-side text search (over loaded page)
  const displayed = searchText
    ? convos.filter((c) =>
        c.firstUserMessage.toLowerCase().includes(searchText.toLowerCase()) ||
        (c.intent ?? "").toLowerCase().includes(searchText.toLowerCase())
      )
    : convos;

  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  if (loading && convos.length === 0) return <LoadingSkeleton />;

  return (
    <>
      <div className="p-8 max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Conversation Explorer</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              {fmt(total)} conversations · page {page + 1} of {totalPages || 1}
            </p>
          </div>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">{error}</div>
        )}

        {/* Filters bar */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Text search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search messages..." value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-300 w-44 focus:outline-none focus:border-white/20 placeholder:text-zinc-600" />
            </div>

            {/* Platform filter — only show if multi-platform */}
            {isMultiPlatform && (
              <select value={filterPlatform} onChange={(e) => { setFilterPlatform(e.target.value); setPage(0); }}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20">
                <option value="">All Platforms</option>
                {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            )}

            {/* Intent filter */}
            <select value={filterIntent} onChange={(e) => { setFilterIntent(e.target.value); setPage(0); }}
              className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20">
              <option value="">All Topics</option>
              {intents.map((i) => <option key={i} value={i}>{cap(i)}</option>)}
            </select>

            {/* Status filter */}
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
              className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20">
              <option value="">All Statuses</option>
              {["completed", "failed", "abandoned", "in_progress"].map((s) => (
                <option key={s} value={s}>{cap(s)}</option>
              ))}
            </select>

            {/* Quality range */}
            <div className="flex items-center gap-1 text-xs text-zinc-600">
              <span>Quality</span>
              <input type="number" placeholder="0" value={filterMinScore}
                onChange={(e) => setFilterMinScore(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-zinc-300 w-14 focus:outline-none focus:border-white/20" />
              <span>–</span>
              <input type="number" placeholder="100" value={filterMaxScore}
                onChange={(e) => setFilterMaxScore(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-zinc-300 w-14 focus:outline-none focus:border-white/20" />
            </div>

            {/* Clear */}
            <button onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors ml-auto">
              Clear filters
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {isMultiPlatform && <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Platform</th>}
                  <SortTh field="created_at"        label="Date"    sortBy={sortBy} order={order} onSort={handleSort} />
                  <SortTh field="intent"            label="Topic"   sortBy={sortBy} order={order} onSort={handleSort} />
                  <SortTh field="quality_score"     label="Quality" sortBy={sortBy} order={order} onSort={handleSort} />
                  <SortTh field="completion_status" label="Status"  sortBy={sortBy} order={order} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Turns</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">First message</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={isMultiPlatform ? 8 : 7} className="text-center py-12 text-zinc-600 text-sm">
                      No conversations found matching your filters
                    </td>
                  </tr>
                ) : (
                  displayed.map((conv, idx) => (
                    <Fragment key={conv.id}>
                      <tr
                        onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}
                        className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                          expandedIndex === idx ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                        }`}
                      >
                        {isMultiPlatform && <td className="px-4 py-3"><PlatformBadge platform={conv.platform} /></td>}
                        <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(conv.created_at)}</td>
                        <td className="px-4 py-3 text-zinc-300 capitalize max-w-[160px] truncate">
                          {conv.intent ? cap(conv.intent) : <span className="text-zinc-600 italic text-xs">Not analyzed</span>}
                        </td>
                        <td className="px-4 py-3">
                          {conv.quality_score !== null ? (
                            <span className="font-mono font-medium text-sm" style={{ color: qualityColor(conv.quality_score) }}>
                              {conv.quality_score}
                            </span>
                          ) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={conv.completion_status} /></td>
                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">
                          {conv.turns !== null ? conv.turns : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs truncate max-w-xs">
                          {conv.firstUserMessage || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {flagged.has(conv.id) && (
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                            </svg>
                          )}
                        </td>
                      </tr>
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
            {total > 0 ? `Showing ${fmt(page * pageSize + 1)}–${fmt(Math.min((page + 1) * pageSize, total))} of ${fmt(total)}` : "No results"}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-zinc-600 px-2">{page + 1} / {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Conversation drawer */}
      {expandedIndex !== null && expandedConv && (
        <ConversationDrawer
          conv={expandedConv}
          allConvos={convos}
          currentIndex={expandedIndex}
          onClose={() => setExpandedIndex(null)}
          onNavigate={(newIdx) => {
            if (newIdx >= 0 && newIdx < convos.length) setExpandedIndex(newIdx);
          }}
          flagged={flagged}
          onToggleFlag={handleToggleFlag}
        />
      )}
    </>
  );
}
