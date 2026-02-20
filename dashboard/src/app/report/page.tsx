"use client";

import { useEffect, useState, useRef } from "react";
import { useProductProfile } from "@/lib/product-profile-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  summary: {
    totalConversations: number;
    analyzedCount: number;
    platformCount: number;
    platforms: string[];
    overallQuality: number | null;
    overallCompletion: number | null;
    overallFailure: number | null;
    healthScore: number | null;
    topFailureIntent: string | null;
    topFailureRate: number | null;
    bestIntent: string | null;
    bestCompletion: number | null;
    bestPlatform: string | null;
    bestPlatformQuality: number | null;
  };
  keyFindings: string[];
  topTopics: {
    intent: string; intentLabel: string; count: number;
    avgQuality: number | null; completionRate: number; failureRate: number;
  }[];
  topFailures: {
    intent: string; intentLabel: string; count: number;
    failureRate: number; impactScore: number; examples: string[];
  }[];
  recommendations: {
    priority: number; title: string; description: string; metric: string;
  }[];
  platformComparison: {
    platform: string; label: string; avgQuality: number | null; completionRate: number | null; count: number;
  }[];
  platformSpecialization: { platform: string; bestTopic: string }[];
  dateRange: { start: string | null; end: string | null };
  generatedAt: string;
  isMultiPlatform: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function fmtShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-4xl space-y-6">
      <Bone className="h-8 w-64" />
      <Bone className="h-32 rounded-xl" />
      <Bone className="h-48 rounded-xl" />
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Score pill ───────────────────────────────────────────────────────────────

function ScorePill({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-zinc-600">—</span>;
  const color = value >= 70 ? "text-emerald-400" : value >= 50 ? "text-amber-400" : "text-red-400";
  return <span className={`font-mono font-bold ${color}`}>{value}{suffix}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Report() {
  const { editableName, profile } = useProductProfile();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/report")
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  function handlePrint() {
    window.print();
  }

  function handleCopyMarkdown() {
    if (!data) return;
    const { summary, keyFindings, topTopics, topFailures, recommendations } = data;
    const md = [
      `# AI Performance Report — ${editableName}`,
      `Generated: ${fmtDate(data.generatedAt)}`,
      ``,
      `## Executive Summary`,
      ``,
      buildExecutiveSummary(data, editableName),
      ``,
      `## Key Findings`,
      ``,
      keyFindings.map((f) => `- ${f}`).join("\n"),
      ``,
      `## Topic Breakdown`,
      ``,
      `| Topic | Conversations | Avg Quality | Completion Rate | Failure Rate |`,
      `|-------|--------------|-------------|-----------------|--------------|`,
      topTopics.map((t) => `| ${t.intentLabel} | ${fmt(t.count)} | ${t.avgQuality ?? "—"}/100 | ${t.completionRate}% | ${t.failureRate}% |`).join("\n"),
      ``,
      `## Failure Analysis`,
      ``,
      topFailures.map((t, i) => `${i + 1}. **${t.intentLabel}** — ${t.failureRate}% failure rate, ${fmt(t.count)} conversations${t.examples[0] ? `\n   Example: "${t.examples[0]}"` : ""}`).join("\n\n"),
      ``,
      `## Recommendations`,
      ``,
      recommendations.map((r) => `**Priority ${r.priority}: ${r.title}**\n${r.description}`).join("\n\n"),
      ``,
      `## Methodology`,
      ``,
      `Quality scores (0–100) are assigned by an AI evaluator reading each conversation. ` +
      `Completion status indicates whether the user accomplished their goal. ` +
      `Health Score = (avg quality / 100) × completion rate × (1 − failure rate).`,
    ].join("\n");

    navigator.clipboard.writeText(md).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load report</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const { summary, keyFindings, topTopics, topFailures, recommendations, platformComparison } = data;

  return (
    <div className="p-8 max-w-4xl space-y-8 print:p-6 print:max-w-none">
      {/* Report header */}
      <div className="flex items-start justify-between print:mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">AI Performance Report</p>
          <h1 className="text-2xl font-bold text-white">{editableName}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generated {fmtDate(data.generatedAt)}
            {data.dateRange.start && ` · Data from ${fmtShortDate(data.dateRange.start)} to ${fmtShortDate(data.dateRange.end)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors">
            {copyDone ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Markdown
              </>
            )}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-8">
        {/* Scorecard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Health Score", value: summary.healthScore, suffix: "/100" },
            { label: "Avg Quality", value: summary.overallQuality, suffix: "/100" },
            { label: "Completion Rate", value: summary.overallCompletion, suffix: "%" },
            { label: "Conversations", value: summary.totalConversations, isCount: true },
          ].map(({ label, value, suffix, isCount }) => (
            <div key={label} className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-4 print:border-zinc-800">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
              {isCount ? (
                <p className="text-2xl font-bold text-white">{fmt(value as number)}</p>
              ) : (
                <p className="text-2xl font-bold"><ScorePill value={value as number | null} suffix={suffix} /></p>
              )}
            </div>
          ))}
        </div>

        {/* Executive Summary */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-4">Executive Summary</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">{buildExecutiveSummary(data, editableName)}</p>
        </section>

        {/* Key Findings */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-4">Key Findings</h2>
          {keyFindings.length === 0 ? (
            <p className="text-sm text-zinc-600">Run analysis to generate findings.</p>
          ) : (
            <ul className="space-y-2.5">
              {keyFindings.map((finding, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {finding}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Topic Breakdown */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden print:border-zinc-800">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white">Topic Breakdown</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Top 10 topics by conversation volume</p>
          </div>
          {topTopics.length === 0 ? (
            <div className="px-6 py-8 text-sm text-zinc-600">No topic data available — run analysis workers.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Topic", "Conversations", "Avg Quality", "Completion", "Failure Rate"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topTopics.map((topic, i) => (
                  <tr key={topic.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-zinc-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 text-zinc-200 capitalize">{topic.intentLabel}</td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono">{fmt(topic.count)}</td>
                    <td className="px-4 py-2.5">
                      {topic.avgQuality !== null ? (
                        <span className="font-mono text-xs" style={{
                          color: topic.avgQuality >= 75 ? "#22c55e" : topic.avgQuality >= 60 ? "#84cc16" : topic.avgQuality >= 45 ? "#eab308" : "#ef4444"
                        }}>{topic.avgQuality}/100</span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{topic.completionRate}%</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-xs ${topic.failureRate >= 40 ? "text-red-400" : topic.failureRate >= 20 ? "text-amber-400" : "text-zinc-400"}`}>
                        {topic.failureRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Failure Analysis */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Failure Analysis</h2>
          <p className="text-xs text-zinc-500 mb-5">Top failure areas ranked by impact on users</p>
          {topFailures.length === 0 ? (
            <p className="text-sm text-zinc-600">No failure data available — run analysis workers.</p>
          ) : (
            <div className="space-y-5">
              {topFailures.map((failure, i) => (
                <div key={failure.intent} className="border-l-2 border-red-500/30 pl-4">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                      <span className="text-xs font-mono text-zinc-600 mr-2">#{i + 1}</span>
                      <span className="text-sm font-medium text-white capitalize">{failure.intentLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      <span className="text-red-400 font-mono">{failure.failureRate}% failure</span>
                      <span className="text-zinc-500">{fmt(failure.count)} convos</span>
                    </div>
                  </div>
                  {failure.examples.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {failure.examples.slice(0, 2).map((ex, j) => (
                        <p key={j} className="text-xs text-zinc-600 italic bg-white/[0.02] rounded px-3 py-2 border border-white/[0.04]">
                          &ldquo;{ex}&rdquo;
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Platform Comparison (if multi-platform) */}
        {data.isMultiPlatform && platformComparison.length > 0 && (
          <section className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden print:border-zinc-800">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-semibold text-white">Platform Comparison</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Quality and completion by AI platform</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Platform", "Conversations", "Avg Quality", "Completion Rate"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platformComparison.map((p) => (
                  <tr key={p.platform} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-zinc-200">{p.label}</td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono">{fmt(p.count)}</td>
                    <td className="px-4 py-2.5">
                      {p.avgQuality !== null ? (
                        <span className="font-mono text-xs" style={{
                          color: p.avgQuality >= 75 ? "#22c55e" : p.avgQuality >= 60 ? "#84cc16" : p.avgQuality >= 45 ? "#eab308" : "#ef4444"
                        }}>{p.avgQuality}/100</span>
                      ) : <span className="text-zinc-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">
                      {p.completionRate !== null ? `${p.completionRate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Recommendations */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Recommendations</h2>
          <p className="text-xs text-zinc-500 mb-5">Action items ranked by expected impact</p>
          {recommendations.length === 0 ? (
            <p className="text-sm text-zinc-600">No recommendations available — run analysis workers to generate data.</p>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec.priority} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-indigo-400">{rec.priority}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{rec.title}</p>
                    <p className="text-xs text-zinc-500 mt-1">{rec.description}</p>
                    <span className="inline-block mt-2 text-[10px] font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded">{rec.metric}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Methodology */}
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-3">Methodology</h2>
          <div className="text-sm text-zinc-500 space-y-2 leading-relaxed">
            <p>
              <strong className="text-zinc-300">Quality Score (0–100):</strong> Each conversation is evaluated by an AI model
              that reads the full conversation and scores it on relevance, accuracy, completeness, and helpfulness.
            </p>
            <p>
              <strong className="text-zinc-300">Completion Status:</strong> Determined from conversation signals — whether the
              user&apos;s goal was resolved, partially addressed, failed, or abandoned mid-conversation.
            </p>
            <p>
              <strong className="text-zinc-300">Health Score:</strong> Composite metric = (avg quality / 100) × completion rate × (1 − failure rate).
              Ranges 0–100. Reflects overall product health across all three dimensions.
            </p>
            <p>
              <strong className="text-zinc-300">Impact Score:</strong> Prioritization metric = conversation volume × failure rate × quality gap.
              Higher = fix first. Used to rank recommendations by expected user impact.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Executive summary builder ────────────────────────────────────────────────

function buildExecutiveSummary(data: ReportData, datasetName: string): string {
  const { summary } = data;
  const parts: string[] = [];

  // Sentence 1: Dataset overview
  if (summary.analyzedCount > 0) {
    parts.push(
      `We analyzed ${fmt(summary.analyzedCount)} conversations` +
      (data.isMultiPlatform ? ` across ${summary.platformCount} AI platforms (${summary.platforms.join(", ")})` : "") +
      ` from the ${datasetName} dataset.`
    );
  } else {
    parts.push(
      `The ${datasetName} dataset contains ${fmt(summary.totalConversations)} conversations` +
      (data.isMultiPlatform ? ` across ${summary.platforms.join(", ")}` : "") +
      `. No analysis has been run yet.`
    );
  }

  // Sentence 2: Quality
  if (summary.overallQuality !== null) {
    const qualLabel =
      summary.overallQuality >= 80 ? "excellent" :
      summary.overallQuality >= 65 ? "good" :
      summary.overallQuality >= 50 ? "acceptable" :
      summary.overallQuality >= 35 ? "below expectations" : "poor";
    parts.push(`Overall AI quality is ${summary.overallQuality}/100 — ${qualLabel}.`);
  }

  // Sentence 3: Biggest issue
  if (summary.topFailureIntent && summary.topFailureRate !== null) {
    parts.push(
      `The biggest challenge is "${summary.topFailureIntent.replace(/_/g, " ")}" with a ${summary.topFailureRate}% failure rate.`
    );
  }

  // Sentence 4: Strongest area
  if (summary.bestIntent && summary.bestCompletion !== null) {
    parts.push(
      `The strongest area is "${summary.bestIntent.replace(/_/g, " ")}" with ${summary.bestCompletion}% completion rate.`
    );
  }

  return parts.join(" ");
}
