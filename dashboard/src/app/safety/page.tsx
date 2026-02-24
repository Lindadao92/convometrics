"use client";

import { useEffect, useState } from "react";
import { useDemoMode } from "@/lib/demo-mode-context";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SafetySummary {
  totalConversations: number;
  flaggedCount: number; flaggedPct: number;
  borderlineCount: number; borderlinePct: number;
  cleanCount: number; cleanPct: number;
  safetyScore: number;
  incidentsThisWeek: number; incidentsLastWeek: number;
}

interface TrendPoint { date: string; incidents: number; }
interface DistBucket { label: string; count: number; }

interface IncidentType {
  type: string; label: string; description: string;
  count: number; trend: "up" | "down" | "stable";
}

interface FlaggedConversation {
  id: string; userId: string; intent: string | null;
  safetyScore: number; qualityScore: number;
  incidentType: string; incidentLabel: string;
  reviewStatus: "needs_review" | "reviewed_confirmed" | "reviewed_false_positive";
  timestamp: string; severity: "high" | "medium" | "low";
}

interface SafetyApiData {
  summary: SafetySummary;
  incidentTrend: TrendPoint[];
  safetyDistribution: DistBucket[];
  incidentTypes: IncidentType[];
  flaggedQueue: FlaggedConversation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s.replace(/_/g, " "); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

// ─── Review Status Badge ──────────────────────────────────────────────────────

function ReviewBadge({ status }: { status: FlaggedConversation["reviewStatus"] }) {
  if (status === "needs_review") return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20 whitespace-nowrap">
      Needs Review
    </span>
  );
  if (status === "reviewed_confirmed") return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/15 whitespace-nowrap">
      Confirmed
    </span>
  );
  return (
    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-500/10 text-zinc-400 border border-white/[0.06] whitespace-nowrap">
      False Positive
    </span>
  );
}

function SeverityBadge({ severity }: { severity: FlaggedConversation["severity"] }) {
  if (severity === "high") return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400">● High</span>
  );
  if (severity === "medium") return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">● Med</span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-zinc-500">● Low</span>
  );
}

// ─── Compliance Report Modal ───────────────────────────────────────────────────

function ComplianceModal({
  onClose, summary, flaggedQueue, incidentTypes,
}: {
  onClose: () => void;
  summary: SafetySummary;
  flaggedQueue: FlaggedConversation[];
  incidentTypes: IncidentType[];
}) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [includeSafety, setIncludeSafety] = useState(true);
  const [includeQuality, setIncludeQuality] = useState(true);
  const [includeLog, setIncludeLog] = useState(true);
  const [includeResolution, setIncludeResolution] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [reportText, setReportText] = useState("");

  function generateReport() {
    const needsReview = flaggedQueue.filter((c) => c.reviewStatus === "needs_review").length;
    const confirmed = flaggedQueue.filter((c) => c.reviewStatus === "reviewed_confirmed").length;
    const falsePositive = flaggedQueue.filter((c) => c.reviewStatus === "reviewed_false_positive").length;
    const resolutionRate = flaggedQueue.length > 0
      ? Math.round(((confirmed + falsePositive) / flaggedQueue.length) * 100)
      : 100;

    const lines: string[] = [
      "═══════════════════════════════════════════════════════════════",
      "            AI SAFETY & COMPLIANCE REPORT",
      `            Period: ${dateFrom} to ${dateTo}`,
      "            Framework: EU AI Act Article 9 / ISO 42001",
      "═══════════════════════════════════════════════════════════════",
      "",
    ];

    if (includeSafety) {
      lines.push(
        "── SAFETY METRICS ──────────────────────────────────────────────",
        `  Overall Safety Score:     ${summary.safetyScore}%`,
        `  Clean Conversations:      ${summary.cleanPct.toFixed(1)}% (${summary.cleanCount.toLocaleString()})`,
        `  Borderline:               ${summary.borderlinePct.toFixed(1)}% (${summary.borderlineCount.toLocaleString()})`,
        `  Flagged:                  ${summary.flaggedPct.toFixed(1)}% (${summary.flaggedCount.toLocaleString()})`,
        `  Incidents This Week:      ${summary.incidentsThisWeek}`,
        `  Incidents Last Week:      ${summary.incidentsLastWeek}`,
        "",
      );
    }

    if (includeQuality) {
      lines.push(
        "── QUALITY CONTEXT ─────────────────────────────────────────────",
        `  Total Conversations:      ${summary.totalConversations.toLocaleString()}`,
        "  Quality dimensions scored: Helpfulness, Relevance, Accuracy,",
        "    Coherence, Satisfaction, Naturalness, Safety",
        "",
      );
    }

    if (includeLog) {
      lines.push(
        "── INCIDENT LOG ────────────────────────────────────────────────",
      );
      for (const it of incidentTypes) {
        if (it.count > 0) {
          lines.push(`  ${it.label}: ${it.count} incident${it.count !== 1 ? "s" : ""} (${it.description})`);
        }
      }
      lines.push("");
    }

    if (includeResolution) {
      lines.push(
        "── RESOLUTION RATES ────────────────────────────────────────────",
        `  Needs Review:             ${needsReview}`,
        `  Reviewed — Confirmed:     ${confirmed}`,
        `  Reviewed — False Positive: ${falsePositive}`,
        `  Overall Resolution Rate:  ${resolutionRate}%`,
        "",
      );
    }

    lines.push(
      "═══════════════════════════════════════════════════════════════",
      "  Generated by Convometrics · AI Conversation Intelligence",
      `  Report generated: ${new Date().toISOString()}`,
      "═══════════════════════════════════════════════════════════════",
    );

    setReportText(lines.join("\n"));
    setGenerated(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/[0.1] bg-[#13141b] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-sm font-semibold text-white">Compliance Report Generator</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {!generated ? (
            <>
              {/* Date range */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400">Report Period</p>
                <div className="flex items-center gap-3">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20" />
                  <span className="text-zinc-600 text-sm">to</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20" />
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-400">Include Sections</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Safety Metrics", value: includeSafety, set: setIncludeSafety },
                    { label: "Quality Context", value: includeQuality, set: setIncludeQuality },
                    { label: "Incident Log", value: includeLog, set: setIncludeLog },
                    { label: "Resolution Rates", value: includeResolution, set: setIncludeResolution },
                  ].map(({ label, value, set }) => (
                    <label key={label} className="flex items-center gap-2.5 p-3 rounded-lg border border-white/[0.07] bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors">
                      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)}
                        className="w-3.5 h-3.5 accent-emerald-500" />
                      <span className="text-xs text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-zinc-600">
                Formatted for EU AI Act Article 9 (risk management) and ISO 42001 compliance documentation requirements.
              </p>

              <button onClick={generateReport}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition-colors">
                Generate Report
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-400">Report generated</p>
                <button onClick={() => setGenerated(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                  ← Back to options
                </button>
              </div>
              <pre className="bg-[#0a0b10] rounded-xl p-4 text-[10px] leading-5 text-zinc-400 font-mono overflow-auto max-h-96 border border-white/[0.06] whitespace-pre-wrap">
                {reportText}
              </pre>
              <button
                onClick={() => { const a = document.createElement("a"); a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(reportText); a.download = "safety-compliance-report.txt"; a.click(); }}
                className="w-full py-2.5 rounded-xl border border-emerald-500/30 text-sm font-medium text-emerald-400 hover:bg-emerald-500/[0.07] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download as .txt
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const { segment } = useDemoMode();
  const [safetyData, setSafetyData] = useState<SafetyApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "needs_review" | "reviewed_confirmed" | "reviewed_false_positive">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");

  useEffect(() => {
    setLoading(true);
    const seg = segment ?? "ai_assistant";
    fetch(`/api/safety?segment=${seg}`)
      .then((r) => r.ok ? r.json() : r.json().then((b: { error: string }) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then((d: SafetyApiData) => setSafetyData(d))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [segment]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <div className="text-zinc-600 text-sm">Loading safety data…</div>
    </div>
  );

  if (error || !safetyData) return (
    <div className="p-8">
      <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-4">
        {error ?? "Failed to load safety data"}
      </div>
    </div>
  );

  const { summary, incidentTrend, safetyDistribution, incidentTypes, flaggedQueue } = safetyData;

  const trendDiff = summary.incidentsLastWeek - summary.incidentsThisWeek;
  const trendText = trendDiff > 0 ? `↓${trendDiff} from last week` : trendDiff < 0 ? `↑${Math.abs(trendDiff)} from last week` : "same as last week";
  const trendColor = trendDiff > 0 ? "text-emerald-400" : trendDiff < 0 ? "text-red-400" : "text-zinc-500";

  const filteredQueue = flaggedQueue.filter((c) => {
    if (reviewFilter !== "all" && c.reviewStatus !== reviewFilter) return false;
    if (severityFilter !== "all" && c.severity !== severityFilter) return false;
    return true;
  });

  const needsReviewCount = flaggedQueue.filter((c) => c.reviewStatus === "needs_review").length;

  return (
    <>
      <div className="p-8 max-w-7xl space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white flex items-center gap-2.5">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Safety & Compliance
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Content safety monitoring · EU AI Act Article 9 · ISO 42001
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Generate Compliance Report
          </button>
        </div>

        {/* ── Summary Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-emerald-500/15 bg-[#13141b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Safety Score</p>
            <p className="text-3xl font-bold text-emerald-300 font-mono">{summary.safetyScore}%</p>
            <p className="text-xs text-zinc-500 mt-1">conversations clean</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Flagged</p>
            <p className="text-3xl font-bold text-red-400 font-mono">{summary.flaggedCount}</p>
            <p className="text-xs text-zinc-500 mt-1">{summary.flaggedPct.toFixed(2)}% of total</p>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">Borderline</p>
            <p className="text-3xl font-bold text-amber-400 font-mono">{summary.borderlineCount}</p>
            <p className="text-xs text-zinc-500 mt-1">{summary.borderlinePct.toFixed(1)}% of total</p>
          </div>
          <div className={`rounded-xl border bg-[#13141b] p-4 ${needsReviewCount > 0 ? "border-amber-500/20" : "border-white/[0.07]"}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
              {needsReviewCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />}
              Needs Review
            </p>
            <p className="text-3xl font-bold text-amber-300 font-mono">{needsReviewCount}</p>
            <p className={`text-xs mt-1 ${trendColor}`}>{trendText}</p>
          </div>
        </div>

        {/* ── Trend + Distribution ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Incident trend chart */}
          <div className="xl:col-span-3 rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              Incident Trend — Last 30 Days
            </p>
            <p className="text-xs text-zinc-600 mb-4">Daily flagged conversation count</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={incidentTrend} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 9 }}
                  tickFormatter={(v: string) => v.slice(5)} interval={5} />
                <YAxis tick={{ fill: "#52525b", fontSize: 9 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="incidents" stroke="#ef4444" fill="url(#incidentGrad)"
                  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Safety score distribution histogram */}
          <div className="xl:col-span-2 rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
              Safety Score Distribution
            </p>
            <p className="text-xs text-zinc-600 mb-4">Conversations by safety score bucket</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={safetyDistribution} margin={{ top: 5, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 9 }} />
                <YAxis tick={{ fill: "#52525b", fontSize: 9 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {safetyDistribution.map((entry) => (
                    <Cell
                      key={entry.label}
                      fill={
                        entry.label === "0–20" ? "#ef4444" :
                        entry.label === "20–40" ? "#f97316" :
                        entry.label === "40–60" ? "#eab308" :
                        entry.label === "60–80" ? "#84cc16" :
                        "#22c55e"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Incident Types ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Incident Types Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {incidentTypes.map((it) => (
              <div key={it.type} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-sm font-medium text-zinc-200">{it.label}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold ${it.trend === "up" ? "text-red-400" : it.trend === "down" ? "text-emerald-400" : "text-zinc-500"}`}>
                        {it.trend === "up" ? "↑" : it.trend === "down" ? "↓" : "→"}
                      </span>
                      <span className="text-sm font-bold text-zinc-200 font-mono">{it.count}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600">{it.description}</p>
                </div>
                {it.count > 0 && (
                  <button
                    onClick={() => setReviewFilter("needs_review")}
                    className="shrink-0 text-[10px] px-2 py-1 rounded-lg border border-white/[0.07] text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Flagged Conversations Queue ───────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">
              Flagged Conversations Queue
              {needsReviewCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                  {needsReviewCount}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/20"
              >
                <option value="all">All Severity</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none focus:border-white/20"
              >
                <option value="all">All Statuses</option>
                <option value="needs_review">Needs Review</option>
                <option value="reviewed_confirmed">Confirmed</option>
                <option value="reviewed_false_positive">False Positive</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
            {filteredQueue.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-sm">
                No flagged conversations match the current filters
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Severity</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Safety</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Incident Type</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Quality</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Review Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.map((conv) => (
                    <tr key={conv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3"><SeverityBadge severity={conv.severity} /></td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-red-400">{conv.safetyScore}</span>
                        <span className="text-zinc-700 text-xs">/100</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-300">{conv.incidentLabel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-400 capitalize">{conv.intent ? cap(conv.intent) : "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-xs ${conv.qualityScore >= 70 ? "text-emerald-400" : conv.qualityScore >= 45 ? "text-amber-400" : "text-red-400"}`}>
                          {conv.qualityScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">{fmtDate(conv.timestamp)}</td>
                      <td className="px-4 py-3"><ReviewBadge status={conv.reviewStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-[10px] text-zinc-700 mt-2 px-1">
            Sorted by severity · Safety score &lt; 40 = flagged · Scores are deterministic per conversation
          </p>
        </div>

        {/* ── Compliance footer ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-zinc-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Safety scores are computed independently from quality dimensions. A separate hash-based function assigns content safety scores
            to each conversation. Incident types and review statuses are deterministically assigned for demo purposes.
            For production use, integrate your moderation pipeline outputs.
          </p>
        </div>

      </div>

      {showModal && safetyData && (
        <ComplianceModal
          onClose={() => setShowModal(false)}
          summary={summary}
          flaggedQueue={flaggedQueue}
          incidentTypes={incidentTypes}
        />
      )}
    </>
  );
}
