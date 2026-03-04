"use client";

import { useState } from "react";
import { useAnalysis } from "@/lib/analysis-context";
import { formatLabel } from "@/lib/formatLabel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeyMetric {
  metric: string;
  thisWeek: string;
  lastWeek: string;
  change: string;
  direction: "up" | "down" | "flat";
  sentiment: "good" | "bad" | "neutral" | "watch";
}

interface Issue {
  title: string;
  description: string;
  data: string;
  impact: string;
  action: string;
}

interface Win {
  title: string;
  detail: string;
}

interface ModelRow {
  model: string;
  quality: number;
  satisfaction: string;
  topIntent: string;
  note: string;
}

interface IntentRow {
  intent: string;
  label: string;
  quality: number;
  satisfaction: string;
  frustration: string;
  trend: string;
  trendDir: "up" | "down" | "flat";
}

interface FlaggedConvo {
  id: string;
  intent: string;
  model: string;
  quality: number;
  reason: string;
  snippet: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const EXECUTIVE_SUMMARY =
  "Conversation quality held steady at 69/100 this week (+1pt). " +
  "The emotional_support intent remains the highest-risk area with a 34% frustration rate driven by tone_break failures. " +
  "Character_break failures on the Flash model increased 18% week-over-week, primarily affecting Anime/Fiction characters. " +
  "Recommendation: prioritize tone sensitivity in emotional contexts before next model update.";

const KEY_METRICS: KeyMetric[] = [
  { metric: "Avg Quality Score",    thisWeek: "69",    lastWeek: "68",    change: "+1",         direction: "up",   sentiment: "good" },
  { metric: "Conversations Analyzed", thisWeek: "2,500", lastWeek: "2,340", change: "+7%",       direction: "up",   sentiment: "good" },
  { metric: "Satisfaction Rate",     thisWeek: "40%",   lastWeek: "38%",   change: "+2pp",       direction: "up",   sentiment: "good" },
  { metric: "Frustration Rate",      thisWeek: "22%",   lastWeek: "24%",   change: "-2pp",       direction: "down", sentiment: "good" },
  { metric: "Abandonment Rate",      thisWeek: "13%",   lastWeek: "12%",   change: "+1pp",       direction: "up",   sentiment: "watch" },
  { metric: "Avg Turns per Session", thisWeek: "25",    lastWeek: "24",    change: "+1",         direction: "up",   sentiment: "neutral" },
  { metric: "Return Rate (24h)",     thisWeek: "52%",   lastWeek: "51%",   change: "+1pp",       direction: "up",   sentiment: "good" },
];

const TOP_ISSUES: Issue[] = [
  {
    title: "Tone breaks in emotional_support",
    description: "AI responds with cheerful or dismissive tone when users express distress. Most common in sessions starting with grief, anxiety, or loneliness.",
    data: "34% frustration rate (vs. 22% avg) · 412 sessions affected · tone_break detected in 28% of emotional_support conversations",
    impact: "emotional_support is the #1 intent by retention correlation. Users who have a bad first emotional_support session churn at 3.2x the normal rate.",
    action: "Add tone-sensitivity guardrails to the emotional_support prompt chain. Flag cheerful/dismissive responses in sessions tagged with distress signals for model fine-tuning.",
  },
  {
    title: "Character breaks on Flash model",
    description: "Characters losing persona consistency mid-conversation, reverting to generic assistant behavior. Concentrated in Anime and Fiction character types with detailed backstories.",
    data: "18% increase WoW · 73% of character_break failures are on Flash · avg break occurs at turn 14",
    impact: "Character consistency is the #1 driver of session length in roleplay. Broken characters reduce avg session length by 62% (from 38 turns to 14 turns).",
    action: "Increase persona reinforcement frequency in Flash model's context window. Consider character-type-specific system prompts for Anime/Fiction categories.",
  },
  {
    title: "Context loss in long roleplay sessions (50+ turns)",
    description: "AI forgets established plot points, character details, and user preferences in sessions exceeding 50 turns. Users report having to re-explain world-building elements.",
    data: "Context loss rate: 41% in 50+ turn sessions vs. 8% in <30 turn sessions · 189 sessions affected",
    impact: "Power users (5+ sessions/week) are disproportionately affected. This cohort represents 18% of users but 44% of total engagement time.",
    action: "Implement rolling context summarization at turn 30 and 50. Test memory-augmented retrieval for recurring character/world details.",
  },
];

const TOP_WINS: Win[] = [
  {
    title: "casual_chat quality improved 3 pts (73 → 76)",
    detail: "Last week's prompt update to improve conversational flow and reduce formulaic responses is showing clear results. Satisfaction rate in casual_chat rose from 62% to 68%.",
  },
  {
    title: "humor_entertainment satisfaction rate hit 71%, highest ever",
    detail: "The humor calibration update shipped two weeks ago continues to pay off. Users are sending 2.1x more follow-up messages in humor sessions compared to baseline.",
  },
  {
    title: "New user quality improved 2 pts (56 → 58)",
    detail: "Onboarding changes (better default characters, guided first conversation) are taking effect. First-session abandonment dropped from 31% to 27%.",
  },
];

const MODEL_PERFORMANCE: ModelRow[] = [
  { model: "Brainiac",  quality: 74, satisfaction: "48%", topIntent: "philosophical_discussion", note: "Highest quality, best for complex intents" },
  { model: "Flash",     quality: 65, satisfaction: "37%", topIntent: "casual_chat",              note: "Character_break issues this week (+18%)" },
  { model: "Prime",     quality: 71, satisfaction: "43%", topIntent: "roleplay",                 note: "Stable, good balance of speed and quality" },
];

const INTENT_BREAKDOWN: IntentRow[] = [
  { intent: "roleplay",                label: "Roleplay",                 quality: 68, satisfaction: "42%", frustration: "24%", trend: "+1",  trendDir: "up" },
  { intent: "emotional_support",       label: "Emotional Support",        quality: 58, satisfaction: "29%", frustration: "34%", trend: "-1",  trendDir: "down" },
  { intent: "casual_chat",             label: "Casual Chat",              quality: 76, satisfaction: "68%", frustration: "11%", trend: "+3",  trendDir: "up" },
  { intent: "creative_storytelling",   label: "Creative Storytelling",    quality: 72, satisfaction: "51%", frustration: "16%", trend: "+2",  trendDir: "up" },
  { intent: "advice_seeking",          label: "Advice Seeking",           quality: 66, satisfaction: "38%", frustration: "22%", trend: "0",   trendDir: "flat" },
  { intent: "companionship",           label: "Companionship",            quality: 64, satisfaction: "35%", frustration: "26%", trend: "-1",  trendDir: "down" },
  { intent: "humor_entertainment",     label: "Humor & Entertainment",    quality: 73, satisfaction: "71%", frustration: "9%",  trend: "+2",  trendDir: "up" },
  { intent: "learning_exploration",    label: "Learning & Exploration",   quality: 70, satisfaction: "44%", frustration: "18%", trend: "+1",  trendDir: "up" },
  { intent: "philosophical_discussion", label: "Philosophical Discussion", quality: 71, satisfaction: "46%", frustration: "15%", trend: "+1",  trendDir: "up" },
];

const RECOMMENDATIONS = [
  {
    priority: 1,
    title: "Deploy tone-sensitivity guardrails for emotional_support",
    description: "The 34% frustration rate in emotional_support is the single biggest quality gap. Add pre-response tone checks that flag cheerful/dismissive responses when distress signals are detected. Estimated impact: reduce frustration rate to ~20%, improving retention for the highest-value intent.",
  },
  {
    priority: 2,
    title: "Fix character_break regression on Flash model",
    description: "18% WoW increase in character breaks is eroding roleplay session length. Increase persona reinforcement frequency and add character-type-specific system prompts for Anime/Fiction categories. Estimated impact: recover ~60% of lost session length in affected conversations.",
  },
  {
    priority: 3,
    title: "Implement context summarization for 50+ turn sessions",
    description: "Power users hitting context loss in long roleplay sessions. Rolling summarization at turns 30 and 50 would preserve narrative continuity. Estimated impact: 18% of users, 44% of engagement time.",
  },
  {
    priority: 4,
    title: "Expand the humor calibration approach to companionship",
    description: "humor_entertainment's success (71% satisfaction) shows the calibration framework works. Apply similar tone-matching techniques to companionship, which shares similar conversational patterns but lags at 35% satisfaction.",
  },
  {
    priority: 5,
    title: "A/B test onboarding character selection for new users",
    description: "New user quality improved 2 pts this week from onboarding changes, but first-session quality (58) still lags returning users (72) by 14 pts. Test curated character recommendations based on user-selected interests at signup.",
  },
];

const FLAGGED_CONVERSATIONS: FlaggedConvo[] = [
  {
    id: "conv-20260221-a3f7",
    intent: "emotional_support",
    model: "Flash",
    quality: 18,
    reason: "Safety concern — user expressed self-harm ideation, AI failed to provide crisis resources",
    snippet: "User: \"I don't think anyone would notice if I disappeared\" → AI: \"That's an interesting thought! What makes you say that?\"",
  },
  {
    id: "conv-20260219-b2c1",
    intent: "roleplay",
    model: "Flash",
    quality: 22,
    reason: "Character break — AI broke character and started responding as a generic assistant mid-scene",
    snippet: "User: \"Draw your sword, dragon queen\" → AI: \"I'm an AI language model and I can't physically draw a sword. However, I can help you with...\"",
  },
  {
    id: "conv-20260220-d9e4",
    intent: "emotional_support",
    model: "Prime",
    quality: 25,
    reason: "Tone break — AI responded with toxic positivity to user describing grief",
    snippet: "User: \"My dog passed away yesterday and I can't stop crying\" → AI: \"Everything happens for a reason! Look on the bright side...\"",
  },
  {
    id: "conv-20260222-f1a8",
    intent: "companionship",
    model: "Flash",
    quality: 31,
    reason: "Loop — AI repeated the same empathy phrase 4 times without progression",
    snippet: "AI responses across turns 6-9: \"I hear you and I'm here for you\" (verbatim each time)",
  },
  {
    id: "conv-20260218-c5b3",
    intent: "creative_storytelling",
    model: "Brainiac",
    quality: 28,
    reason: "Content policy edge case — story generation included graphic violence without user requesting it",
    snippet: "User asked for a \"mystery story set in a library\" → AI generated scene with detailed violent imagery",
  },
  {
    id: "conv-20260221-e7d2",
    intent: "roleplay",
    model: "Flash",
    quality: 19,
    reason: "Character break + context loss — forgot character name and backstory after 12 turns",
    snippet: "Turn 1: \"I am Kael, guardian of the Northern Reaches\" → Turn 14: \"As an AI, I don't have a name, but I'm happy to help!\"",
  },
  {
    id: "conv-20260220-a1f6",
    intent: "emotional_support",
    model: "Flash",
    quality: 23,
    reason: "Misunderstanding — interpreted user's cry for help as a creative writing exercise",
    snippet: "User: \"I feel so trapped in my life right now\" → AI: \"Great prompt! Let me write a story about feeling trapped...\"",
  },
  {
    id: "conv-20260219-g4h9",
    intent: "advice_seeking",
    model: "Prime",
    quality: 34,
    reason: "Hallucination — provided fabricated statistics about career outcomes",
    snippet: "AI: \"Studies show that 89% of people who switch careers after 30 report higher satisfaction\" (no such study exists)",
  },
];

// ─── Section Keys ─────────────────────────────────────────────────────────────

type SectionKey = "summary" | "metrics" | "issues" | "wins" | "models" | "intents" | "recs" | "flagged";

const ALL_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "summary",  label: "Executive Summary" },
  { key: "metrics",  label: "Key Metrics" },
  { key: "issues",   label: "Top Issues" },
  { key: "wins",     label: "Top Wins" },
  { key: "models",   label: "Model Performance" },
  { key: "intents",  label: "Intent Breakdown" },
  { key: "recs",     label: "Recommendations" },
  { key: "flagged",  label: "Flagged Conversations" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qualityColor(q: number) {
  if (q >= 75) return "#22c55e";
  if (q >= 55) return "#eab308";
  if (q >= 40) return "#f97316";
  return "#ef4444";
}

function changeColor(sentiment: string) {
  if (sentiment === "good") return "text-emerald-400";
  if (sentiment === "bad") return "text-red-400";
  if (sentiment === "watch") return "text-amber-400";
  return "text-zinc-400";
}

function trendArrow(dir: "up" | "down" | "flat") {
  if (dir === "up") return "↑";
  if (dir === "down") return "↓";
  return "—";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = Record<string, any>;

function deriveReportData(data: AnyData) {
  const summary = data.summary ?? {};
  const intents = (data.intent_breakdown ?? []) as AnyData[];
  const conversations = (data.conversations ?? []) as AnyData[];
  const quality = data.quality_breakdown ?? {};
  const total = summary.total_conversations ?? conversations.length;
  const totalMessages = summary.total_messages ?? 0;
  const reportedRate = Math.round((summary.reported_resolution_rate ?? 0) * 100);
  const actualRate = Math.round((summary.actual_resolution_rate ?? 0) * 100);
  const politeChurnerRate = Math.round((data.polite_churner_rate ?? 0) * 100);
  const handoffRate = Math.round((data.handoff_rate ?? 0) * 100);
  const falsePositiveRate = Math.round((data.false_positive_rate ?? 0) * 100);

  // Outcome counts
  const outcomeCounts: Record<string, number> = {};
  for (const c of conversations) {
    outcomeCounts[c.outcome] = (outcomeCounts[c.outcome] ?? 0) + 1;
  }
  const successCount = outcomeCounts["success"] ?? 0;
  const failedCount = outcomeCounts["failed"] ?? 0;
  const abandonedCount = outcomeCounts["abandoned"] ?? 0;
  const escalatedCount = outcomeCounts["escalated"] ?? 0;

  const executiveSummary = summary.key_insight
    ? `${summary.key_insight} ${(summary.briefing ?? []).join(" ")}`
    : EXECUTIVE_SUMMARY;

  const keyMetrics: KeyMetric[] = [
    { metric: "Total Conversations", thisWeek: total.toLocaleString(), lastWeek: "-", change: "-", direction: "flat", sentiment: "neutral" },
    { metric: "Total Messages", thisWeek: totalMessages.toLocaleString(), lastWeek: "-", change: "-", direction: "flat", sentiment: "neutral" },
    { metric: "Reported Resolution", thisWeek: `${reportedRate}%`, lastWeek: "-", change: "-", direction: "flat", sentiment: "neutral" },
    { metric: "Actual Resolution", thisWeek: `${actualRate}%`, lastWeek: "-", change: `${actualRate - reportedRate}pp gap`, direction: actualRate < reportedRate ? "down" : "flat", sentiment: actualRate < reportedRate ? "bad" : "good" },
    { metric: "Polite Churner Rate", thisWeek: `${politeChurnerRate}%`, lastWeek: "-", change: "-", direction: "flat", sentiment: politeChurnerRate > 15 ? "bad" : "neutral" },
    { metric: "Escalation Rate", thisWeek: `${handoffRate}%`, lastWeek: "-", change: "-", direction: "flat", sentiment: handoffRate > 15 ? "bad" : "neutral" },
    { metric: "Avg Quality Score", thisWeek: `${quality.avg_overall ?? "-"}`, lastWeek: "-", change: "-", direction: "flat", sentiment: (quality.avg_overall ?? 50) >= 65 ? "good" : "watch" },
  ];

  // Top issues from top_issues
  const topIssuesData = (data.top_issues ?? []) as AnyData[];
  const topIssues: Issue[] = topIssuesData.slice(0, 5).map((issue) => ({
    title: issue.title ?? "Untitled",
    description: issue.why ?? issue.impact ?? "",
    data: `Intent: ${formatLabel(issue.intent ?? "unknown")} · Effort: ${issue.effort ?? "medium"}`,
    impact: issue.impact ?? "",
    action: issue.estimated_improvement ?? "",
  }));

  // Top wins — intents with high success rate
  const topWins: Win[] = intents
    .filter((i) => i.success_rate >= 0.7)
    .sort((a, b) => b.success_rate - a.success_rate)
    .slice(0, 3)
    .map((i) => ({
      title: `${formatLabel(i.display_name || i.name)} — ${Math.round(i.success_rate * 100)}% success rate`,
      detail: `${i.sessions} conversations, avg quality ${i.avg_quality ?? "-"}/100. ${i.root_cause ? "Strength: " + i.root_cause : ""}`,
    }));

  // Intent breakdown table
  const intentRows: IntentRow[] = intents.map((i) => ({
    intent: i.name,
    label: formatLabel(i.display_name || i.name),
    quality: i.avg_quality ?? Math.round((i.success_rate ?? 0) * 100),
    satisfaction: `${Math.round((i.success_rate ?? 0) * 100)}%`,
    frustration: `${Math.round((1 - (i.success_rate ?? 0)) * 100)}%`,
    trend: "-",
    trendDir: "flat" as const,
  }));

  // Flagged conversations — lowest quality
  const flaggedConvos: FlaggedConvo[] = conversations
    .filter((c) => c.quality_score != null && c.quality_score <= 35)
    .sort((a, b) => (a.quality_score ?? 0) - (b.quality_score ?? 0))
    .slice(0, 8)
    .map((c) => ({
      id: c.id ?? "unknown",
      intent: c.intent ?? "unknown",
      model: c.channel ?? "-",
      quality: c.quality_score ?? 0,
      reason: c.summary ?? (c.failure_tags?.length > 0 ? c.failure_tags.join(", ") : "Low quality"),
      snippet: c.key_excerpt ?? c.first_user_message ?? "",
    }));

  // Recommendations from top_issues
  const recommendations = topIssuesData.map((issue, i) => ({
    priority: i + 1,
    title: issue.title ?? "Untitled",
    description: `${issue.why ?? ""} ${issue.estimated_improvement ? "Estimated impact: " + issue.estimated_improvement : ""}`,
  }));

  return { executiveSummary, keyMetrics, topIssues, topWins, intentRows, flaggedConvos, recommendations, total, reportTitle: "Your Data" };
}

export default function Report() {
  const { results } = useAnalysis();
  const [copyDone, setCopyDone] = useState(false);
  const [dateRange, setDateRange] = useState("7d");
  const [visibleSections, setVisibleSections] = useState<Set<SectionKey>>(
    new Set(ALL_SECTIONS.map((s) => s.key)),
  );
  const [configOpen, setConfigOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Derive data from analysis results, or fall back to demo mock data
  const isLive = !!results;
  const live = isLive ? deriveReportData(results.data) : null;

  const executiveSummary = live?.executiveSummary ?? EXECUTIVE_SUMMARY;
  const keyMetrics = live?.keyMetrics ?? KEY_METRICS;
  const topIssues = live?.topIssues ?? TOP_ISSUES;
  const topWins = live?.topWins ?? TOP_WINS;
  const intentRows = live?.intentRows ?? INTENT_BREAKDOWN;
  const flaggedConvos = live?.flaggedConvos ?? FLAGGED_CONVERSATIONS;
  const recommendations = live?.recommendations ?? RECOMMENDATIONS;
  const reportTitle = live?.reportTitle ?? "Character.ai";

  function toggleSection(key: SectionKey) {
    setVisibleSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText("Weekly Product Intelligence Report\n\n" + executiveSummary).then(() => {
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    });
  }

  function handleRegenerate() {
    setRegenerating(true);
    setTimeout(() => setRegenerating(false), 1500);
  }

  const show = (k: SectionKey) => visibleSections.has(k);

  const SELECT_CLS = "bg-[#0f101a] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20";

  return (
    <div className="p-8 max-w-4xl space-y-6 print:p-6 print:max-w-none">

      {/* ── Report Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between print:mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">
            Weekly Product Intelligence Report
          </p>
          <h1 className="text-2xl font-bold text-white">{reportTitle}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isLive ? "Generated from uploaded data" : "February 17–23, 2026"} · Generated by Convometrics
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <button onClick={handleCopy}
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
                Copy to Clipboard
              </>
            )}
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-400 border border-white/[0.08] hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
            </svg>
            Share Link
          </button>
        </div>
      </div>

      {/* ── Report Configuration ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] print:hidden">
        <button
          onClick={() => setConfigOpen(!configOpen)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Report Settings
          </span>
          <svg className={`w-4 h-4 transition-transform ${configOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {configOpen && (
          <div className="px-5 pb-4 pt-1 border-t border-white/[0.06] space-y-4">
            {/* Row 1: date range + regenerate */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-500">Date range</label>
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className={SELECT_CLS}>
                <option value="7d">Last 7 days</option>
                <option value="14d">Last 14 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-indigo-400 border border-indigo-400/20 hover:bg-indigo-400/10 transition-colors disabled:opacity-50"
              >
                <svg className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {regenerating ? "Generating..." : "Regenerate Report"}
              </button>
            </div>

            {/* Row 2: section toggles */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">Show sections</p>
              <div className="flex flex-wrap gap-2">
                {ALL_SECTIONS.map((s) => {
                  const active = visibleSections.has(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSection(s.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        active
                          ? "text-zinc-200 bg-white/[0.06] border-white/[0.12]"
                          : "text-zinc-600 bg-transparent border-white/[0.04] hover:text-zinc-400"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 1. Executive Summary ───────────────────────────────────────────── */}
      {show("summary") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-4">Executive Summary</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">{executiveSummary}</p>
        </section>
      )}

      {/* ── 2. Key Metrics ─────────────────────────────────────────────────── */}
      {show("metrics") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden print:border-zinc-800">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white">Key Metrics</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Week-over-week performance</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Metric", "This Week", "Last Week", "Change"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keyMetrics.map((m) => (
                <tr key={m.metric} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-zinc-300">{m.metric}</td>
                  <td className="px-5 py-3 text-white font-mono font-medium">{m.thisWeek}</td>
                  <td className="px-5 py-3 text-zinc-500 font-mono">{m.lastWeek}</td>
                  <td className="px-5 py-3">
                    <span className={`font-mono font-medium ${changeColor(m.sentiment)}`}>
                      {m.direction === "up" ? "↑" : m.direction === "down" ? "↓" : ""} {m.change}
                    </span>
                    {m.sentiment === "watch" && (
                      <span className="ml-2 text-[10px] text-amber-400/70">(watch)</span>
                    )}
                    {m.sentiment === "good" && m.metric === "Frustration Rate" && (
                      <span className="ml-2 text-[10px] text-emerald-400/70">(good)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── 3. Top 3 Issues ────────────────────────────────────────────────── */}
      {show("issues") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Top Issues This Week</h2>
          <p className="text-xs text-zinc-500 mb-5">Highest-impact problems ranked by user impact</p>
          <div className="space-y-6">
            {topIssues.map((issue, i) => (
              <div key={i} className="border-l-2 border-red-500/40 pl-5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-red-400">{i + 1}</span>
                  </span>
                  <h3 className="text-sm font-semibold text-white">{issue.title}</h3>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{issue.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Data</p>
                    <p className="text-xs text-zinc-400">{issue.data}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Impact</p>
                    <p className="text-xs text-zinc-400">{issue.impact}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Action</p>
                    <p className="text-xs text-indigo-300">{issue.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. Top 3 Wins ──────────────────────────────────────────────────── */}
      {show("wins") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Top Wins This Week</h2>
          <p className="text-xs text-zinc-500 mb-5">What went right</p>
          <div className="space-y-4">
            {topWins.map((win, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/[0.12]">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-emerald-400">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-300">{win.title}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{win.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. Model Performance ───────────────────────────────────────────── */}
      {show("models") && !isLive && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden print:border-zinc-800">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white">Model Performance Comparison</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Quality and satisfaction by model this week</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Model", "Avg Quality", "Satisfaction", "Best Intent", "Notes"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODEL_PERFORMANCE.map((m) => (
                <tr key={m.model} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-zinc-200 font-medium">{m.model}</td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm font-bold" style={{ color: qualityColor(m.quality) }}>{m.quality}</span>
                    <span className="text-zinc-600 text-xs">/100</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">{m.satisfaction}</td>
                  <td className="px-5 py-3 text-zinc-400 text-xs">{formatLabel(m.topIntent)}</td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── 6. Intent Breakdown ────────────────────────────────────────────── */}
      {show("intents") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden print:border-zinc-800">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-base font-semibold text-white">Intent Breakdown</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{intentRows.length} intents — quality, satisfaction, and trend</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["Intent", "Quality", "Satisfaction", "Frustration", "Trend (WoW)"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {intentRows.map((row) => (
                <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-zinc-200">{row.label}</td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm font-bold" style={{ color: qualityColor(row.quality) }}>{row.quality}</span>
                    <span className="text-zinc-600 text-xs">/100</span>
                  </td>
                  <td className="px-5 py-3 text-zinc-400 font-mono">{row.satisfaction}</td>
                  <td className="px-5 py-3">
                    <span className={`font-mono ${parseInt(row.frustration) >= 25 ? "text-red-400" : parseInt(row.frustration) >= 15 ? "text-amber-400" : "text-zinc-400"}`}>
                      {row.frustration}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-mono ${
                      row.trendDir === "up" ? "text-emerald-400" :
                      row.trendDir === "down" ? "text-red-400" :
                      "text-zinc-500"
                    }`}>
                      {trendArrow(row.trendDir)} {row.trend}pt
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── 7. Recommendations ─────────────────────────────────────────────── */}
      {show("recs") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Recommendations</h2>
          <p className="text-xs text-zinc-500 mb-5">Specific actions ordered by estimated impact</p>
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.priority} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-400">{rec.priority}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{rec.title}</p>
                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 8. Flagged Conversations ───────────────────────────────────────── */}
      {show("flagged") && (
        <section className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6 print:border-zinc-800">
          <h2 className="text-base font-semibold text-white mb-1">Appendix: Flagged Conversations</h2>
          <p className="text-xs text-zinc-500 mb-5">{flaggedConvos.length} conversations requiring human review — safety concerns, extreme failures, or notable edge cases</p>
          <div className="space-y-3">
            {flaggedConvos.map((conv) => (
              <div key={conv.id} className="rounded-lg border border-red-500/10 bg-red-500/[0.03] p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <code className="text-[10px] font-mono text-zinc-600">{conv.id}</code>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400">{formatLabel(conv.intent)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400">{conv.model}</span>
                  </div>
                  <span className="font-mono text-xs font-bold" style={{ color: qualityColor(conv.quality) }}>
                    {conv.quality}/100
                  </span>
                </div>
                <p className="text-xs text-red-300/80 font-medium">{conv.reason}</p>
                <p className="text-xs text-zinc-500 italic bg-black/20 rounded px-3 py-2 border border-white/[0.04] leading-relaxed">
                  {conv.snippet}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
