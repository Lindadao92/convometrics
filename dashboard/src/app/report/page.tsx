"use client";

import { useEffect, useState, useRef } from "react";

interface WeekMetric {
  thisWeek: number;
  lastWeek: number;
}

interface IntentDelta {
  intent: string;
  thisWeekQuality: number | null;
  lastWeekQuality: number | null;
  thisWeekCompletion: number;
  lastWeekCompletion: number;
  qualityDelta: number | null;
  completionDelta: number;
  combinedDelta: number;
  thisWeekCount: number;
}

interface ReportData {
  weekRange: { from: string; to: string };
  metrics: {
    successRate:   WeekMetric;
    conversations: WeekMetric;
    uniqueUsers:   WeekMetric;
    avgQuality:    WeekMetric;
  };
  improving: IntentDelta[];
  declining: IntentDelta[];
  sprintPriorities: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function delta(current: number, previous: number, suffix = "") {
  const d = current - previous;
  if (d === 0) return { text: "—", positive: null };
  return {
    text: `${d > 0 ? "+" : ""}${d}${suffix}`,
    positive: d > 0,
  };
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return { text: "—", positive: null };
  const d = Math.round(((current - previous) / previous) * 100);
  return { text: `${d > 0 ? "+" : ""}${d}%`, positive: d > 0 };
}

function DeltaBadge({
  text,
  positive,
  invert = false,
}: {
  text: string;
  positive: boolean | null;
  invert?: boolean;
}) {
  if (positive === null || text === "—")
    return <span className="text-zinc-600 text-xs">{text}</span>;
  const good = invert ? !positive : positive;
  return (
    <span
      className={`text-xs font-semibold ${good ? "text-emerald-400" : "text-red-400"}`}
    >
      {text} {positive ? "↑" : "↓"}
    </span>
  );
}

function IntentRow({
  d,
  rank,
  dir,
}: {
  d: IntentDelta;
  rank: number;
  dir: "improving" | "declining";
}) {
  const qd   = d.qualityDelta;
  const cd   = d.completionDelta;
  const good = dir === "improving";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/[0.05] last:border-0">
      <span className="shrink-0 w-5 text-xs text-zinc-600 tabular-nums pt-0.5">{rank}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-200 capitalize mb-1">
          {d.intent.replace(/_/g, " ")}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-500">
          {qd !== null && (
            <span>
              Quality{" "}
              <span className={good ? "text-emerald-400" : "text-red-400"}>
                {qd > 0 ? "+" : ""}
                {qd} pts
              </span>
            </span>
          )}
          <span>
            Success rate{" "}
            <span className={good ? "text-emerald-400" : "text-red-400"}>
              {cd > 0 ? "+" : ""}
              {cd}pp
            </span>
          </span>
          <span className="text-zinc-700">
            {d.thisWeekCount} sessions
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Plain-text export ──────────────────────────────────────────────────────

function buildPlainText(data: ReportData, summary: string[]): string {
  const { weekRange, metrics, improving, declining, sprintPriorities } = data;
  const lines: string[] = [];

  lines.push("WEEKLY AI PERFORMANCE REPORT");
  lines.push(`${weekRange.from} – ${weekRange.to}`);
  lines.push("");
  lines.push("EXECUTIVE SUMMARY");
  lines.push("─".repeat(50));
  summary.forEach((s) => lines.push(s));
  lines.push("");
  lines.push("KEY METRICS");
  lines.push("─".repeat(50));
  lines.push(
    `${"Metric".padEnd(22)}${"This Week".padEnd(14)}${"Last Week".padEnd(14)}Delta`
  );

  const rows = [
    ["Success Rate",   `${metrics.successRate.thisWeek}%`,   `${metrics.successRate.lastWeek}%`,   `${delta(metrics.successRate.thisWeek, metrics.successRate.lastWeek, "pp").text}`],
    ["Conversations",  `${metrics.conversations.thisWeek}`,   `${metrics.conversations.lastWeek}`,   pctDelta(metrics.conversations.thisWeek, metrics.conversations.lastWeek).text],
    ["Unique Users",   `${metrics.uniqueUsers.thisWeek}`,     `${metrics.uniqueUsers.lastWeek}`,     pctDelta(metrics.uniqueUsers.thisWeek, metrics.uniqueUsers.lastWeek).text],
    ["Avg Quality",    `${metrics.avgQuality.thisWeek}`,      `${metrics.avgQuality.lastWeek}`,      delta(metrics.avgQuality.thisWeek, metrics.avgQuality.lastWeek).text],
  ];
  rows.forEach(([m, a, b, d]) =>
    lines.push(`${m.padEnd(22)}${a.padEnd(14)}${b.padEnd(14)}${d}`)
  );

  lines.push("");
  lines.push("TOP 3 IMPROVING INTENTS");
  lines.push("─".repeat(50));
  improving.forEach((d, i) => {
    const qp = d.qualityDelta !== null ? `, quality ${d.qualityDelta > 0 ? "+" : ""}${d.qualityDelta} pts` : "";
    lines.push(
      `${i + 1}. ${d.intent.replace(/_/g, " ")} — success rate ${d.completionDelta > 0 ? "+" : ""}${d.completionDelta}pp${qp}`
    );
  });

  lines.push("");
  lines.push("TOP 3 DECLINING INTENTS");
  lines.push("─".repeat(50));
  declining.forEach((d, i) => {
    const qp = d.qualityDelta !== null ? `, quality ${d.qualityDelta}pts` : "";
    lines.push(
      `${i + 1}. ${d.intent.replace(/_/g, " ")} — success rate ${d.completionDelta}pp${qp}`
    );
  });

  lines.push("");
  lines.push("SPRINT PRIORITIES");
  lines.push("─".repeat(50));
  sprintPriorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));

  lines.push("");
  lines.push(`Generated by Convometrics · ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);

  return lines.join("\n");
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ReportPage() {
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/report");
        const json = await res.json();
        setData(json);
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (copyTimeout.current) clearTimeout(copyTimeout.current); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-sm">Generating report…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-red-400 text-sm">Failed to load report data.</span>
      </div>
    );
  }

  const { weekRange, metrics, improving, declining, sprintPriorities } = data;

  // ── Executive summary (generated from data) ──────────────────────────────
  const srDelta = metrics.successRate.thisWeek - metrics.successRate.lastWeek;
  const srDir   = srDelta > 0 ? "up" : srDelta < 0 ? "down" : "flat";

  const topImproving = improving[0];
  const topDeclining = declining[0];

  const summary: string[] = [
    `This week, ${metrics.conversations.thisWeek} conversations were logged across ${metrics.uniqueUsers.thisWeek} unique users, with an overall success rate of ${metrics.successRate.thisWeek}% — ${srDir === "flat" ? "unchanged" : `${srDir} ${Math.abs(srDelta)}pp`} from the previous week.`,
    topImproving && topDeclining
      ? `"${topImproving.intent.replace(/_/g, " ")}" showed the strongest improvement (${topImproving.completionDelta > 0 ? "+" : ""}${topImproving.completionDelta}pp success rate), while "${topDeclining.intent.replace(/_/g, " ")}" declined the most (${topDeclining.completionDelta}pp), signaling a product area that needs immediate attention.`
      : `Average quality score this week was ${metrics.avgQuality.thisWeek}, compared to ${metrics.avgQuality.lastWeek} last week.`,
    `With ${metrics.uniqueUsers.thisWeek} active users and ${metrics.conversations.thisWeek} sessions this week, the three sprint priorities below are ranked by expected user impact.`,
  ];

  function handleCopy() {
    const text = buildPlainText(data!, summary);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      copyTimeout.current = setTimeout(() => setCopied(false), 2200);
    });
  }

  // Metric table rows
  const metricRows: {
    label: string;
    thisWeek: string;
    lastWeek: string;
    d: { text: string; positive: boolean | null };
    invert?: boolean;
  }[] = [
    {
      label:    "Success Rate",
      thisWeek: `${metrics.successRate.thisWeek}%`,
      lastWeek: `${metrics.successRate.lastWeek}%`,
      d:        delta(metrics.successRate.thisWeek, metrics.successRate.lastWeek, "pp"),
    },
    {
      label:    "Conversations",
      thisWeek: metrics.conversations.thisWeek.toLocaleString(),
      lastWeek: metrics.conversations.lastWeek.toLocaleString(),
      d:        pctDelta(metrics.conversations.thisWeek, metrics.conversations.lastWeek),
    },
    {
      label:    "Unique Users",
      thisWeek: metrics.uniqueUsers.thisWeek.toLocaleString(),
      lastWeek: metrics.uniqueUsers.lastWeek.toLocaleString(),
      d:        pctDelta(metrics.uniqueUsers.thisWeek, metrics.uniqueUsers.lastWeek),
    },
    {
      label:    "Avg Quality",
      thisWeek: `${metrics.avgQuality.thisWeek}`,
      lastWeek: `${metrics.avgQuality.lastWeek}`,
      d:        delta(metrics.avgQuality.thisWeek, metrics.avgQuality.lastWeek),
    },
  ];

  return (
    <div className="p-8 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            Convometrics
          </p>
          <h1 className="text-2xl font-bold text-white leading-tight mb-1">
            Weekly AI Performance Report
          </h1>
          <p className="text-sm text-zinc-500">
            {weekRange.from} – {weekRange.to}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
            copied
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:text-white hover:border-white/[0.14] hover:bg-white/[0.07]"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy to Clipboard
            </>
          )}
        </button>
      </div>

      <div className="space-y-8">

        {/* ── Executive Summary ── */}
        <section>
          <SectionLabel>Executive Summary</SectionLabel>
          <div className="space-y-2.5">
            {summary.map((sentence, i) => (
              <p key={i} className="text-sm text-zinc-300 leading-relaxed">
                {sentence}
              </p>
            ))}
          </div>
        </section>

        {/* ── Key Metrics ── */}
        <section>
          <SectionLabel>Key Metrics</SectionLabel>
          <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Metric
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    This Week
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Last Week
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Delta
                  </th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-5 py-3.5 text-sm text-zinc-300 font-medium">
                      {row.label}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-white font-semibold tabular-nums text-right">
                      {row.thisWeek}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-500 tabular-nums text-right">
                      {row.lastWeek}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <DeltaBadge {...row.d} invert={row.invert} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Trends ── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Improving */}
            <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <SectionLabel flush>Top 3 Improving</SectionLabel>
              </div>
              {improving.length === 0 ? (
                <p className="text-xs text-zinc-600">Not enough week-over-week data.</p>
              ) : (
                improving.map((d, i) => (
                  <IntentRow key={d.intent} d={d} rank={i + 1} dir="improving" />
                ))
              )}
            </div>

            {/* Declining */}
            <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <SectionLabel flush>Top 3 Declining</SectionLabel>
              </div>
              {declining.length === 0 ? (
                <p className="text-xs text-zinc-600">Not enough week-over-week data.</p>
              ) : (
                declining.map((d, i) => (
                  <IntentRow key={d.intent} d={d} rank={i + 1} dir="declining" />
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Sprint Priorities ── */}
        <section>
          <SectionLabel>Recommended Sprint Priorities</SectionLabel>
          <div className="space-y-3">
            {sprintPriorities.map((p, i) => (
              <div
                key={i}
                className="flex gap-4 rounded-xl border border-white/[0.06] bg-[#13141b] px-5 py-4"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-zinc-300 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Footer ── */}
        <div className="pt-2 pb-4 border-t border-white/[0.05]">
          <p className="text-xs text-zinc-700">
            Generated by Convometrics ·{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              day:   "numeric",
              year:  "numeric",
            })}
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function SectionLabel({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <p
      className={`text-xs font-semibold text-zinc-500 uppercase tracking-widest ${flush ? "" : "mb-3"}`}
    >
      {children}
    </p>
  );
}
