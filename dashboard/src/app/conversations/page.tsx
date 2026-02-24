"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useProductProfile } from "@/lib/product-profile-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import {
  DIMENSIONS, DimensionKey, QualityScores, computeDimensionsFromScore, dimColor,
  SIGNALS, SATISFACTION_META, InferredSatisfaction, computeSatisfactionFromScore,
  FAILURE_TYPES, FailureType, FailureTag, computeFailuresFromScore,
} from "@/lib/mockQualityData";

const FAILURE_TYPE_MAP = Object.fromEntries(FAILURE_TYPES.map((f) => [f.key, f]));

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

const DIM_KEYS = DIMENSIONS.map((d) => d.key) as DimensionKey[];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message { role: string; content: string; }
interface Conversation {
  id: string; conversation_id: string; user_id: string; platform: string;
  intent: string | null; quality_score: number | null;
  completion_status: string | null; messages: Message[];
  created_at: string; turns: number | null; firstUserMessage: string;
  churnRisk?: boolean; ltv?: number; outcome?: string | null;
}
type ServerSortField = "created_at" | "quality_score" | "intent" | "completion_status";
type SortField = ServerSortField | DimensionKey;

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
function isDimKey(k: string): k is DimensionKey {
  return DIM_KEYS.includes(k as DimensionKey);
}

// ─── Mini quality indicators ──────────────────────────────────────────────────

function MiniDots({ dims }: { dims: QualityScores | null }) {
  if (!dims) return <span className="text-zinc-700 text-xs">—</span>;
  return (
    <div className="flex gap-0.5 items-center" title="Quality dimensions: Helpfulness, Relevance, Accuracy, Coherence, Satisfaction, Naturalness, Safety">
      {DIM_KEYS.map((k) => {
        const v = dims[k];
        return (
          <span
            key={k}
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dimColor(v) }}
            title={`${DIMENSIONS.find((d) => d.key === k)?.label ?? k}: ${v}`}
          />
        );
      })}
    </div>
  );
}

// ─── Full quality scorecard ───────────────────────────────────────────────────

function QualityScorecard({ dims }: { dims: QualityScores }) {
  return (
    <div className="space-y-2.5">
      {DIMENSIONS.map((d) => {
        const score = dims[d.key as DimensionKey];
        const color = dimColor(score);
        return (
          <div key={d.key}>
            <div className="flex justify-between items-baseline mb-0.5">
              <span className="text-[10px] text-zinc-500">{d.label}</span>
              <span className="text-[10px] font-mono font-medium" style={{ color }}>{score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
      <div className="pt-2.5 border-t border-white/[0.07] flex items-baseline justify-between">
        <span className="text-xs text-zinc-400 font-semibold">Overall</span>
        <span className="text-sm font-bold font-mono" style={{ color: qualityColor(dims.overall) }}>
          {dims.overall}<span className="text-zinc-600 text-xs">/100</span>
        </span>
      </div>
      <p className="text-[9px] text-zinc-700 leading-snug">
        Weights: Helpfulness 25% · Relevance 20% · Accuracy 20% · Coherence 15% · Satisfaction 10% · Naturalness 5% · Safety 5%
      </p>
    </div>
  );
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
function SatisfactionBadge({ sat }: { sat: InferredSatisfaction | null }) {
  if (!sat) return <span className="text-zinc-600 text-xs">—</span>;
  const meta = SATISFACTION_META[sat];
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ color: meta.color, backgroundColor: meta.color + "20" }}>
      {meta.icon} {meta.label}
    </span>
  );
}
const SIG_META = Object.fromEntries(SIGNALS.map((s) => [s.key, s]));
function SignalChips({ signals }: { signals: string[] }) {
  if (!signals.length) return <p className="text-xs text-zinc-600">No signals detected</p>;
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((key) => {
        const s = SIG_META[key];
        if (!s) return null;
        return (
          <span key={key}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]"
            style={{ color: s.color, backgroundColor: s.color + "18" }}
            title={s.sentiment}>
            {s.emoji} {s.label}
          </span>
        );
      })}
    </div>
  );
}

function FailureTags({ tags }: { tags: FailureTag[] }) {
  if (!tags.length) return <span className="text-zinc-700 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-0.5">
      {tags.map((tag, i) => {
        const ft = FAILURE_TYPE_MAP[tag.type];
        return (
          <span key={i}
            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium cursor-default"
            style={{ color: ft.color, backgroundColor: ft.color + "15" }}
            title={`Turn ${tag.turn}: ${tag.detail}`}>
            {ft.icon} {ft.label}
          </span>
        );
      })}
    </div>
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
    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none hover:text-zinc-300 transition-colors whitespace-nowrap"
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
  const dims = conv.quality_score !== null
    ? computeDimensionsFromScore(conv.quality_score, conv.id)
    : null;

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
            <button
              onClick={() => onToggleFlag(conv.id)}
              title={isFlagged ? "Remove flag" : "Flag this conversation"}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isFlagged ? "text-amber-400 bg-amber-400/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"}`}
            >
              <svg className="w-4 h-4" fill={isFlagged ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
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
          <div className="w-56 shrink-0 border-l border-white/[0.06] bg-[#0f101a] px-4 py-4 overflow-y-auto space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Intent</p>
              <p className="text-xs text-zinc-300 capitalize">{conv.intent ? cap(conv.intent) : "—"}</p>
            </div>

            {/* Detected Failures */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">Detected Failures</p>
              {conv.quality_score !== null ? (() => {
                const tags = computeFailuresFromScore(conv.quality_score, conv.id);
                return tags.length > 0 ? (
                  <div className="space-y-2">
                    {tags.map((tag, i) => {
                      const ft = FAILURE_TYPE_MAP[tag.type];
                      return (
                        <div key={i} className="rounded-lg p-2.5"
                          style={{ backgroundColor: ft.color + "10", border: `1px solid ${ft.color}25` }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs">{ft.icon}</span>
                            <span className="text-[10px] font-semibold" style={{ color: ft.color }}>{ft.label}</span>
                            <span className="ml-auto text-[9px] text-zinc-600 font-mono">Turn {tag.turn}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-snug">{tag.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">No failures detected</p>
                );
              })() : (
                <p className="text-xs text-zinc-600">Not scored</p>
              )}
            </div>

            {/* Satisfaction */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">Satisfaction</p>
              <SatisfactionBadge sat={conv.quality_score !== null ? computeSatisfactionFromScore(conv.quality_score, conv.id).inferred : null} />
              {conv.quality_score !== null && (
                <div className="mt-2">
                  <p className="text-[10px] text-zinc-700 mb-1.5">Signals</p>
                  <SignalChips signals={computeSatisfactionFromScore(conv.quality_score, conv.id).signals} />
                </div>
              )}
            </div>

            {/* Quality scorecard */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">Quality Scorecard</p>
              {dims ? (
                <QualityScorecard dims={dims} />
              ) : (
                <p className="text-xs text-zinc-600">Not scored</p>
              )}
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
  const { segment } = useDemoMode();

  const [convos, setConvos] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [intents, setIntents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  // Server-side filters
  const [filterIntent,   setFilterIntent]   = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterMinScore, setFilterMinScore] = useState("");
  const [filterMaxScore, setFilterMaxScore] = useState("");
  const [searchText,     setSearchText]     = useState("");

  // Client-side dimension filters
  const [dimFilterKey, setDimFilterKey] = useState<DimensionKey | "">("");
  const [dimFilterMax, setDimFilterMax] = useState("");
  const [dimFilterMin, setDimFilterMin] = useState("");

  // Client-side satisfaction filter
  const [filterSatisfaction, setFilterSatisfaction] = useState<InferredSatisfaction | ("")>("");

  // Client-side failure type filter
  const [filterFailureType, setFilterFailureType] = useState<FailureType | "">("");

  // Sort (server-side for standard fields, client-side for dimensions)
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [order,  setOrder]  = useState<"asc" | "desc">("desc");

  const pageSize = 25;

  useEffect(() => {
    try {
      const stored = localStorage.getItem("convometrics_flagged");
      if (stored) setFlagged(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedPlatform !== "all") {
      setFilterPlatform(selectedPlatform);
      setPage(0);
    }
  }, [selectedPlatform]);

  const serverSortBy: ServerSortField = isDimKey(sortBy) ? "quality_score" : sortBy as ServerSortField;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort: serverSortBy, order });
    if (segment) {
      params.set("segment", segment);
    } else {
      if (filterIntent)   params.set("intent",    filterIntent);
      if (filterStatus)   params.set("status",    filterStatus);
      const effectivePlatform = filterPlatform || (selectedPlatform !== "all" ? selectedPlatform : "");
      if (effectivePlatform) params.set("platform", effectivePlatform);
      if (filterMinScore) params.set("min_score", filterMinScore);
      if (filterMaxScore) params.set("max_score", filterMaxScore);
    }

    fetch(`/api/conversations?${params}`)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then((d) => {
        setConvos(d.conversations ?? []);
        setTotal(d.total ?? 0);
        setIntents(d.intents ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [page, serverSortBy, order, filterIntent, filterStatus, filterPlatform, filterMinScore, filterMaxScore, selectedPlatform, segment]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSort(field: SortField) {
    if (sortBy === field) setOrder((o) => o === "asc" ? "desc" : "asc");
    else { setSortBy(field); setOrder("desc"); }
    setPage(0);
  }

  function handleExportCSV() {
    const params = new URLSearchParams({ format: "csv", sort: serverSortBy, order });
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
    setFilterMinScore(""); setFilterMaxScore("");
    setSearchText(""); setDimFilterKey(""); setDimFilterMax(""); setDimFilterMin("");
    setFilterSatisfaction("");
    setFilterFailureType("");
    setPage(0);
  }

  // Client-side filtering and sorting
  let displayed = convos;

  // Text search
  if (searchText) {
    const q = searchText.toLowerCase();
    displayed = displayed.filter((c) =>
      c.firstUserMessage.toLowerCase().includes(q) ||
      (c.intent ?? "").toLowerCase().includes(q),
    );
  }

  // Dimension filter
  if (dimFilterKey && (dimFilterMax || dimFilterMin)) {
    const maxVal = dimFilterMax ? parseInt(dimFilterMax, 10) : Infinity;
    const minVal = dimFilterMin ? parseInt(dimFilterMin, 10) : -Infinity;
    displayed = displayed.filter((c) => {
      if (c.quality_score === null) return false;
      const dims = computeDimensionsFromScore(c.quality_score, c.id);
      const v = dims[dimFilterKey];
      return v >= minVal && v <= maxVal;
    });
  }

  // Satisfaction filter
  if (filterSatisfaction) {
    displayed = displayed.filter((c) => {
      const sat = computeSatisfactionFromScore(c.quality_score ?? 50, c.id);
      return sat.inferred === filterSatisfaction;
    });
  }

  // Failure type filter
  if (filterFailureType) {
    displayed = displayed.filter((c) => {
      const tags = computeFailuresFromScore(c.quality_score ?? 50, c.id);
      return tags.some((t) => t.type === filterFailureType);
    });
  }

  // Client-side sort for dimension keys
  if (isDimKey(sortBy)) {
    displayed = [...displayed].sort((a, b) => {
      if (a.quality_score === null) return 1;
      if (b.quality_score === null) return -1;
      const da = computeDimensionsFromScore(a.quality_score, a.id);
      const db = computeDimensionsFromScore(b.quality_score, b.id);
      const va = da[sortBy as DimensionKey];
      const vb = db[sortBy as DimensionKey];
      return order === "asc" ? va - vb : vb - va;
    });
  }

  const totalPages  = Math.ceil(total / pageSize);
  const expandedConv = expandedIndex !== null ? displayed[expandedIndex] ?? null : null;
  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  if (loading && convos.length === 0) return <LoadingSkeleton />;

  const SELECT_CLS = "bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20";

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
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4 space-y-3">
          {/* Row 1: standard filters */}
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

            {isMultiPlatform && (
              <select value={filterPlatform} onChange={(e) => { setFilterPlatform(e.target.value); setPage(0); }} className={SELECT_CLS}>
                <option value="">All Platforms</option>
                {ALL_PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
            )}

            <select value={filterIntent} onChange={(e) => { setFilterIntent(e.target.value); setPage(0); }} className={SELECT_CLS}>
              <option value="">All Topics</option>
              {intents.map((i) => <option key={i} value={i}>{cap(i)}</option>)}
            </select>

            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className={SELECT_CLS}>
              <option value="">All Statuses</option>
              {["completed", "failed", "abandoned", "in_progress"].map((s) => (
                <option key={s} value={s}>{cap(s)}</option>
              ))}
            </select>

            <select value={filterSatisfaction} onChange={(e) => setFilterSatisfaction(e.target.value as InferredSatisfaction | "")} className={SELECT_CLS}>
              <option value="">All Satisfaction</option>
              <option value="satisfied">✓ Satisfied</option>
              <option value="neutral">— Neutral</option>
              <option value="frustrated">! Frustrated</option>
              <option value="abandoned">✗ Abandoned</option>
            </select>

            <select value={filterFailureType} onChange={(e) => setFilterFailureType(e.target.value as FailureType | "")} className={SELECT_CLS}>
              <option value="">All Failure Types</option>
              {FAILURE_TYPES.map((ft) => (
                <option key={ft.key} value={ft.key}>{ft.icon} {ft.label}</option>
              ))}
            </select>

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

            <button onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors ml-auto">
              Clear filters
            </button>
          </div>

          {/* Row 2: dimension filter */}
          <div className="flex flex-wrap gap-2 items-center border-t border-white/[0.04] pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Filter by dimension:</span>
            <select
              value={dimFilterKey}
              onChange={(e) => { setDimFilterKey(e.target.value as DimensionKey | ""); }}
              className={SELECT_CLS}
            >
              <option value="">Any dimension</option>
              {DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            {dimFilterKey && (
              <>
                <div className="flex items-center gap-1 text-xs text-zinc-600">
                  <span>Score</span>
                  <input
                    type="number" placeholder="0" value={dimFilterMin}
                    onChange={(e) => setDimFilterMin(e.target.value)}
                    className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-zinc-300 w-14 focus:outline-none focus:border-white/20"
                  />
                  <span>–</span>
                  <input
                    type="number" placeholder="100" value={dimFilterMax}
                    onChange={(e) => setDimFilterMax(e.target.value)}
                    className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-zinc-300 w-14 focus:outline-none focus:border-white/20"
                  />
                </div>
                <span className="text-[10px] text-zinc-600">
                  {displayed.length} matching on this page
                </span>
              </>
            )}
            {/* Dimension sort shortcuts */}
            <div className="flex gap-1 ml-auto flex-wrap">
              <span className="text-[10px] text-zinc-600 self-center">Sort by:</span>
              {DIMENSIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => handleSort(d.key as DimensionKey)}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    sortBy === d.key
                      ? "text-white font-semibold"
                      : "text-zinc-600 hover:text-zinc-300"
                  }`}
                  style={sortBy === d.key ? { backgroundColor: d.color + "25", color: d.color } : {}}
                >
                  {d.label} {sortBy === d.key ? (order === "asc" ? "↑" : "↓") : ""}
                </button>
              ))}
            </div>
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
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                    Dimensions
                    <span className="ml-1 text-zinc-700" title="7 quality dimensions: H R A C S N F">·7</span>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                    Satisfaction
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">
                    Failures
                  </th>
                  <SortTh field="completion_status" label="Status"  sortBy={sortBy} order={order} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Risk</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Turns</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">First message</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan={isMultiPlatform ? 12 : 11} className="text-center py-12 text-zinc-600 text-sm">
                      No conversations found matching your filters
                    </td>
                  </tr>
                ) : (
                  displayed.map((conv, idx) => {
                    const dims = conv.quality_score !== null
                      ? computeDimensionsFromScore(conv.quality_score, conv.id)
                      : null;
                    return (
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
                          <td className="px-4 py-3">
                            <MiniDots dims={dims} />
                          </td>
                          <td className="px-4 py-3">
                            <SatisfactionBadge sat={conv.quality_score !== null ? computeSatisfactionFromScore(conv.quality_score, conv.id).inferred : null} />
                          </td>
                          <td className="px-4 py-3">
                            <FailureTags tags={conv.quality_score !== null ? computeFailuresFromScore(conv.quality_score, conv.id) : []} />
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={conv.completion_status} /></td>
                          <td className="px-4 py-3">
                            {conv.churnRisk
                              ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap">⚡ Churn Risk</span>
                              : <span className="text-zinc-700 text-xs">—</span>}
                          </td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Dimension legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          {DIMENSIONS.map((d) => (
            <span key={d.key} className="text-[10px] text-zinc-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
              {d.label}
            </span>
          ))}
          <span className="text-[10px] text-zinc-700 ml-2">· Green &gt;70 · Yellow 40–70 · Red &lt;40</span>
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
          allConvos={displayed}
          currentIndex={expandedIndex}
          onClose={() => setExpandedIndex(null)}
          onNavigate={(newIdx) => {
            if (newIdx >= 0 && newIdx < displayed.length) setExpandedIndex(newIdx);
          }}
          flagged={flagged}
          onToggleFlag={handleToggleFlag}
        />
      )}
    </>
  );
}
