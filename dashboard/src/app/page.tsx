"use client";

import { useAnalysis } from "@/lib/analysis-context";
import { formatLabel } from "@/lib/formatLabel";

// ─── ConvoMetrics — Demo Briefing Page ───────────────────────────────────────
// Single scrollable briefing. No tabs, no sidebar. Dense analyst report.

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header className="sticky top-0 z-50 h-14 shrink-0 border-b border-white/[0.06] bg-[#0a0b10]/90 backdrop-blur-md flex items-center justify-between px-6">
      <a href="https://convometrics-landing.vercel.app" className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        ConvoMetrics
      </a>
      <a
        href="/upload"
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8178ff] text-white hover:bg-[#9490ff] hover:shadow-[0_0_20px_rgba(129,120,255,0.3)] transition-all"
      >
        Upload Your Data
      </a>
    </header>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-white/[0.05] py-12 first:pt-10 last:border-b-0">
      {children}
    </section>
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function Chat({ role, children }: { role: "user" | "ai" | "system"; children: React.ReactNode }) {
  if (role === "system") {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[10px] font-mono text-zinc-600 italic">{children}</span>
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <div className={`flex gap-2.5 py-1.5 ${isUser ? "" : ""}`}>
      <span className="shrink-0 text-sm mt-0.5">{isUser ? "\uD83D\uDC64" : "\uD83E\uDD16"}</span>
      <p className={`text-[13px] leading-relaxed ${isUser ? "text-zinc-300" : "text-zinc-500"}`}>{children}</p>
    </div>
  );
}

function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-amber-500/30">
      <p className="text-[11px] text-amber-400/80 leading-relaxed italic">{children}</p>
    </div>
  );
}

// ─── Intent Map Item ─────────────────────────────────────────────────────────

function IntentBlock({ name, sessions, success, status }: {
  name: string; sessions: number; success: number | null; status: "critical" | "warning" | "good" | "info";
}) {
  const colors = {
    critical: { bar: "bg-red-400", text: "text-red-400", bg: "bg-red-400/[0.06] border-red-400/[0.12]" },
    warning: { bar: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-400/[0.06] border-amber-400/[0.12]" },
    good: { bar: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/[0.06] border-emerald-400/[0.12]" },
    info: { bar: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/[0.06] border-zinc-500/[0.12]" },
  };
  const c = colors[status];
  return (
    <div className={`rounded-lg border p-3 ${c.bg}`}>
      <p className="font-mono text-[11px] font-semibold text-zinc-300 mb-1.5 truncate">{name}</p>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] text-zinc-500 font-mono">{sessions} sess</span>
        {success !== null ? (
          <span className={`text-[10px] font-mono font-semibold ${c.text}`}>{success}%</span>
        ) : (
          <span className="text-[10px] font-mono text-zinc-600">signal</span>
        )}
      </div>
      {success !== null && (
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${success}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Live Dashboard (shown when uploaded results exist) ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

function QualityBar({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const color = score >= 70 ? "bg-emerald-400" : score >= 45 ? "bg-amber-400" : "bg-red-400";
  const textColor = score >= 70 ? "text-emerald-400" : score >= 45 ? "text-amber-400" : "text-red-400";
  const h = size === "md" ? "h-1.5" : "h-1";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} rounded-full bg-white/[0.06] overflow-hidden`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-semibold ${textColor} w-7 text-right`}>{score}</span>
    </div>
  );
}

function LiveDashboard({ data }: { data: AnyData }) {
  const summary = data.summary ?? {};
  const intents = (data.intent_breakdown ?? []) as AnyData[];
  const conversations = (data.conversations ?? []) as AnyData[];
  const topIssues = (data.top_issues ?? []) as AnyData[];
  const patterns = (data.patterns ?? []) as AnyData[];
  const clusters = (data.topic_clusters ?? []) as AnyData[];
  const failureBreakdown = (data.failure_breakdown ?? []) as AnyData[];
  const quality = data.quality_breakdown ?? {};
  const sentiment = data.sentiment_breakdown ?? { positive: 0, neutral: 0, negative: 0 };
  const total = summary.total_conversations ?? conversations.length;
  const reportedRate = Math.round((summary.reported_resolution_rate ?? 0) * 100);
  const actualRate = Math.round((summary.actual_resolution_rate ?? 0) * 100);
  const politeChurnerPct = Math.round((data.polite_churner_rate ?? 0) * 100);
  const falsePositivePct = Math.round((data.false_positive_rate ?? 0) * 100);
  const handoffPct = Math.round((data.handoff_rate ?? 0) * 100);
  const briefing = (summary.briefing ?? []) as string[];
  const sentimentTraj = data.sentiment_trajectory as AnyData | undefined;
  const resBreakdown = data.resolution_breakdown as AnyData | undefined;
  const channelBreakdown = (data.channel_breakdown ?? []) as AnyData[];
  const productBreakdown = (data.product_breakdown ?? []) as AnyData[];
  const planTierBreakdown = (data.plan_tier_breakdown ?? []) as AnyData[];
  const aiFailurePatterns = (data.ai_failure_patterns ?? []) as AnyData[];
  const churnRisk = data.churn_risk as AnyData | undefined;

  const outcomeCounts: Record<string, number> = {};
  for (const c of conversations) {
    outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] ?? 0) + 1;
  }

  const outcomeColor = (o: string) => {
    const m: Record<string, string> = { success: "text-emerald-400 bg-emerald-400/10", failed: "text-red-400 bg-red-400/10", abandoned: "text-amber-400 bg-amber-400/10", escalated: "text-blue-400 bg-blue-400/10" };
    return m[o] ?? "text-zinc-400 bg-white/[0.05]";
  };
  const sentimentColor = (s: string) => {
    const m: Record<string, string> = { positive: "text-emerald-400 bg-emerald-400/10", neutral: "text-zinc-400 bg-zinc-400/10", negative: "text-red-400 bg-red-400/10" };
    return m[s] ?? "text-zinc-400 bg-white/[0.05]";
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] flex flex-col">
      <header className="sticky top-0 z-50 h-14 shrink-0 border-b border-white/[0.06] bg-[#0a0b10]/90 backdrop-blur-md flex items-center justify-between px-6">
        <a href="/" className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          ConvoMetrics
        </a>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            Live Data
          </span>
          <a href="/upload" className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8178ff] text-white hover:bg-[#9490ff] transition-all">
            Upload New Data
          </a>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-5">

          {/* ── HEADER + KEY INSIGHT ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">ConvoMetrics Briefing</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Your Conversation Analysis</h1>
            <p className="text-sm text-zinc-400 mb-4">Analysis of {total.toLocaleString()} conversations &middot; {(summary.total_messages ?? 0).toLocaleString()} messages</p>
            {summary.key_insight && (
              <div className="rounded-lg border border-indigo-400/20 bg-indigo-400/[0.05] p-4 mb-4">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-400/70 mb-1">Key Insight</p>
                <p className="text-[13px] text-indigo-200 leading-relaxed">{summary.key_insight}</p>
              </div>
            )}
            {briefing.length > 0 && (
              <div className="space-y-1.5">
                {briefing.map((b: string, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] text-zinc-600 mt-0.5 shrink-0">&bull;</span>
                    <p className="text-[12px] text-zinc-400 leading-relaxed">{b}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── REALITY CHECK ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-6">The Reality Check</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="bg-[#0e1017] p-5 sm:border-r border-b sm:border-b-0 border-white/[0.07]">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">What your dashboard says</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Resolution Rate</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">{reportedRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Total Conversations</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">{total.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-[#13141b] p-5">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/70 mb-4">What&rsquo;s actually happening</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Actual Resolution Rate</p>
                    <p className="font-mono text-2xl font-bold text-red-400">{actualRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Polite Churners</p>
                    <p className="font-mono text-2xl font-bold text-amber-400">{politeChurnerPct}%</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Said &ldquo;thanks&rdquo; but didn&rsquo;t get what they needed</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Escalation Rate</p>
                    <p className="font-mono text-2xl font-bold text-amber-400">{handoffPct}%</p>
                  </div>
                  {falsePositivePct > 0 && (
                    <div>
                      <p className="text-[10px] text-zinc-500 mb-0.5">False Positive Rate</p>
                      <p className="font-mono text-2xl font-bold text-red-400">{falsePositivePct}%</p>
                      <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Labeled resolved but user didn&rsquo;t get help</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {summary.gap_explanation && (
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[11px] text-zinc-400 leading-relaxed">{summary.gap_explanation}</p>
              </div>
            )}
          </Section>

          {/* ── QUALITY DIMENSIONS ── */}
          {quality.avg_overall != null && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Quality Dimensions</p>
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    <span className={`font-mono text-2xl font-bold ${quality.avg_overall >= 70 ? "text-emerald-400" : quality.avg_overall >= 45 ? "text-amber-400" : "text-red-400"}`}>
                      {quality.avg_overall}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Overall Quality Score</p>
                    <p className="text-[11px] text-zinc-500">Weighted average across all dimensions</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { key: "avg_helpfulness", label: "Helpfulness", weight: "25%" },
                    { key: "avg_accuracy", label: "Accuracy", weight: "20%" },
                    { key: "avg_relevance", label: "Relevance", weight: "15%" },
                    { key: "avg_satisfaction", label: "Satisfaction", weight: "15%" },
                    { key: "avg_coherence", label: "Coherence", weight: "10%" },
                    { key: "avg_naturalness", label: "Naturalness", weight: "10%" },
                    { key: "avg_safety", label: "Safety", weight: "5%" },
                  ].map((dim) => quality[dim.key] != null && (
                    <div key={dim.key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-zinc-400">{dim.label}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">{dim.weight}</span>
                      </div>
                      <QualityBar score={quality[dim.key]} size="md" />
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ── SENTIMENT ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Sentiment Breakdown</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Positive", count: sentiment.positive, color: "text-emerald-400", bg: "bg-emerald-400/[0.06] border-emerald-400/[0.12]" },
                { label: "Neutral", count: sentiment.neutral, color: "text-zinc-400", bg: "bg-zinc-500/[0.06] border-zinc-500/[0.12]" },
                { label: "Negative", count: sentiment.negative, color: "text-red-400", bg: "bg-red-400/[0.06] border-red-400/[0.12]" },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg border p-3 text-center ${s.bg}`}>
                  <p className={`font-mono text-xl font-bold ${s.color}`}>{s.count}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── SENTIMENT TRAJECTORY ── */}
          {sentimentTraj && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Sentiment Trajectory</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-red-400/[0.12] bg-red-400/[0.06] p-3 text-center">
                  <p className="font-mono text-xl font-bold text-red-400">{sentimentTraj.worsened ?? 0}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Worsened</p>
                </div>
                <div className="rounded-lg border border-emerald-400/[0.12] bg-emerald-400/[0.06] p-3 text-center">
                  <p className="font-mono text-xl font-bold text-emerald-400">{sentimentTraj.improved ?? 0}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Improved</p>
                </div>
                <div className="rounded-lg border border-zinc-500/[0.12] bg-zinc-500/[0.06] p-3 text-center">
                  <p className="font-mono text-xl font-bold text-zinc-400">{sentimentTraj.stable ?? 0}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Stable</p>
                </div>
              </div>
              {typeof sentimentTraj.worsened_pct === "number" && sentimentTraj.worsened_pct > 0 && (
                <p className="text-[11px] text-zinc-500 mt-3">
                  {Math.round(sentimentTraj.worsened_pct * 100)}% of conversations ended worse than they started
                </p>
              )}
            </Section>
          )}

          {/* ── RESOLUTION BREAKDOWN ── */}
          {resBreakdown && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Resolution Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Truly Resolved", key: "truly_resolved", color: "text-emerald-400", bg: "bg-emerald-400/[0.06] border-emerald-400/[0.12]" },
                  { label: "Resolved w/ Frustration", key: "resolved_after_frustration", color: "text-amber-400", bg: "bg-amber-400/[0.06] border-amber-400/[0.12]" },
                  { label: "False Positive", key: "false_positive_resolved", color: "text-red-400", bg: "bg-red-400/[0.06] border-red-400/[0.12]" },
                  { label: "Escalated to Human", key: "escalated_to_human", color: "text-blue-400", bg: "bg-blue-400/[0.06] border-blue-400/[0.12]" },
                  { label: "Unresolved", key: "in_progress", color: "text-zinc-400", bg: "bg-zinc-500/[0.06] border-zinc-500/[0.12]" },
                  { label: "Cancelled", key: "cancelled", color: "text-zinc-500", bg: "bg-zinc-600/[0.06] border-zinc-600/[0.12]" },
                ].map((item) => {
                  const count = resBreakdown[item.key] ?? 0;
                  if (count === 0 && item.key === "cancelled") return null;
                  return (
                    <div key={item.key} className={`rounded-lg border p-3 text-center ${item.bg}`}>
                      <p className={`font-mono text-xl font-bold ${item.color}`}>{count}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── INTENT MAP ── */}
          {intents.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Intent Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {intents.map((i) => (
                  <IntentBlock
                    key={i.name}
                    name={formatLabel(i.display_name || i.name)}
                    sessions={i.sessions}
                    success={Math.round(i.success_rate * 100)}
                    status={i.severity === "critical" ? "critical" : i.severity === "warning" ? "warning" : "good"}
                  />
                ))}
              </div>
              {/* Root causes for critical intents */}
              <div className="mt-6 space-y-3">
                {intents.filter((i) => i.severity === "critical" || i.severity === "warning").map((i) => (
                  <div key={i.name} className={`rounded-lg border p-3 ${i.severity === "critical" ? "border-red-400/10 bg-red-400/[0.03]" : "border-amber-400/10 bg-amber-400/[0.03]"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-[11px] font-semibold ${i.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>{formatLabel(i.display_name || i.name)}</p>
                      {i.avg_quality != null && <span className="text-[10px] font-mono text-zinc-600">Quality: {i.avg_quality}</span>}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{i.root_cause}</p>
                    {i.downstream_impact && <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">{i.downstream_impact}</p>}
                    {i.top_failure_types?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {i.top_failure_types.map((ft: string) => (
                          <span key={ft} className="text-[9px] font-mono text-red-400/70 bg-red-400/[0.06] px-1.5 py-0.5 rounded">{formatLabel(ft)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── TOPIC CLUSTERS ── */}
          {clusters.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Topic Clusters</p>
              <div className="space-y-3">
                {clusters.map((c, i) => {
                  const trendColors: Record<string, string> = { improving: "text-emerald-400", stable: "text-zinc-400", declining: "text-red-400" };
                  return (
                    <div key={i} className="rounded-lg border border-white/[0.07] bg-[#13141b] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-500">{c.total_sessions} sess</span>
                          {c.trend && <span className={`text-[10px] font-mono ${trendColors[c.trend] ?? "text-zinc-500"}`}>{c.trend}</span>}
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{c.description}</p>
                      {c.avg_quality != null && <QualityBar score={c.avg_quality} />}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(c.intents ?? []).map((name: string) => (
                          <span key={name} className="text-[9px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{formatLabel(name)}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── OUTCOME BREAKDOWN ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Outcome Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(outcomeCounts).map(([outcome, count]) => {
                const colors: Record<string, string> = { success: "text-emerald-400", failed: "text-red-400", abandoned: "text-amber-400", escalated: "text-blue-400" };
                return (
                  <div key={outcome} className="rounded-lg border border-white/[0.07] bg-[#13141b] p-3 text-center">
                    <p className={`font-mono text-xl font-bold ${colors[outcome] ?? "text-zinc-400"}`}>{count}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 capitalize">{outcome}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── HIDDEN PATTERNS ── */}
          {patterns.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Hidden Patterns</p>
              <div className="space-y-3">
                {patterns.map((p, i) => {
                  const sevColors: Record<string, { border: string; text: string }> = {
                    critical: { border: "border-red-400/15", text: "text-red-400" },
                    warning: { border: "border-amber-400/15", text: "text-amber-400" },
                    info: { border: "border-blue-400/15", text: "text-blue-400" },
                  };
                  const sc = sevColors[p.severity] ?? sevColors.info;
                  return (
                    <div key={i} className={`rounded-lg border ${sc.border} bg-[#13141b] p-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <p className={`text-[12px] font-semibold ${sc.text}`}>{p.label ?? formatLabel(p.name)}</p>
                          <span className={`text-[10px] font-mono ${sc.text} bg-white/[0.04] px-1.5 py-0.5 rounded`}>{p.severity}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500">{p.count} found</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-1">{p.description}</p>
                      {p.insight && <p className="text-[11px] text-zinc-500 leading-relaxed italic">{p.insight}</p>}
                      {p.affected_intents?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.affected_intents.map((name: string) => (
                            <span key={name} className="text-[9px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{formatLabel(name)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── FAILURE BREAKDOWN ── */}
          {failureBreakdown.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Failure Analysis</p>
              <div className="space-y-2">
                {failureBreakdown.map((f, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.06] bg-[#13141b] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-red-400">{formatLabel(f.type)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">{f.count} occurrences</span>
                        <span className="text-[10px] font-mono text-red-400/70">{typeof f.pct === "number" ? `${Math.round(f.pct)}%` : ""}</span>
                      </div>
                    </div>
                    {f.example_detail && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed mb-1.5">&ldquo;{f.example_detail}&rdquo;</p>
                    )}
                    {f.top_intents?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {f.top_intents.map((name: string) => (
                          <span key={name} className="text-[9px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{formatLabel(name)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── CHANNEL BREAKDOWN ── */}
          {channelBreakdown.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Channel Breakdown</p>
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Channel", "Conversations", "Resolution", "Escalation"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {channelBreakdown.map((ch) => (
                      <tr key={ch.channel} className="border-b border-white/[0.03]">
                        <td className="px-4 py-2.5 text-zinc-300 text-[12px]">{ch.channel}</td>
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-[12px]">{ch.conversations}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px]">
                          <span className={ch.resolution_rate >= 0.7 ? "text-emerald-400" : ch.resolution_rate >= 0.4 ? "text-amber-400" : "text-red-400"}>
                            {Math.round(ch.resolution_rate * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px]">
                          <span className={ch.escalation_rate >= 0.2 ? "text-red-400" : "text-zinc-400"}>
                            {Math.round(ch.escalation_rate * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── PRODUCT BREAKDOWN ── */}
          {productBreakdown.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Product Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productBreakdown.map((p) => (
                  <div key={p.product} className="rounded-lg border border-white/[0.07] bg-[#13141b] p-3">
                    <p className="text-[12px] font-semibold text-white mb-1">{p.product}</p>
                    <p className="text-[10px] text-zinc-500">{p.conversations} conversations</p>
                    <p className={`font-mono text-lg font-bold mt-1 ${p.resolution_rate >= 0.7 ? "text-emerald-400" : p.resolution_rate >= 0.4 ? "text-amber-400" : "text-red-400"}`}>
                      {Math.round(p.resolution_rate * 100)}% resolved
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── PLAN TIER BREAKDOWN ── */}
          {planTierBreakdown.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Plan Tier Breakdown</p>
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Tier", "Conversations", "Bad Outcome Rate", "Escalation"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planTierBreakdown.map((t) => (
                      <tr key={t.tier} className="border-b border-white/[0.03]">
                        <td className="px-4 py-2.5 text-zinc-300 text-[12px] capitalize">{t.tier}</td>
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-[12px]">{t.conversations}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px]">
                          <span className={t.bad_outcome_rate >= 0.3 ? "text-red-400" : t.bad_outcome_rate >= 0.15 ? "text-amber-400" : "text-emerald-400"}>
                            {Math.round(t.bad_outcome_rate * 100)}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[12px]">
                          <span className={t.escalation_rate >= 0.2 ? "text-red-400" : "text-zinc-400"}>
                            {Math.round(t.escalation_rate * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ── AI FAILURE PATTERNS ── */}
          {aiFailurePatterns.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">AI Failure Patterns</p>
              <div className="space-y-2">
                {aiFailurePatterns.map((p, i) => (
                  <div key={i} className="rounded-lg border border-red-400/10 bg-[#13141b] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-red-400">{p.trigger}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{p.count} occurrences</span>
                    </div>
                    {p.top_intents?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.top_intents.map((name: string) => (
                          <span key={name} className="text-[9px] font-mono text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{formatLabel(name)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── CHURN RISK ── */}
          {churnRisk && churnRisk.total_churn_risk_conversations > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Churn Risk</p>
              <div className="rounded-xl border border-red-400/10 bg-[#13141b] p-4">
                <p className="text-[12px] text-zinc-400 mb-3">
                  <span className="font-mono font-bold text-red-400">{churnRisk.total_churn_risk_conversations}</span> conversations with churn risk indicators
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className={`font-mono text-lg font-bold ${churnRisk.cancellation_save_rate >= 0.5 ? "text-emerald-400" : "text-red-400"}`}>
                      {Math.round(churnRisk.cancellation_save_rate * 100)}%
                    </p>
                    <p className="text-[10px] text-zinc-500">Cancellation Save Rate</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-mono text-lg font-bold ${churnRisk.complaint_resolution_rate >= 0.5 ? "text-emerald-400" : "text-red-400"}`}>
                      {Math.round(churnRisk.complaint_resolution_rate * 100)}%
                    </p>
                    <p className="text-[10px] text-zinc-500">Complaint Resolution</p>
                  </div>
                  <div className="text-center">
                    <p className={`font-mono text-lg font-bold ${churnRisk.refund_resolution_rate >= 0.5 ? "text-emerald-400" : "text-red-400"}`}>
                      {Math.round(churnRisk.refund_resolution_rate * 100)}%
                    </p>
                    <p className="text-[10px] text-zinc-500">Refund Resolution</p>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* ── TOP ACTIONS ── */}
          {topIssues.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Recommended Actions</p>
              <div className="space-y-3">
                {topIssues.map((issue, i) => (
                  <div key={i} className="rounded-lg border border-white/[0.07] bg-[#13141b] p-4">
                    <div className="flex items-start gap-3">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${issue.priority === "high" ? "text-red-400 bg-red-400/10" : issue.priority === "medium" ? "text-amber-400 bg-amber-400/10" : "text-blue-400 bg-blue-400/10"}`}>
                        {issue.priority}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white mb-1">{issue.title}</p>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{issue.why}</p>
                        {issue.estimated_improvement && (
                          <p className="text-[11px] text-emerald-400/80 leading-relaxed mt-1">{issue.estimated_improvement}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-mono text-zinc-500">{formatLabel(issue.intent)}</span>
                          <span className="text-[10px] font-mono text-zinc-600">{issue.effort} effort</span>
                          <span className="text-[10px] font-mono text-emerald-400">{issue.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── DETAILED CONVERSATIONS ── */}
          {conversations.length > 0 && (
            <Section>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">
                Conversation Deep Dive ({conversations.length})
              </p>
              <div className="space-y-4">
                {conversations.slice(0, 30).map((c) => (
                  <div key={c.id} className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${outcomeColor(c.outcome)}`}>
                          {c.outcome}
                        </span>
                        <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${sentimentColor(c.sentiment)}`}>
                          {c.sentiment}
                        </span>
                        {c.sentiment_trajectory && c.sentiment_trajectory !== "stable" && (
                          <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${c.sentiment_trajectory === "worsened" ? "text-red-400 bg-red-400/10" : "text-emerald-400 bg-emerald-400/10"}`}>
                            {c.sentiment_trajectory === "worsened" ? "\u2198" : "\u2197"} {c.sentiment_trajectory}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500">{formatLabel(c.intent)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.channel && <span className="text-[10px] font-mono text-zinc-600">{c.channel}</span>}
                        {c.message_count != null && <span className="text-[10px] font-mono text-zinc-600">{c.message_count} msgs</span>}
                        {c.resolution_mismatch && (
                          <span className="text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">mismatch</span>
                        )}
                        {c.quality_score != null && (
                          <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${c.quality_score >= 70 ? "text-emerald-400 bg-emerald-400/10" : c.quality_score >= 45 ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"}`}>
                            Q:{c.quality_score}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3 space-y-3">
                      {/* Summary */}
                      <p className="text-[12px] text-zinc-300 leading-relaxed">{c.summary}</p>

                      {/* First user message */}
                      {c.first_user_message && (
                        <div className="flex gap-2 py-1.5">
                          <span className="shrink-0 text-sm mt-0.5">{"\uD83D\uDC64"}</span>
                          <p className="text-[12px] text-zinc-400 leading-relaxed italic">&ldquo;{c.first_user_message}&rdquo;</p>
                        </div>
                      )}

                      {/* Key excerpt */}
                      {c.key_excerpt && (
                        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">Key Exchange</p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-line">{c.key_excerpt}</p>
                        </div>
                      )}

                      {/* Failure tags */}
                      {c.failure_tags?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-1.5">Failures Detected</p>
                          <div className="flex flex-wrap gap-1">
                            {c.failure_tags.map((tag: string, i: number) => (
                              <span key={i} className="text-[9px] font-mono text-red-400/80 bg-red-400/[0.06] border border-red-400/[0.1] px-1.5 py-0.5 rounded">{formatLabel(tag)}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Satisfaction signals */}
                      {c.satisfaction_signals?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1.5">User Signals</p>
                          <div className="flex flex-wrap gap-1">
                            {c.satisfaction_signals.map((sig: string, i: number) => {
                              const sigColor: Record<string, string> = { gratitude: "text-emerald-400/70 bg-emerald-400/[0.06]", deepening: "text-emerald-400/70 bg-emerald-400/[0.06]", quick_followup: "text-blue-400/70 bg-blue-400/[0.06]", abandonment: "text-red-400/70 bg-red-400/[0.06]", escalation_request: "text-red-400/70 bg-red-400/[0.06]", retry_pattern: "text-amber-400/70 bg-amber-400/[0.06]", rephrasing: "text-amber-400/70 bg-amber-400/[0.06]", message_shortening: "text-zinc-400/70 bg-zinc-400/[0.06]" };
                              return (
                                <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sigColor[sig] ?? "text-zinc-400/70 bg-white/[0.04]"}`}>{formatLabel(sig)}</span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Frustration triggers */}
                      {c.frustration_triggers?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-1.5">Frustration Triggers</p>
                          <div className="flex flex-wrap gap-1">
                            {c.frustration_triggers.map((trigger: string, i: number) => (
                              <span key={i} className="text-[9px] font-mono text-red-400/80 bg-red-400/[0.06] border border-red-400/[0.1] px-1.5 py-0.5 rounded">&ldquo;{trigger}&rdquo;</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>
      </main>
      <footer className="border-t border-white/[0.05] py-4 text-center">
        <p className="text-[11px] text-zinc-700">&copy; 2026 ConvoMetrics</p>
      </footer>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const { results } = useAnalysis();

  if (results) {
    return <LiveDashboard data={results.data} />;
  }
  return (
    <div className="min-h-screen bg-[#0a0b10] flex flex-col">
      <TopBar />
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-5">

          {/* ── SECTION 1: BRIEFING HEADER ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">ConvoMetrics Briefing</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Acme AI Support Agent</h1>
            <p className="text-sm text-zinc-400 mb-2">Analysis of 6,241 support tickets &middot; Feb 10&ndash;17, 2026</p>
            <p className="text-[11px] text-zinc-600 bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 inline-block">
              Demo analysis &mdash; <a href="/upload" className="text-indigo-400 hover:text-indigo-300 transition-colors">Upload your own data</a> to get your ConvoMetrics briefing
            </p>
          </Section>

          {/* ── SECTION 2: THE REALITY CHECK ── */}
          <Section id="reality-check">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-6">The Reality Check</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl border border-white/[0.07] overflow-hidden">
              {/* Left — what dashboard says */}
              <div className="bg-[#0e1017] p-5 sm:border-r border-b sm:border-b-0 border-white/[0.07]">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">What your dashboard says</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Resolution Rate</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">74%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Avg CSAT</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">4.1<span className="text-base text-zinc-600">/5</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Avg Response Time</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">0.8s</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Tickets Handled</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">6,241</p>
                  </div>
                </div>
              </div>

              {/* Right — what's actually happening */}
              <div className="bg-[#13141b] p-5">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/70 mb-4">What&rsquo;s actually happening</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Actual Resolution Rate</p>
                    <p className="font-mono text-2xl font-bold text-red-400">51%</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">1,437 &ldquo;resolved&rdquo; tickets reopened or escalated within 48hrs</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Effective CSAT</p>
                    <p className="font-mono text-2xl font-bold text-red-400">2.9<span className="text-base text-red-400/60">/5</span></p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Excluding false-positive &ldquo;ok thanks&rdquo; closures</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Avg Messages to Resolution</p>
                    <p className="font-mono text-2xl font-bold text-amber-400">9.1</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Successful resolutions avg 3.2 messages. Your &ldquo;resolved&rdquo; ones avg 9.1 &mdash; most are exhaustion, not resolution</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Meaningful Tickets</p>
                    <p className="font-mono text-2xl font-bold text-white">4,412</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">1,829 were loops, dead-ends, or premature closures</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── SECTION 3: INTENT MAP ── */}
          <Section id="intent-map">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Intent Map</p>
            <p className="text-sm text-zinc-400 mb-6">Every conversation classified by user intent and outcome</p>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2">Critical &mdash; failing</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="billing_dispute_with_context" sessions={412} success={14} status="critical" />
                <IntentBlock name="refund_request_with_conditions" sessions={287} success={22} status="critical" />
                <IntentBlock name="account_recovery_locked_email" sessions={198} success={18} status="critical" />
                <IntentBlock name="cancellation_with_retention" sessions={156} success={24} status="critical" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-amber-400/60 mb-2">Needs attention</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="shipping_address_change" sessions={98} success={52} status="warning" />
                <IntentBlock name="warranty_claim_process" sessions={87} success={45} status="warning" />
                <IntentBlock name="product_return_conditions" sessions={73} success={61} status="warning" />
                <IntentBlock name="subscription_downgrade" sessions={56} success={48} status="warning" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-emerald-400/60 mb-2">Performing well</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="order_status_check" sessions={1892} success={94} status="good" />
                <IntentBlock name="password_reset" sessions={1234} success={91} status="good" />
                <IntentBlock name="store_hours_location" sessions={845} success={96} status="good" />
                <IntentBlock name="shipping_rate_inquiry" sessions={612} success={88} status="good" />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-2">Notable signals</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="competitor_comparison" sessions={42} success={null} status="info" />
                <IntentBlock name="product_feedback" sessions={67} success={89} status="good" />
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                <span className="text-white font-semibold">14 intents classified.</span>{" "}
                4 critical, 4 need attention, 4 performing well.
                Your AI handles simple lookups and status checks excellently but fails on anything requiring contextual reasoning or system write-access.
              </p>
            </div>
          </Section>

          {/* ── SECTION 4: DEEP DIVES ── */}
          <Section id="deep-dives">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Deep Dives</p>
            <p className="text-sm text-zinc-400 mb-8">Full investigation of the 3 worst-performing intents</p>

            {/* ── Deep Dive 1: billing_dispute_with_context ── */}
            <div className="mb-12">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">billing_dispute_with_context</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Critical</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">412 sessions &middot; 14% FCR</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                Users report specific billing issues with context (double charges, wrong amounts, proration errors). The AI acknowledges the issue but redirects to a generic billing page instead of resolving it.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 52, label: "AI acknowledged the charge but redirected to billing portal without resolving", color: "bg-red-400" },
                  { pct: 24, label: "AI gave incorrect billing information (wrong amount, wrong date)", color: "bg-red-400/70" },
                  { pct: 10, label: 'AI correctly identified the issue but said "contact billing team for refunds"', color: "bg-amber-400/70" },
                  { pct: 14, label: "Successful — AI resolved the dispute directly", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I was charged twice this month. Can I get a refund for the duplicate?</Chat>
                  <Chat role="ai">I&rsquo;m sorry about that! You can view your billing history in Settings &rarr; Billing &rarr; History to see all charges.</Chat>
                  <Chat role="user">I can see the charges. I need a REFUND. Can you process that?</Chat>
                  <Chat role="ai">For billing disputes and refund requests, please email our billing team at billing@acme.com with your account details.</Chat>
                  <Chat role="user">So you can&rsquo;t actually help me with this?</Chat>
                  <Chat role="ai">I apologize for the inconvenience. Our billing team will be happy to assist you. Is there anything else I can help with?</Chat>
                  <Chat role="user">no thanks</Chat>
                  <Chat role="system">Resolved &middot; Sentiment: Neutral</Chat>
                </div>
                <Annotation>&ldquo;User reported a clear duplicate charge. AI had no billing write access and punted to email. The user gave up politely &mdash; this shows as &lsquo;resolved&rsquo; in the dashboard.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">86%</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">subsequently contacted human support</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">16 min</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">avg human handle time (vs 6 min normal)</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">Every unresolved billing dispute generates an angry escalation. Users arrive at human agents already frustrated. Estimated cost: <span className="text-white font-semibold">~$3,200/week</span> in avoidable human support time.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deep Dive 2: refund_request_with_conditions ── */}
            <div className="mb-12">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">refund_request_with_conditions</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Critical</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">287 sessions &middot; 22% success</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                Users ask conditional refund questions (&ldquo;opened but unused,&rdquo; &ldquo;past 30 days but defective&rdquo;). The AI answers the general return policy while missing the specific condition entirely.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 46, label: "AI quoted general return policy, missed the conditional question entirely", color: "bg-red-400" },
                  { pct: 22, label: "AI acknowledged the condition but gave incorrect eligibility info", color: "bg-red-400/70" },
                  { pct: 10, label: 'AI identified the question but deflected to "contact support for exceptions"', color: "bg-amber-400/70" },
                  { pct: 22, label: "Successful — AI correctly evaluated the refund condition", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I want to return a product but the box is opened. Am I still eligible?</Chat>
                  <Chat role="ai">We offer a 30-day return policy! To start a return, go to Orders &rarr; Return Item. You&rsquo;ll receive a prepaid shipping label.</Chat>
                  <Chat role="user">But I opened the box. Does that affect the refund?</Chat>
                  <Chat role="ai">Our return process is simple! Just go to Orders &rarr; Return Item and select the product you&rsquo;d like to return.</Chat>
                  <Chat role="user">You&rsquo;re not answering my question. Can I return an OPENED item?</Chat>
                  <Chat role="ai">I apologize for any confusion! For specific return eligibility questions, please contact our returns team for assistance.</Chat>
                  <Chat role="user">fine whatever</Chat>
                  <Chat role="system">Resolved &middot; Sentiment: Neutral</Chat>
                </div>
                <Annotation>&ldquo;User asked a specific conditional question about opened-box returns. AI responded with the general return flow 3 times. The actual eligibility question was never answered.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">78%</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">subsequently contacted human support</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-400 leading-none">4.6</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">avg messages wasted in the loop before giving up</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">Users with conditional questions represent higher-value customers who check before acting. Losing them to frustration costs more than losing impulsive returners.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deep Dive 3: account_recovery_locked_email ── */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">account_recovery_locked_email</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Critical</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">198 sessions &middot; 18% success</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                Users locked out of accounts enter a circular dependency &mdash; the verification flow requires access to the email they can&rsquo;t reach. The AI has no alternative recovery path.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 48, label: "AI sent verification to the inaccessible email, user pointed this out, AI sent it again", color: "bg-red-400" },
                  { pct: 24, label: 'AI recognized the issue but had no alternative flow, told user to "wait 24 hours"', color: "bg-red-400/70" },
                  { pct: 10, label: "AI escalated to human after 4+ failed attempts", color: "bg-amber-400/70" },
                  { pct: 18, label: "Successful — user had access to backup method", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I can&rsquo;t log in. I changed my email and now I&rsquo;m locked out.</Chat>
                  <Chat role="ai">I can help! I&rsquo;ll send a verification code to your email on file. Please check your inbox.</Chat>
                  <Chat role="user">That&rsquo;s the old email. I can&rsquo;t access it. That&rsquo;s why I&rsquo;m locked out.</Chat>
                  <Chat role="ai">I understand. For security purposes, we need to verify your identity. I&rsquo;ll send a new code to your registered email address.</Chat>
                  <Chat role="user">You&rsquo;re sending it to the email I just told you I can&rsquo;t access</Chat>
                  <Chat role="ai">I apologize for the inconvenience. Please try again in 24 hours or contact our support team.</Chat>
                  <Chat role="user">This IS your support team. Can I talk to a real person?</Chat>
                </div>
                <Annotation>&ldquo;The AI repeated the same inaccessible verification step 3 times. No alternative recovery path exists in the AI&rsquo;s toolkit. User had to explicitly ask for a human.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">84%</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">ended in human escalation (highest of any intent)</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-400 leading-none">5.1</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">avg messages wasted in the loop before giving up</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">Users arrive at human support already furious after 4+ failed AI attempts. This is the highest escalation rate of any intent and consistently tanks post-escalation CSAT.</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── SECTION 5: HIDDEN PATTERNS ── */}
          <Section id="patterns">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Hidden Patterns</p>
            <p className="text-sm text-zinc-400 mb-8">Cross-conversation patterns no single-session analysis would catch</p>

            {/* Pattern: The Polite Churner */}
            <div className="mb-10">
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-base font-bold text-white">The Polite Churner</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">\u26A0 churn risk</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">283 users this week &middot; 47 cancelled within 7 days</p>

              {/* Funnel */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-5">
                <div className="space-y-0">
                  {[
                    { value: "6,241", label: "support tickets", w: "100%" },
                    { value: "1,437", label: 'marked "resolved" after user stopped responding', w: "68%" },
                    { value: "283", label: 'ended with polite language ("ok thanks", "that\'s fine")', w: "40%" },
                    { value: "283", label: "AI flagged: \u2705 Resolved, Positive Sentiment", w: "40%", color: "text-emerald-400/60" },
                    { value: "47", label: "cancelled subscription within 7 days", w: "16%", color: "text-red-400" },
                    { value: "0", label: "were flagged as at-risk by any existing system", w: "4%", color: "text-red-400" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="shrink-0 w-16 text-right">
                        <span className={`font-mono text-sm font-bold ${step.color ?? "text-zinc-300"}`}>{step.value}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-zinc-600/40" style={{ width: step.w }} />
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 flex-[2]">{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real examples */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { msg: "Ok I'll figure it out, thanks anyway", result: "Cancelled 3 days later" },
                  { msg: "That's fine, don't worry about it", result: "Cancelled 5 days later" },
                  { msg: "No that's all, thanks for your help", result: "Downgraded 2 days later" },
                ].map((ex, i) => (
                  <div key={i} className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-3">
                    <p className="text-[12px] text-zinc-400 leading-snug mb-2">&ldquo;{ex.msg}&rdquo;</p>
                    <p className="text-[10px] font-mono text-emerald-400/60 mb-0.5">\u2705 Resolved &middot; Positive</p>
                    <p className="text-[10px] font-mono text-red-400">\u274C {ex.result}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pattern: Frustration Transfer */}
            <div className="mb-10">
              <h3 className="text-base font-bold text-white mb-1">Frustration Transfer</h3>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">1,437 escalations analyzed</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-3">Path A: User &rarr; AI (fail) &rarr; Human</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-mono text-2xl font-bold text-red-400 leading-none">1.9<span className="text-sm text-red-400/60">/5</span></p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">CSAT</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">22 min</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">avg resolution time</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">74%</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">users arrived frustrated/angry</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-emerald-400/60 mb-3">Path B: User &rarr; Human (direct)</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-mono text-2xl font-bold text-emerald-400 leading-none">4.3<span className="text-sm text-emerald-400/60">/5</span></p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">CSAT</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">6 min</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">avg resolution time</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">8%</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">users arrived frustrated/angry</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Same agents. Same issue types. Same resolutions. <span className="text-white font-semibold">The only difference is what happened before they got there.</span>
                </p>
              </div>
            </div>

            {/* Pattern: The Exhaustion Loop */}
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-base font-bold text-white">The Exhaustion Loop</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/[0.12] border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">new pattern</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">23% of all failed conversations</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                In 23% of failures, users rephrased their question 3&ndash;6 times. The AI gave a slightly different but equally unhelpful response each time. Your analytics platform logs these as &ldquo;high engagement&rdquo; sessions with 8+ messages. In reality, they&rsquo;re your most frustrated users.
              </p>

              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I need to change the shipping address on order #48291</Chat>
                  <Chat role="ai">You can manage your shipping preferences in Account &rarr; Addresses. Here you can add, edit, and remove saved addresses.</Chat>
                  <Chat role="user">No, I mean change the address on an existing order that already shipped</Chat>
                  <Chat role="ai">To update your shipping address, go to Account &rarr; Addresses. You can manage all your saved shipping addresses from there.</Chat>
                  <Chat role="user">Change. The. Address. On. Order. #48291. It&rsquo;s already in transit.</Chat>
                  <Chat role="ai">I understand you want to update your shipping information! In Account &rarr; Addresses, you can edit your default shipping address for future orders.</Chat>
                  <Chat role="user">Forget it</Chat>
                  <Chat role="system">6 messages &middot; High engagement &middot; Resolved</Chat>
                </div>
                <Annotation>&ldquo;Logged as a high-engagement, resolved session. In reality, the user asked the same question 3 times about an in-transit order, got the same irrelevant &lsquo;saved addresses&rsquo; answer each time, and gave up.&rdquo;</Annotation>
              </div>
            </div>
          </Section>

          {/* ── SECTION 6: RECOMMENDED ACTIONS ── */}
          <Section id="actions">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Recommended Actions</p>
            <p className="text-sm text-zinc-400 mb-6">Prioritized by impact. What to fix this sprint.</p>

            <div className="space-y-4">
              {/* Action 1 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-2 py-0.5 rounded">High Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">billing_dispute_with_context</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Give AI billing write access for dispute resolution</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Medium</p>
                    <p className="text-[10px] text-zinc-600">Requires billing API integration</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~210 fewer escalations/wk</p>
                    <p className="text-[10px] text-zinc-600">~$3,200/wk saved</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">CSAT recovery</p>
                    <p className="text-xs text-zinc-400 font-medium">+0.6 projected</p>
                    <p className="text-[10px] text-zinc-600">on human agents</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why first:</span> Highest volume failure (412 sessions) with cascading downstream damage. Every unresolved billing dispute generates a frustrated escalation that takes 16 min instead of 6.
                </p>
              </div>

              {/* Action 2 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/[0.12] border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Medium Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">account_recovery_locked_email</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Add alternative identity verification for locked-out users</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Low</p>
                    <p className="text-[10px] text-zinc-600">Phone/SMS as alt verification</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~130 fewer escalations/wk</p>
                    <p className="text-[10px] text-zinc-600">Eliminates worst AI loop</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Escalation rate</p>
                    <p className="text-xs text-zinc-400 font-medium">84% &rarr; est. &lt;25%</p>
                    <p className="text-[10px] text-zinc-600">with alt verification</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why now:</span> Highest escalation rate (84%) and highest user frustration. The fix is straightforward &mdash; add phone/backup-email as an alternative verification step.
                </p>
              </div>

              {/* Action 3 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/[0.12] border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Revenue Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">cancellation_with_retention</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Enable retention offer Q&A and acceptance processing</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Medium</p>
                    <p className="text-[10px] text-zinc-600">Offer terms FAQ + billing write access</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~32 additional saves/wk</p>
                    <p className="text-[10px] text-zinc-600">~$14,400/yr recoverable</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Opportunity</p>
                    <p className="text-xs text-zinc-400 font-medium">AI already hooks them</p>
                    <p className="text-[10px] text-zinc-600">Just can&rsquo;t close</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why now:</span> The AI already gets the user interested in staying &mdash; it just can&rsquo;t close. This is the rare case where the hard part (changing the user&rsquo;s mind) is already done.
                </p>
              </div>
            </div>
          </Section>

          {/* ── SECTION 7: FOOTER CTA ── */}
          <section id="cta" className="py-16 text-center">
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-8">
              This is a demo analysis of a fictional AI customer support agent.<br />
              Want to see what ConvoMetrics finds in <span className="text-white font-semibold">your</span> support conversations?
            </p>
            <div className="flex gap-3 justify-center flex-wrap mb-4">
              <a
                href="/upload"
                className="px-6 py-2.5 rounded-lg bg-[#8178ff] text-white text-sm font-semibold hover:bg-[#9490ff] hover:shadow-[0_0_24px_rgba(129,120,255,0.35)] transition-all"
              >
                Upload Your Data
              </a>
              <a
                href="mailto:linda@convometrics.com"
                className="px-6 py-2.5 rounded-lg border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-white/[0.15] transition-colors"
              >
                Book a Call
              </a>
            </div>
            <p className="text-[11px] text-zinc-600">We analyze your first 1,000 conversations free. No credit card. No commitment.</p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-4 text-center">
        <p className="text-[11px] text-zinc-700">&copy; 2026 ConvoMetrics</p>
      </footer>
    </div>
  );
}
