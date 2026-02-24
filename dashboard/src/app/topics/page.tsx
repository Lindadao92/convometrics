"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Treemap, ResponsiveContainer, LineChart, Line, CartesianGrid,
  XAxis, YAxis, Tooltip,
} from "recharts";
import { useProductProfile } from "@/lib/product-profile-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import { FAILURE_TYPES } from "@/lib/mockQualityData";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicSummary {
  label: string; count: number; avgQuality: number | null;
  failureRate: number; completionRate: number; avgTurns: number | null;
  topPlatform: string | null; firstSeen: string | null; isEmerging: boolean;
  estRevenueImpact?: number | null;
}
interface PlatformBreakdown { platform: string; count: number; pct: number; }
interface ClusterData {
  id: string; clusterName: string; conversationCount: number;
  avgQuality: number | null; avgTurns: number | null; failureRate: number;
  platformBreakdown: PlatformBreakdown[]; topics: TopicSummary[]; color?: string | null;
}
interface EmergingTopic {
  label: string; count: number; clusterName: string | null;
  firstSeen: string; avgQuality: number | null;
}
interface UnclusteredIntent { label: string; count: number; avgQuality: number | null; failureRate: number; estRevenueImpact?: number; }
interface TopicInsights {
  mostDiscussed: { name: string; count: number } | null;
  biggestQualityGap: { label: string; count: number; avgQuality: number } | null;
  fastestGrowing: { label: string; count: number; clusterName: string | null } | null;
  platformSpecialization: { platform: string; clusterName: string }[];
}
interface ApiData {
  clusters: ClusterData[];
  emergingTopics: EmergingTopic[];
  unclustered: UnclusteredIntent[];
  hasClusterData: boolean;
  totalConversations: number;
  uniqueTopicsCount: number;
  topicInsights: TopicInsights;
}

// ─── Failure Taxonomy Types ───────────────────────────────────────────────────

interface FailureFreqItem { key: string; label: string; icon: string; color: string; count: number; pct: number; }
interface FailureExample  { convId: string; intent: string; turn: number; detail: string; }
interface FailureTaxonomyData {
  frequencyData: FailureFreqItem[];
  weeklyTrend:   Record<string, number | string>[];
  intentCrossTab: { intent: string; label: string; total: number; [key: string]: number | string }[];
  examples:       Record<string, FailureExample[]>;
  totalFailed:    number;
  totalConversations: number;
}

// ─── Companion Constants ──────────────────────────────────────────────────────

interface CompanionIntent {
  id: string; label: string; count: number; quality: number;
  satisfactionRate: number; avgTurns: number; topFailure: string; trend: number;
}

const COMPANION_INTENTS: CompanionIntent[] = [
  { id: "roleplay", label: "Roleplay", count: 700, quality: 72, satisfactionRate: 71, avgTurns: 14.2, topFailure: "Context Loss", trend: 3.2 },
  { id: "emotional_support", label: "Emotional Support", count: 450, quality: 68, satisfactionRate: 65, avgTurns: 11.8, topFailure: "Tone Break", trend: -1.4 },
  { id: "casual_chat", label: "Casual Chat", count: 375, quality: 76, satisfactionRate: 78, avgTurns: 8.3, topFailure: "Repetition", trend: 0.8 },
  { id: "creative_storytelling", label: "Creative Storytelling", count: 300, quality: 74, satisfactionRate: 73, avgTurns: 12.6, topFailure: "Coherence Loss", trend: 2.1 },
  { id: "advice_seeking", label: "Advice Seeking", count: 200, quality: 62, satisfactionRate: 58, avgTurns: 7.4, topFailure: "Hallucination", trend: -2.8 },
  { id: "companionship", label: "Companionship", count: 175, quality: 71, satisfactionRate: 70, avgTurns: 9.7, topFailure: "Tone Break", trend: 1.5 },
  { id: "humor_entertainment", label: "Humor & Entertainment", count: 125, quality: 77, satisfactionRate: 80, avgTurns: 6.1, topFailure: "Repetition", trend: 4.2 },
  { id: "learning_exploration", label: "Learning & Exploration", count: 100, quality: 65, satisfactionRate: 62, avgTurns: 9.2, topFailure: "Hallucination", trend: -0.6 },
  { id: "philosophical_discussion", label: "Philosophical Discussion", count: 75, quality: 70, satisfactionRate: 68, avgTurns: 15.4, topFailure: "Context Loss", trend: 1.0 },
];

const COMPANION_SUBTOPICS: { id: string; label: string; count: number; quality: number }[] = [
  { id: "fantasy_adventure", label: "Fantasy Adventure", count: 220, quality: 74 },
  { id: "romance", label: "Romance", count: 180, quality: 71 },
  { id: "anime_scenario", label: "Anime Scenario", count: 150, quality: 70 },
  { id: "historical_roleplay", label: "Historical Roleplay", count: 80, quality: 75 },
  { id: "sci_fi", label: "Sci-Fi", count: 70, quality: 73 },
];

const COMPANION_FAILURE_TYPES = [
  { key: "tone_break", label: "Tone Break", icon: "😤", color: "#f97316" },
  { key: "context_loss", label: "Context Loss", icon: "🔀", color: "#ef4444" },
  { key: "character_break", label: "Character Break", icon: "🎭", color: "#f59e0b" },
  { key: "hallucination", label: "Hallucination", icon: "🌀", color: "#8b5cf6" },
  { key: "coherence_loss", label: "Coherence Loss", icon: "💭", color: "#6366f1" },
];

// severity: 0=none, 1=low, 2=medium-high, 3=high
const COMPANION_HEATMAP: Record<string, Record<string, number>> = {
  roleplay:                { tone_break: 1, context_loss: 3, character_break: 2, hallucination: 1, coherence_loss: 1 },
  emotional_support:       { tone_break: 3, context_loss: 1, character_break: 1, hallucination: 1, coherence_loss: 0 },
  casual_chat:             { tone_break: 1, context_loss: 0, character_break: 0, hallucination: 0, coherence_loss: 1 },
  creative_storytelling:   { tone_break: 0, context_loss: 1, character_break: 1, hallucination: 0, coherence_loss: 2 },
  advice_seeking:          { tone_break: 1, context_loss: 0, character_break: 0, hallucination: 2, coherence_loss: 1 },
  companionship:           { tone_break: 2, context_loss: 1, character_break: 1, hallucination: 0, coherence_loss: 0 },
  humor_entertainment:     { tone_break: 0, context_loss: 0, character_break: 0, hallucination: 1, coherence_loss: 0 },
  learning_exploration:    { tone_break: 0, context_loss: 1, character_break: 0, hallucination: 2, coherence_loss: 1 },
  philosophical_discussion:{ tone_break: 1, context_loss: 2, character_break: 0, hallucination: 1, coherence_loss: 1 },
};

interface DeepDiveData {
  dims: { label: string; value: number }[];
  topFailures: { type: string; count: number; icon: string; color: string }[];
  examples: { id: string; preview: string; turns: number; quality: number }[];
  satDist: { label: string; pct: number; color: string }[];
  trend: { week: string; quality: number }[];
}

const COMPANION_DEEP_DIVE: Record<string, DeepDiveData> = {
  roleplay: {
    dims: [
      { label: "Persona Consistency", value: 74 },
      { label: "Narrative Depth", value: 71 },
      { label: "Engagement", value: 78 },
      { label: "Response Accuracy", value: 68 },
      { label: "Emotional Attunement", value: 65 },
    ],
    topFailures: [
      { type: "Context Loss", count: 84, icon: "🔀", color: "#ef4444" },
      { type: "Character Break", count: 62, icon: "🎭", color: "#f59e0b" },
      { type: "Tone Break", count: 38, icon: "😤", color: "#f97316" },
    ],
    examples: [
      { id: "conv-3847", preview: "AI lost track of the character's established personality after 8 turns, reverting to generic responses mid-story.", turns: 18, quality: 54 },
      { id: "conv-2913", preview: "User built an elaborate fantasy world but AI failed to reference earlier established lore in later turns.", turns: 22, quality: 48 },
      { id: "conv-5521", preview: "Character voice inconsistency — AI shifted from medieval dialect to modern speech without narrative reason.", turns: 14, quality: 61 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 42, color: "#22c55e" },
      { label: "Satisfied", pct: 29, color: "#22c55e" },
      { label: "Neutral", pct: 18, color: "#eab308" },
      { label: "Dissatisfied", pct: 11, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 69 }, { week: "Jan W4", quality: 70 }, { week: "Feb W1", quality: 71 }, { week: "Feb W2", quality: 72 }],
  },
  emotional_support: {
    dims: [
      { label: "Emotional Attunement", value: 62 },
      { label: "Persona Consistency", value: 70 },
      { label: "Engagement", value: 71 },
      { label: "Response Accuracy", value: 72 },
      { label: "Narrative Depth", value: 55 },
    ],
    topFailures: [
      { type: "Tone Break", count: 98, icon: "😤", color: "#f97316" },
      { type: "Context Loss", count: 41, icon: "🔀", color: "#ef4444" },
      { type: "Character Break", count: 29, icon: "🎭", color: "#f59e0b" },
    ],
    examples: [
      { id: "conv-1284", preview: "AI shifted to formal, clinical language when user expressed vulnerability, breaking emotional rapport.", turns: 9, quality: 51 },
      { id: "conv-4472", preview: "User seeking comfort received advice-focused responses rather than empathetic acknowledgment.", turns: 7, quality: 57 },
      { id: "conv-6631", preview: "AI incorrectly referenced previous session's topic, causing confusion and emotional disconnect.", turns: 12, quality: 49 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 31, color: "#22c55e" },
      { label: "Satisfied", pct: 34, color: "#22c55e" },
      { label: "Neutral", pct: 22, color: "#eab308" },
      { label: "Dissatisfied", pct: 13, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 70 }, { week: "Jan W4", quality: 69 }, { week: "Feb W1", quality: 68 }, { week: "Feb W2", quality: 68 }],
  },
  casual_chat: {
    dims: [
      { label: "Engagement", value: 80 },
      { label: "Persona Consistency", value: 78 },
      { label: "Emotional Attunement", value: 75 },
      { label: "Response Accuracy", value: 76 },
      { label: "Narrative Depth", value: 58 },
    ],
    topFailures: [
      { type: "Repetition", count: 52, icon: "🔁", color: "#94a3b8" },
      { type: "Tone Break", count: 28, icon: "😤", color: "#f97316" },
      { type: "Coherence Loss", count: 21, icon: "💭", color: "#6366f1" },
    ],
    examples: [
      { id: "conv-7823", preview: "AI recycled the same ice-breaker question three times within one conversation.", turns: 11, quality: 62 },
      { id: "conv-2245", preview: "Sudden tonal shift from playful banter to overly formal language mid-conversation.", turns: 6, quality: 68 },
      { id: "conv-9012", preview: "AI gave contradictory opinions on a topic mentioned earlier in the same chat.", turns: 8, quality: 59 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 48, color: "#22c55e" },
      { label: "Satisfied", pct: 30, color: "#22c55e" },
      { label: "Neutral", pct: 14, color: "#eab308" },
      { label: "Dissatisfied", pct: 8, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 75 }, { week: "Jan W4", quality: 75 }, { week: "Feb W1", quality: 76 }, { week: "Feb W2", quality: 76 }],
  },
  creative_storytelling: {
    dims: [
      { label: "Narrative Depth", value: 79 },
      { label: "Engagement", value: 76 },
      { label: "Persona Consistency", value: 73 },
      { label: "Response Accuracy", value: 70 },
      { label: "Emotional Attunement", value: 68 },
    ],
    topFailures: [
      { type: "Coherence Loss", count: 68, icon: "💭", color: "#6366f1" },
      { type: "Context Loss", count: 44, icon: "🔀", color: "#ef4444" },
      { type: "Character Break", count: 31, icon: "🎭", color: "#f59e0b" },
    ],
    examples: [
      { id: "conv-5543", preview: "Plot thread introduced in chapter 2 was never resolved — AI appeared to forget the story arc.", turns: 20, quality: 58 },
      { id: "conv-3381", preview: "Character motivations contradicted the established backstory earlier in the conversation.", turns: 16, quality: 63 },
      { id: "conv-8876", preview: "Narrative jumped genre from fantasy to thriller without any user instruction.", turns: 13, quality: 55 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 44, color: "#22c55e" },
      { label: "Satisfied", pct: 29, color: "#22c55e" },
      { label: "Neutral", pct: 16, color: "#eab308" },
      { label: "Dissatisfied", pct: 11, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 72 }, { week: "Jan W4", quality: 73 }, { week: "Feb W1", quality: 74 }, { week: "Feb W2", quality: 74 }],
  },
  advice_seeking: {
    dims: [
      { label: "Response Accuracy", value: 58 },
      { label: "Emotional Attunement", value: 63 },
      { label: "Engagement", value: 65 },
      { label: "Persona Consistency", value: 66 },
      { label: "Narrative Depth", value: 48 },
    ],
    topFailures: [
      { type: "Hallucination", count: 71, icon: "🌀", color: "#8b5cf6" },
      { type: "Tone Break", count: 38, icon: "😤", color: "#f97316" },
      { type: "Coherence Loss", count: 27, icon: "💭", color: "#6366f1" },
    ],
    examples: [
      { id: "conv-4419", preview: "AI cited a non-existent study to support relationship advice, undermining user trust.", turns: 8, quality: 44 },
      { id: "conv-2267", preview: "Contradictory advice given across two turns — recommended action A then B for the same situation.", turns: 6, quality: 52 },
      { id: "conv-6698", preview: "AI gave overly generic platitudes when user needed specific, actionable guidance.", turns: 5, quality: 58 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 24, color: "#22c55e" },
      { label: "Satisfied", pct: 34, color: "#22c55e" },
      { label: "Neutral", pct: 26, color: "#eab308" },
      { label: "Dissatisfied", pct: 16, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 65 }, { week: "Jan W4", quality: 63 }, { week: "Feb W1", quality: 62 }, { week: "Feb W2", quality: 62 }],
  },
  companionship: {
    dims: [
      { label: "Persona Consistency", value: 73 },
      { label: "Emotional Attunement", value: 70 },
      { label: "Engagement", value: 72 },
      { label: "Response Accuracy", value: 70 },
      { label: "Narrative Depth", value: 60 },
    ],
    topFailures: [
      { type: "Tone Break", count: 48, icon: "😤", color: "#f97316" },
      { type: "Context Loss", count: 31, icon: "🔀", color: "#ef4444" },
      { type: "Character Break", count: 22, icon: "🎭", color: "#f59e0b" },
    ],
    examples: [
      { id: "conv-3356", preview: "AI abandoned warm, personalized tone mid-conversation to deliver factual information in a detached manner.", turns: 10, quality: 58 },
      { id: "conv-7712", preview: "User's name and shared preferences from earlier in the session were not referenced in later turns.", turns: 13, quality: 63 },
      { id: "conv-1189", preview: "AI responded to emotional sharing with task-completion framing rather than empathy.", turns: 7, quality: 55 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 38, color: "#22c55e" },
      { label: "Satisfied", pct: 32, color: "#22c55e" },
      { label: "Neutral", pct: 18, color: "#eab308" },
      { label: "Dissatisfied", pct: 12, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 70 }, { week: "Jan W4", quality: 70 }, { week: "Feb W1", quality: 71 }, { week: "Feb W2", quality: 71 }],
  },
  humor_entertainment: {
    dims: [
      { label: "Engagement", value: 82 },
      { label: "Persona Consistency", value: 79 },
      { label: "Response Accuracy", value: 76 },
      { label: "Emotional Attunement", value: 74 },
      { label: "Narrative Depth", value: 62 },
    ],
    topFailures: [
      { type: "Repetition", count: 28, icon: "🔁", color: "#94a3b8" },
      { type: "Hallucination", count: 14, icon: "🌀", color: "#8b5cf6" },
      { type: "Tone Break", count: 11, icon: "😤", color: "#f97316" },
    ],
    examples: [
      { id: "conv-8832", preview: "AI recycled the same punchline format three times in a row, diminishing comedic value.", turns: 9, quality: 64 },
      { id: "conv-4456", preview: "Referenced a pop culture event from the wrong year, breaking immersion in a trivia-style exchange.", turns: 7, quality: 67 },
      { id: "conv-6614", preview: "Humor style shifted from dry wit to slapstick abruptly without matching user's evident preference.", turns: 5, quality: 61 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 52, color: "#22c55e" },
      { label: "Satisfied", pct: 28, color: "#22c55e" },
      { label: "Neutral", pct: 13, color: "#eab308" },
      { label: "Dissatisfied", pct: 7, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 74 }, { week: "Jan W4", quality: 75 }, { week: "Feb W1", quality: 77 }, { week: "Feb W2", quality: 77 }],
  },
  learning_exploration: {
    dims: [
      { label: "Response Accuracy", value: 61 },
      { label: "Narrative Depth", value: 68 },
      { label: "Engagement", value: 67 },
      { label: "Persona Consistency", value: 65 },
      { label: "Emotional Attunement", value: 60 },
    ],
    topFailures: [
      { type: "Hallucination", count: 44, icon: "🌀", color: "#8b5cf6" },
      { type: "Context Loss", count: 28, icon: "🔀", color: "#ef4444" },
      { type: "Coherence Loss", count: 19, icon: "💭", color: "#6366f1" },
    ],
    examples: [
      { id: "conv-2298", preview: "AI confidently explained a scientific concept with an incorrect fact when pressed for specifics.", turns: 11, quality: 53 },
      { id: "conv-5571", preview: "Lost track of the learning goal mid-session, pivoting to tangentially related but off-topic content.", turns: 9, quality: 60 },
      { id: "conv-7743", preview: "Explanation became internally contradictory across two consecutive turns on the same topic.", turns: 8, quality: 57 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 27, color: "#22c55e" },
      { label: "Satisfied", pct: 35, color: "#22c55e" },
      { label: "Neutral", pct: 24, color: "#eab308" },
      { label: "Dissatisfied", pct: 14, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 66 }, { week: "Jan W4", quality: 65 }, { week: "Feb W1", quality: 65 }, { week: "Feb W2", quality: 65 }],
  },
  philosophical_discussion: {
    dims: [
      { label: "Narrative Depth", value: 74 },
      { label: "Engagement", value: 72 },
      { label: "Response Accuracy", value: 68 },
      { label: "Persona Consistency", value: 70 },
      { label: "Emotional Attunement", value: 64 },
    ],
    topFailures: [
      { type: "Context Loss", count: 22, icon: "🔀", color: "#ef4444" },
      { type: "Hallucination", count: 18, icon: "🌀", color: "#8b5cf6" },
      { type: "Tone Break", count: 14, icon: "😤", color: "#f97316" },
    ],
    examples: [
      { id: "conv-9934", preview: "AI forgot a key philosophical position the user had outlined earlier in a long exchange.", turns: 19, quality: 61 },
      { id: "conv-3312", preview: "Cited a misattributed quote as genuine philosophical text, confusing the discussion.", turns: 15, quality: 56 },
      { id: "conv-6687", preview: "AI shifted to a confrontational tone when user challenged its reasoning, breaking the reflective atmosphere.", turns: 11, quality: 63 },
    ],
    satDist: [
      { label: "Very satisfied", pct: 35, color: "#22c55e" },
      { label: "Satisfied", pct: 33, color: "#22c55e" },
      { label: "Neutral", pct: 20, color: "#eab308" },
      { label: "Dissatisfied", pct: 12, color: "#ef4444" },
    ],
    trend: [{ week: "Jan W3", quality: 69 }, { week: "Jan W4", quality: 70 }, { week: "Feb W1", quality: 70 }, { week: "Feb W2", quality: 70 }],
  },
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

function fmt(n: number) { return n.toLocaleString(); }
function cap(s: string) { return s.replace(/_/g, " "); }

function qualityColor(q: number | null): string {
  if (q === null) return "#3f3f46";
  if (q >= 75) return "#22c55e";
  if (q >= 55) return "#eab308";
  if (q >= 40) return "#f97316";
  return "#ef4444";
}

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-64" />
      <Bone className="h-[360px] rounded-xl" />
      <Bone className="h-12 rounded-xl" />
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Treemap cell ─────────────────────────────────────────────────────────────

interface TreemapItem { name: string; size: number; quality: number | null; isCluster: boolean; clusterId?: string; [key: string]: unknown; }

function TreemapCell({ x = 0, y = 0, width = 0, height = 0, name = "", quality, onClick, isCluster, hasSubtopics }: {
  x?: number; y?: number; width?: number; height?: number; name?: string;
  quality?: number | null; onClick?: () => void; isCluster?: boolean; hasSubtopics?: boolean;
}) {
  const color = qualityColor(quality ?? null);
  const showText = width > 40 && height > 24;
  const showSub = width > 80 && height > 44;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2}
        rx={4} fill={color} fillOpacity={0.18} stroke={color} strokeOpacity={0.4} strokeWidth={1} />
      {showText && (
        <text x={x + width / 2} y={y + height / 2 - (showSub ? 7 : 0)}
          textAnchor="middle" fill="white" fontSize={Math.min(12, width / 8)} style={{ pointerEvents: "none" }}>
          {name.length > 20 && width < 120 ? name.slice(0, 18) + "…" : name}
        </text>
      )}
      {showSub && quality !== null && quality !== undefined && (
        <text x={x + width / 2} y={y + height / 2 + 10}
          textAnchor="middle" fill={color} fontSize={10} style={{ pointerEvents: "none" }}>
          {quality}/100
        </text>
      )}
      {hasSubtopics && isCluster && showText && height > 50 && (
        <text x={x + width / 2} y={y + height / 2 + (showSub ? 24 : 12)}
          textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} style={{ pointerEvents: "none" }}>
          click to explore
        </text>
      )}
    </g>
  );
}

type SortKey = "count" | "avgQuality" | "completionRate" | "failureRate" | "avgTurns" | "revenue" | "satisfactionRate";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Topics() {
  const { selectedPlatform, profile } = useProductProfile();
  const { segment } = useDemoMode();
  const isCompanion = segment === "ai_companion";

  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tableSearch, setTableSearch] = useState("");
  const [localPlatform, setLocalPlatform] = useState("all");

  // Failure taxonomy
  const [failureData, setFailureData] = useState<FailureTaxonomyData | null>(null);
  const [failureLoading, setFailureLoading] = useState(true);
  const [expandedFailure, setExpandedFailure] = useState<string | null>(null);

  // Companion-specific state
  const [companionDrillDown, setCompanionDrillDown] = useState<string | null>(null);
  const [expandedIntent, setExpandedIntent] = useState<string | null>(null);
  const [companionSortKey, setCompanionSortKey] = useState<"count" | "quality" | "satisfactionRate" | "avgTurns">("count");
  const [companionSortDir, setCompanionSortDir] = useState<"asc" | "desc">("desc");
  const [companionSearch, setCompanionSearch] = useState("");

  const effectivePlatform = selectedPlatform !== "all" ? selectedPlatform : localPlatform;

  useEffect(() => {
    if (isCompanion) return;
    setLoading(true);
    setSelectedCluster(null);
    const params = new URLSearchParams();
    if (segment) params.set("segment", segment);
    else if (effectivePlatform !== "all") params.set("platform", effectivePlatform);
    const url = `/api/topics${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [effectivePlatform, segment, isCompanion]);

  useEffect(() => {
    if (isCompanion) return;
    setFailureLoading(true);
    const sp = segment ? `&segment=${segment}` : "";
    fetch(`/api/failure-taxonomy?days=30${sp}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setFailureData(d))
      .finally(() => setFailureLoading(false));
  }, [segment, isCompanion]);

  // Flat list of all topic rows for the breakdown table
  const allTopicRows = useMemo(() => {
    if (!data) return [];
    const rows: (TopicSummary & { clusterName: string })[] = [];
    for (const cluster of data.clusters) {
      for (const topic of cluster.topics) {
        rows.push({ ...topic, clusterName: cluster.clusterName });
      }
    }
    for (const unc of data.unclustered) {
      rows.push({
        label: unc.label, count: unc.count, avgQuality: unc.avgQuality,
        failureRate: unc.failureRate, completionRate: 0, avgTurns: null,
        topPlatform: null, firstSeen: null, isEmerging: false,
        clusterName: "Unclustered",
        estRevenueImpact: unc.estRevenueImpact ?? null,
      });
    }
    return rows;
  }, [data]);

  const hasRevenue = useMemo(() => allTopicRows.some((r) => (r.estRevenueImpact ?? 0) > 0), [allTopicRows]);

  useEffect(() => {
    if (hasRevenue) { setSortKey("revenue"); setSortDir("desc"); }
  }, [hasRevenue]);

  const sortedFilteredRows = useMemo(() => {
    let rows = allTopicRows;
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      rows = rows.filter((r) => r.label.toLowerCase().includes(q) || r.clusterName.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      const av = sortKey === "revenue" ? (a.estRevenueImpact ?? 0) : (a[sortKey as keyof typeof a] as number ?? 0);
      const bv = sortKey === "revenue" ? (b.estRevenueImpact ?? 0) : (b[sortKey as keyof typeof b] as number ?? 0);
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
  }, [allTopicRows, tableSearch, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <th onClick={() => handleSort(k)}
        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">
        {label}{active ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </th>
    );
  }

  // ── Companion sorted intents ────────────────────────────────────────────────
  const companionSortedIntents = useMemo(() => {
    let rows = [...COMPANION_INTENTS];
    if (companionSearch) {
      const q = companionSearch.toLowerCase();
      rows = rows.filter((r) => r.label.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => {
      const av = a[companionSortKey] as number;
      const bv = b[companionSortKey] as number;
      return companionSortDir === "desc" ? bv - av : av - bv;
    });
  }, [companionSearch, companionSortKey, companionSortDir]);

  function handleCompanionSort(key: "count" | "quality" | "satisfactionRate" | "avgTurns") {
    if (companionSortKey === key) setCompanionSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setCompanionSortKey(key); setCompanionSortDir("desc"); }
  }

  function CompanionSortTh({ k, label }: { k: "count" | "quality" | "satisfactionRate" | "avgTurns"; label: string }) {
    const active = companionSortKey === k;
    return (
      <th onClick={() => handleCompanionSort(k)}
        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none">
        {label}{active ? (companionSortDir === "desc" ? " ↓" : " ↑") : ""}
      </th>
    );
  }

  // ── Companion treemap data ──────────────────────────────────────────────────
  const companionTreemapData: TreemapItem[] = companionDrillDown === "roleplay"
    ? COMPANION_SUBTOPICS.map((s) => ({ name: s.label, size: s.count, quality: s.quality, isCluster: false }))
    : COMPANION_INTENTS.map((i) => ({ name: i.label, size: i.count, quality: i.quality, isCluster: true, clusterId: i.id }));

  // ── Companion render ────────────────────────────────────────────────────────
  if (isCompanion) {
    const totalConvos = COMPANION_INTENTS.reduce((s, i) => s + i.count, 0);

    return (
      <div className="p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-white">What Users Talk About</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            9 intent categories across {fmt(totalConvos)} conversations · Character.ai companion data
          </p>
        </div>

        {/* ── Topic Map ──────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Map</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {companionDrillDown === "roleplay"
                  ? "Roleplay sub-topics — size = volume, color = quality"
                  : "Size = conversation volume · Color = quality score · Click Roleplay to explore sub-topics"}
              </p>
            </div>
            {companionDrillDown !== null && (
              <button onClick={() => setCompanionDrillDown(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                ← All Intents
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4 mt-3">
            {[["≥75", "#22c55e"], ["≥55", "#eab308"], ["≥40", "#f97316"], ["<40", "#ef4444"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color as string, opacity: 0.8 }} />
                {label}
              </span>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <Treemap
              data={companionTreemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={(props) => {
                const { x, y, width, height, name, value } = props as { x: number; y: number; width: number; height: number; name: string; value: number };
                const item = companionTreemapData.find((d) => d.name === name && d.size === value);
                const hasSubtopics = item?.clusterId === "roleplay";
                return (
                  <TreemapCell x={x} y={y} width={width} height={height} name={name}
                    quality={item?.quality ?? null} isCluster={item?.isCluster}
                    hasSubtopics={hasSubtopics}
                    onClick={hasSubtopics ? () => setCompanionDrillDown("roleplay") : undefined} />
                );
              }}
            />
          </ResponsiveContainer>
        </div>

        {/* ── Topic Breakdown Table ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Breakdown</p>
              <p className="text-xs text-zinc-600 mt-0.5">Click a row to see intent deep dive</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search intents..." value={companionSearch}
                onChange={(e) => setCompanionSearch(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-300 w-44 focus:outline-none focus:border-white/20 placeholder:text-zinc-600" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                  <CompanionSortTh k="count" label="Conversations" />
                  <CompanionSortTh k="quality" label="Avg Quality" />
                  <CompanionSortTh k="satisfactionRate" label="Satisfaction" />
                  <CompanionSortTh k="avgTurns" label="Avg Turns" />
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Failure</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trend (7d)</th>
                </tr>
              </thead>
              <tbody>
                {companionSortedIntents.map((row) => {
                  const isExpanded = expandedIntent === row.id;
                  const dive = COMPANION_DEEP_DIVE[row.id];
                  return (
                    <>
                      <tr
                        key={row.id}
                        onClick={() => setExpandedIntent(isExpanded ? null : row.id)}
                        className={`border-b border-white/[0.03] cursor-pointer transition-colors ${isExpanded ? "bg-indigo-500/[0.05]" : "hover:bg-white/[0.02]"}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-200 font-medium">{row.label}</span>
                            {row.id === "roleplay" && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">5 sub-topics</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 font-mono">{fmt(row.count)}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs" style={{ color: qualityColor(row.quality) }}>{row.quality}/100</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`font-mono text-xs ${row.satisfactionRate >= 70 ? "text-green-400" : row.satisfactionRate >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                            {row.satisfactionRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{row.avgTurns.toFixed(1)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-zinc-400">{row.topFailure}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-mono font-semibold ${row.trend >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {row.trend >= 0 ? "+" : ""}{row.trend.toFixed(1)}%
                          </span>
                        </td>
                      </tr>

                      {/* Intent Deep Dive */}
                      {isExpanded && dive && (
                        <tr key={`${row.id}-dive`} className="border-b border-white/[0.06]">
                          <td colSpan={7} className="px-5 py-5 bg-[#0f101a]">
                            <div className="space-y-4">
                              {/* Row 1: Quality dims + Top failures + Satisfaction */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Quality dimensions */}
                                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Quality Dimensions</p>
                                  <div className="space-y-2.5">
                                    {dive.dims.map((d) => (
                                      <div key={d.label}>
                                        <div className="flex justify-between mb-1">
                                          <span className="text-[11px] text-zinc-400">{d.label}</span>
                                          <span className="text-[11px] font-mono" style={{ color: qualityColor(d.value) }}>{d.value}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/[0.06]">
                                          <div className="h-full rounded-full transition-all"
                                            style={{ width: `${d.value}%`, backgroundColor: qualityColor(d.value) }} />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Top failures */}
                                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Top Failure Types</p>
                                  <div className="space-y-3">
                                    {dive.topFailures.map((f, i) => {
                                      const maxCount = dive.topFailures[0].count;
                                      return (
                                        <div key={f.type}>
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm">{f.icon}</span>
                                            <span className="text-[11px] text-zinc-300 flex-1">{f.type}</span>
                                            <span className="text-[11px] font-mono text-zinc-400">{f.count}</span>
                                            {i === 0 && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400">top</span>}
                                          </div>
                                          <div className="h-1.5 rounded-full bg-white/[0.06]">
                                            <div className="h-full rounded-full"
                                              style={{ width: `${(f.count / maxCount) * 100}%`, backgroundColor: f.color }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Satisfaction distribution */}
                                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Satisfaction Distribution</p>
                                  {/* Stacked bar */}
                                  <div className="flex rounded-full overflow-hidden h-4 mb-3">
                                    {dive.satDist.map((s) => (
                                      <div key={s.label} style={{ width: `${s.pct}%`, backgroundColor: s.color }} title={`${s.label}: ${s.pct}%`} />
                                    ))}
                                  </div>
                                  <div className="space-y-1.5">
                                    {dive.satDist.map((s) => (
                                      <div key={s.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                                          <span className="text-[11px] text-zinc-400">{s.label}</span>
                                        </div>
                                        <span className="text-[11px] font-mono text-zinc-400">{s.pct}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Row 2: Example conversations + trend */}
                              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                {/* Examples */}
                                <div className="md:col-span-3 space-y-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Example Conversations</p>
                                  {dive.examples.map((ex) => (
                                    <div key={ex.id} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.05]">
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[9px] font-mono text-zinc-600">{ex.id}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                          style={{ color: qualityColor(ex.quality), backgroundColor: qualityColor(ex.quality) + "15" }}>
                                          {ex.quality}/100
                                        </span>
                                        <span className="ml-auto text-[10px] text-zinc-600">{ex.turns} turns</span>
                                      </div>
                                      <p className="text-xs text-zinc-400 leading-relaxed">{ex.preview}</p>
                                    </div>
                                  ))}
                                </div>

                                {/* 4-week trend */}
                                <div className="md:col-span-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">4-Week Quality Trend</p>
                                  <ResponsiveContainer width="100%" height={120}>
                                    <LineChart data={dive.trend} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                      <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 9 }} axisLine={false} tickLine={false} />
                                      <YAxis domain={["auto", "auto"]} tick={{ fill: "#71717a", fontSize: 9 }} axisLine={false} tickLine={false} />
                                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [String(v), "Quality"]} />
                                      <Line type="monotone" dataKey="quality" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Failure Heatmap ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Failure Heatmap</p>
          <p className="text-xs text-zinc-600 mb-4">Intent × failure type hot spots — where AI breaks down most in companion conversations</p>

          <div className="flex items-center gap-5 mb-4">
            {[
              { label: "High", bg: "#ef444433", border: "#ef4444" },
              { label: "Medium-High", bg: "#f9731633", border: "#f97316" },
              { label: "Medium", bg: "#eab30833", border: "#eab308" },
              { label: "Low", bg: "#6b728033", border: "#6b7280" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: s.bg, borderColor: s.border }} />
                <span className="text-[10px] text-zinc-500">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[580px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 w-48">Intent</th>
                  {COMPANION_FAILURE_TYPES.map((ft) => (
                    <th key={ft.key} className="px-3 py-2 text-center text-[10px] font-semibold text-zinc-500 whitespace-nowrap">
                      <span className="block text-base leading-none mb-0.5">{ft.icon}</span>
                      <span className="text-[9px] text-zinc-600">{ft.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPANION_INTENTS.map((intent) => {
                  const row = COMPANION_HEATMAP[intent.id] ?? {};
                  return (
                    <tr key={intent.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 text-zinc-300 font-medium">{intent.label}</td>
                      {COMPANION_FAILURE_TYPES.map((ft) => {
                        const severity = row[ft.key] ?? 0;
                        const severityLabel = severity === 3 ? "HIGH" : severity === 2 ? "MED-HIGH" : severity === 1 ? "LOW" : null;
                        const colors: Record<number, { bg: string; text: string; border: string }> = {
                          3: { bg: "#ef444420", text: "#ef4444", border: "#ef444440" },
                          2: { bg: "#f9731620", text: "#f97316", border: "#f9731640" },
                          1: { bg: "#eab30818", text: "#eab308", border: "#eab30830" },
                        };
                        const c = colors[severity];
                        return (
                          <td key={ft.key} className="px-3 py-2.5 text-center">
                            {severityLabel ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-semibold border"
                                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                                {severityLabel}
                              </span>
                            ) : (
                              <span className="text-zinc-800 text-[10px]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Non-companion rendering ─────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load</p><p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const activeClusters = data.clusters.filter((c) => c.conversationCount > 0);
  const isMultiPlatform = profile?.isMultiPlatform ?? false;

  const treemapData: TreemapItem[] = selectedCluster === null
    ? activeClusters.map((c) => ({ name: c.clusterName, size: c.conversationCount, quality: c.avgQuality, clusterId: c.id, isCluster: true }))
    : (() => {
        const cluster = data.clusters.find((c) => c.id === selectedCluster || c.clusterName === selectedCluster);
        return (cluster?.topics ?? []).map((t): TreemapItem => ({ name: t.label, size: t.count, quality: t.avgQuality, isCluster: false }));
      })();

  const hasNoData = !data.hasClusterData && data.unclustered.length === 0;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">What Users Talk About</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data.uniqueTopicsCount > 0
              ? `${data.uniqueTopicsCount} unique topics discovered across ${fmt(data.totalConversations)} conversations`
              : `${fmt(data.totalConversations)} conversations — run analysis to discover topics`}
          </p>
        </div>
        {!isMultiPlatform && (
          <select value={localPlatform} onChange={(e) => setLocalPlatform(e.target.value)}
            className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20">
            <option value="all">All Platforms</option>
            {["chatgpt", "claude", "gemini", "grok", "perplexity"].map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {hasNoData && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-indigo-400 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-base font-semibold text-white mb-2">No topics discovered yet</h3>
          <p className="text-sm text-zinc-500 mb-2 max-w-md mx-auto">
            After running analysis, this page shows an interactive topic map, breakdown table, and auto-generated insights about what your users are asking.
          </p>
          <div className="inline-block bg-black/40 rounded-lg px-4 py-3 font-mono text-xs text-zinc-400 mt-3 text-left">
            <p className="text-emerald-400">python -m workers.intent_classifier</p>
            <p className="text-emerald-400 mt-1">python -m workers.topic_clusterer</p>
          </div>
        </div>
      )}

      {!data.hasClusterData && data.unclustered.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <p className="text-sm font-medium text-amber-300 mb-1">Intent labels detected — clustering not run yet</p>
          <p className="text-xs text-zinc-500 mb-3">Run the topic clusterer to group intents into high-level clusters and unlock the Topic Map visualization.</p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400">
            <p className="text-emerald-400">python -m workers.topic_clusterer</p>
          </div>
        </div>
      )}

      {/* ── Section 1: Topic Map ─────────────────────────────────────────────── */}
      {data.hasClusterData && activeClusters.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Map</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {selectedCluster !== null
                  ? `Topics inside "${selectedCluster}" — size = volume, color = quality`
                  : "Size = conversation volume · Color = quality score · Click a cluster to explore"}
              </p>
            </div>
            {selectedCluster !== null && (
              <button onClick={() => setSelectedCluster(null)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                ← All Topics
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 mb-4 mt-3">
            {[["≥75", "#22c55e"], ["≥55", "#eab308"], ["≥40", "#f97316"], ["<40", "#ef4444"], ["No data", "#3f3f46"]].map(([label, color]) => (
              <span key={label} className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color as string, opacity: 0.8 }} />
                {label}
              </span>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={360}>
            <Treemap
              data={treemapData}
              dataKey="size"
              aspectRatio={4 / 3}
              content={(props) => {
                const { x, y, width, height, name, value } = props as { x: number; y: number; width: number; height: number; name: string; value: number };
                const item = treemapData.find((d) => d.name === name && d.size === value);
                return (
                  <TreemapCell x={x} y={y} width={width} height={height} name={name}
                    quality={item?.quality ?? null} isCluster={item?.isCluster} hasSubtopics={item?.isCluster}
                    onClick={item?.isCluster ? () => setSelectedCluster(item.clusterId ?? name) : undefined} />
                );
              }}
            />
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Section 2: Topic Breakdown ───────────────────────────────────────── */}
      {(data.hasClusterData || data.unclustered.length > 0) && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Breakdown</p>
              <p className="text-xs text-zinc-600 mt-0.5">All topics sorted by any column — click headers to sort</p>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Search topics..." value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="bg-[#0f101a] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-sm text-zinc-300 w-48 focus:outline-none focus:border-white/20 placeholder:text-zinc-600" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Cluster</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Specific Topic</th>
                  <SortTh k="count" label="Conversations" />
                  <SortTh k="avgQuality" label="Avg Quality" />
                  <SortTh k="completionRate" label="Completion" />
                  <SortTh k="avgTurns" label="Avg Turns" />
                  {hasRevenue && <SortTh k="revenue" label="Est. Impact/mo" />}
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Trend</th>
                  {isMultiPlatform && <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Platform</th>}
                </tr>
              </thead>
              <tbody>
                {sortedFilteredRows.length === 0 ? (
                  <tr><td colSpan={(isMultiPlatform ? 8 : 7) + (hasRevenue ? 1 : 0)} className="text-center py-8 text-zinc-600 text-sm">No topics match your search</td></tr>
                ) : (
                  sortedFilteredRows.slice(0, 100).map((row) => (
                    <tr key={`${row.clusterName}:${row.label}`} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-1.5 py-0.5 rounded capitalize">{row.clusterName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 capitalize max-w-[200px] truncate">{cap(row.label)}</td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono">{fmt(row.count)}</td>
                      <td className="px-4 py-2.5">
                        {row.avgQuality !== null
                          ? <span className="font-mono text-xs" style={{ color: qualityColor(row.avgQuality) }}>{row.avgQuality}/100</span>
                          : <span className="text-zinc-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{row.completionRate ? `${row.completionRate}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs">{row.avgTurns ?? "—"}</td>
                      {hasRevenue && (
                        <td className="px-4 py-2.5">
                          {(row.estRevenueImpact ?? 0) > 0
                            ? <span className="font-mono text-xs font-semibold text-emerald-400">${(row.estRevenueImpact!).toLocaleString()}/mo</span>
                            : <span className="text-zinc-700 text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        {row.isEmerging
                          ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">New</span>
                          : <span className="text-zinc-700 text-xs">—</span>}
                      </td>
                      {isMultiPlatform && (
                        <td className="px-4 py-2.5">
                          {row.topPlatform ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{ color: PLATFORM_COLORS[row.topPlatform] ?? "#6b7280", backgroundColor: (PLATFORM_COLORS[row.topPlatform] ?? "#6b7280") + "20" }}>
                              {PLATFORM_LABELS[row.topPlatform] ?? row.topPlatform}
                            </span>
                          ) : <span className="text-zinc-700 text-xs">—</span>}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {sortedFilteredRows.length > 100 && (
              <p className="text-xs text-zinc-600 text-center py-3">Showing 100 of {sortedFilteredRows.length} topics — use search to filter</p>
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Topic Insights ────────────────────────────────────────── */}
      {data.hasClusterData && (
        <div className="space-y-3">
          <div className="px-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Topic Insights</p>
            <p className="text-xs text-zinc-600 mt-0.5">Auto-generated observations about your topic data</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.topicInsights.mostDiscussed && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">💬</span>
                  <p className="text-xs font-semibold text-zinc-300">Most Discussed</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{data.topicInsights.mostDiscussed.name}</span>
                  {" "}is the largest topic cluster with{" "}
                  <span className="text-white font-mono">{fmt(data.topicInsights.mostDiscussed.count)}</span> conversations.
                </p>
              </div>
            )}
            {data.topicInsights.biggestQualityGap && (
              <div className="rounded-xl border border-red-500/10 bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">⚠️</span>
                  <p className="text-xs font-semibold text-zinc-300">Biggest Quality Gap</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{cap(data.topicInsights.biggestQualityGap.label)}</span>
                  {" "}has high volume ({fmt(data.topicInsights.biggestQualityGap.count)} convos) but low quality{" "}
                  <span className="text-red-400 font-mono">{data.topicInsights.biggestQualityGap.avgQuality}/100</span>
                  {" "}— users ask a lot but AI struggles.
                </p>
              </div>
            )}
            {data.topicInsights.fastestGrowing && (
              <div className="rounded-xl border border-indigo-500/10 bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">📈</span>
                  <p className="text-xs font-semibold text-zinc-300">Fastest Growing</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-medium capitalize">{cap(data.topicInsights.fastestGrowing.label)}</span>
                  {" "}is a new emerging topic with{" "}
                  <span className="text-white font-mono">{fmt(data.topicInsights.fastestGrowing.count)}</span> conversations in the last 14 days
                  {data.topicInsights.fastestGrowing.clusterName ? ` (cluster: ${data.topicInsights.fastestGrowing.clusterName})` : ""}.
                </p>
              </div>
            )}
            {isMultiPlatform && data.topicInsights.platformSpecialization.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🎯</span>
                  <p className="text-xs font-semibold text-zinc-300">Platform Specialization</p>
                </div>
                <div className="space-y-1.5">
                  {data.topicInsights.platformSpecialization.map((ps) => (
                    <p key={ps.platform} className="text-sm text-zinc-400">
                      Users prefer{" "}
                      <span className="font-medium" style={{ color: PLATFORM_COLORS[ps.platform] }}>{PLATFORM_LABELS[ps.platform]}</span>
                      {" "}for <span className="text-white capitalize">{ps.clusterName}</span>.
                    </p>
                  ))}
                </div>
              </div>
            )}
            {data.emergingTopics.length > 0 && (
              <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">✨</span>
                  <p className="text-xs font-semibold text-zinc-300">New Activity</p>
                </div>
                <p className="text-sm text-zinc-400">
                  <span className="text-white font-mono">{data.emergingTopics.length}</span> new topic
                  {data.emergingTopics.length !== 1 ? "s" : ""} emerged in the last 14 days, including{" "}
                  <span className="text-white capitalize">{cap(data.emergingTopics[0].label)}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 4: Failure Analysis ──────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="px-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Failure Analysis</p>
          <p className="text-xs text-zinc-600 mt-0.5">Systematic classification of AI failure patterns across all conversations</p>
        </div>

        {failureLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-xl bg-white/[0.04] h-48" />)}
          </div>
        ) : !failureData || failureData.totalFailed === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-8 text-center">
            <p className="text-zinc-600 text-sm">No failure data available — conversations with quality score &lt; 65 will appear here</p>
          </div>
        ) : (
          <>
            {/* 4a: Failure Type Frequency */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Failure Type Frequency</p>
              <p className="text-xs text-zinc-600 mb-1">
                {fmt(failureData.totalFailed)} failed conversations · click a row to see examples
              </p>
              <div className="space-y-1 mt-4">
                {failureData.frequencyData.map((ft) => {
                  const isExpanded = expandedFailure === ft.key;
                  const barWidth = failureData.frequencyData[0]?.count > 0
                    ? (ft.count / failureData.frequencyData[0].count) * 100
                    : 0;
                  return (
                    <div key={ft.key}>
                      <button
                        onClick={() => setExpandedFailure(isExpanded ? null : ft.key)}
                        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group text-left"
                      >
                        <span className="text-base w-6 text-center shrink-0">{ft.icon}</span>
                        <span className="text-sm text-zinc-300 w-40 shrink-0">{ft.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: ft.color }} />
                        </div>
                        <span className="text-xs font-mono text-zinc-400 w-12 text-right shrink-0">{fmt(ft.count)}</span>
                        <span className="text-[10px] text-zinc-600 w-10 text-right shrink-0">{ft.pct}%</span>
                        <svg className={`w-3 h-3 text-zinc-600 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="ml-9 mt-1 mb-2 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">Example conversations</p>
                          {(failureData.examples[ft.key] ?? []).length === 0 ? (
                            <p className="text-xs text-zinc-600">No examples available</p>
                          ) : (
                            (failureData.examples[ft.key] ?? []).map((ex, i) => (
                              <div key={i} className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.05]">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[9px] font-mono text-zinc-600">{ex.convId}</span>
                                  <span className="text-[10px] text-zinc-500 capitalize bg-white/[0.04] px-1.5 py-0.5 rounded">{cap(ex.intent)}</span>
                                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                                    style={{ color: ft.color, backgroundColor: ft.color + "15" }}>
                                    Turn {ex.turn}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                  <span className="mr-1.5">{ft.icon}</span>{ex.detail}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4b: Failure Trends */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Failure Trends</p>
              <p className="text-xs text-zinc-600 mb-4">Weekly failure count per type — is your hallucination rate improving?</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={failureData.weeklyTrend} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: unknown, name: unknown) => [
                      String(v),
                      FAILURE_TYPES.find((f) => f.key === String(name))?.label ?? String(name),
                    ]}
                  />
                  {FAILURE_TYPES.map((ft) => (
                    <Line key={ft.key} type="monotone" dataKey={ft.key} stroke={ft.color}
                      strokeWidth={1.5} dot={false} connectNulls name={ft.key} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-white/[0.05]">
                {FAILURE_TYPES.map((ft) => (
                  <div key={ft.key} className="flex items-center gap-1.5">
                    <span className="text-[10px]">{ft.icon}</span>
                    <span className="text-[10px] text-zinc-500">{ft.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4c: Intent × Failure Type Heatmap */}
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Intent × Failure Heatmap</p>
              <p className="text-xs text-zinc-600 mb-4">Which intents produce which failures most often — darker = higher rate</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600 w-44">Intent</th>
                      {FAILURE_TYPES.map((ft) => (
                        <th key={ft.key} className="px-2 py-2 text-center text-[10px] font-semibold text-zinc-500 whitespace-nowrap" title={ft.label}>
                          <span className="block text-base leading-none mb-0.5">{ft.icon}</span>
                          <span className="text-[9px] text-zinc-600">{ft.label.slice(0, 6)}</span>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failureData.intentCrossTab.map((row) => {
                      const maxInRow = Math.max(1, ...FAILURE_TYPES.map((ft) => (row[ft.key] as number) ?? 0));
                      return (
                        <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="px-3 py-2.5 text-zinc-300 capitalize font-medium truncate max-w-[11rem]">{cap(row.intent)}</td>
                          {FAILURE_TYPES.map((ft) => {
                            const count = (row[ft.key] as number) ?? 0;
                            const opacity = count > 0 ? 0.12 + (count / maxInRow) * 0.55 : 0;
                            return (
                              <td key={ft.key} className="px-2 py-2.5 text-center">
                                {count > 0 ? (
                                  <span
                                    className="inline-flex items-center justify-center w-8 h-6 rounded text-[10px] font-mono font-semibold"
                                    style={{ backgroundColor: ft.color + Math.round(opacity * 255).toString(16).padStart(2, "0"), color: ft.color }}
                                  >
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-zinc-800 text-[10px]">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-right text-zinc-500 font-mono text-[10px]">{row.total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Unclustered intents fallback */}
      {(!data.hasClusterData || data.unclustered.length > 0) && (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              {data.hasClusterData ? "Unclustered Intent Labels" : "Raw Intent Labels"}
            </p>
            <p className="text-xs text-zinc-600 mt-0.5">
              {data.hasClusterData ? "Labels not yet assigned to a cluster — re-run topic_clusterer to include these" : "Raw intent labels — run topic_clusterer to group into clusters"}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {["#", "Label", "Volume", "Avg Quality", "Failure Rate"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.unclustered.map((row, i) => (
                <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 text-zinc-200 capitalize">{cap(row.label)}</td>
                  <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums">{fmt(row.count)}</td>
                  <td className="px-4 py-2.5">
                    {row.avgQuality !== null
                      ? <span className="font-mono text-xs" style={{ color: qualityColor(row.avgQuality) }}>{row.avgQuality}/100</span>
                      : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-xs ${row.failureRate >= 50 ? "text-red-400" : row.failureRate >= 30 ? "text-amber-400" : "text-zinc-400"}`}>
                      {row.failureRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
