// ─── Quality Dimension Metadata ───────────────────────────────────────────────

export const DIMENSIONS = [
  { key: "helpfulness",  label: "Helpfulness",  weight: 0.25, color: "#6366f1" },
  { key: "relevance",    label: "Relevance",     weight: 0.20, color: "#22c55e" },
  { key: "accuracy",     label: "Accuracy",      weight: 0.20, color: "#3b82f6" },
  { key: "coherence",    label: "Coherence",     weight: 0.15, color: "#a855f7" },
  { key: "satisfaction", label: "Satisfaction",  weight: 0.10, color: "#f59e0b" },
  { key: "naturalness",  label: "Naturalness",   weight: 0.05, color: "#ec4899" },
  { key: "safety",       label: "Safety",        weight: 0.05, color: "#10b981" },
] as const;

export type DimensionKey = "helpfulness" | "relevance" | "accuracy" | "coherence" | "satisfaction" | "naturalness" | "safety";

// ─── Satisfaction Signal Metadata ─────────────────────────────────────────────

export const SIGNALS = [
  { key: "rephrasing",         label: "Rephrasing",         emoji: "🔄", sentiment: "frustration",      color: "#f59e0b" },
  { key: "gratitude",          label: "Gratitude",           emoji: "🙏", sentiment: "satisfaction",     color: "#22c55e" },
  { key: "abandonment",        label: "Abandonment",         emoji: "🚪", sentiment: "failure",          color: "#ef4444" },
  { key: "quick_followup",     label: "Quick follow-up",     emoji: "⚡", sentiment: "engagement",       color: "#6366f1" },
  { key: "message_shortening", label: "Message shortening",  emoji: "📉", sentiment: "losing interest",  color: "#f97316" },
  { key: "escalation_request", label: "Escalation request",  emoji: "🆘", sentiment: "failure",          color: "#ef4444" },
  { key: "retry_pattern",      label: "Retry pattern",       emoji: "🔁", sentiment: "high frustration", color: "#dc2626" },
  { key: "deepening",          label: "Deepening",           emoji: "🔍", sentiment: "high engagement",  color: "#06b6d4" },
] as const;

export type SatisfactionSignal = typeof SIGNALS[number]["key"];
export type InferredSatisfaction = "satisfied" | "neutral" | "frustrated" | "abandoned";

export const SATISFACTION_META: Record<InferredSatisfaction, { label: string; color: string; icon: string }> = {
  satisfied:  { label: "Satisfied",  color: "#22c55e", icon: "✓" },
  neutral:    { label: "Neutral",    color: "#71717a", icon: "—" },
  frustrated: { label: "Frustrated", color: "#f59e0b", icon: "!" },
  abandoned:  { label: "Abandoned",  color: "#ef4444", icon: "✗" },
};

// ─── Quality Score Types ───────────────────────────────────────────────────────

export interface QualityScores {
  helpfulness:  number;
  relevance:    number;
  accuracy:     number;
  naturalness:  number;
  safety:       number;
  coherence:    number;
  satisfaction: number;
  overall:      number;
}

export interface MockConversation {
  id:                    string;
  timestamp:             string;
  intent:                string;
  user_id:               string;
  model_version:         "v2.0" | "v2.1";
  scores:                QualityScores;
  satisfaction_signals:  SatisfactionSignal[];
  inferred_satisfaction: InferredSatisfaction;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INTENTS = [
  "research_question", "code_help", "writing_task", "analysis", "brainstorming",
  "debug_error", "explain_concept", "connect_api", "data_analysis", "summarization",
] as const;

// ─── Seeded RNG (xorshift32) ──────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = ((seed ^ 0x9e3779b9) >>> 0) || 1;
  return (): number => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function ri(rng: () => number, lo: number, hi: number): number {
  return Math.round(lo + rng() * (hi - lo));
}

// ─── Composite Score ──────────────────────────────────────────────────────────

function computeOverall(s: Omit<QualityScores, "overall">): number {
  return Math.round(
    0.25 * s.helpfulness  +
    0.20 * s.relevance    +
    0.20 * s.accuracy     +
    0.15 * s.coherence    +
    0.10 * s.satisfaction +
    0.05 * s.naturalness  +
    0.05 * s.safety,
  );
}

// ─── Satisfaction Inference ───────────────────────────────────────────────────

function inferSatisfaction(signals: SatisfactionSignal[]): InferredSatisfaction {
  const has = (k: SatisfactionSignal) => signals.includes(k);
  if (has("abandonment")) return "abandoned";
  if (has("escalation_request") || has("retry_pattern")) return "frustrated";
  if (has("rephrasing") && !has("gratitude") && !has("deepening") && !has("quick_followup")) return "frustrated";
  if (has("gratitude") || has("deepening") || has("quick_followup")) return "satisfied";
  if (has("message_shortening")) return "neutral";
  return "neutral";
}

// ─── Generator ────────────────────────────────────────────────────────────────

type SignalRule = { key: SatisfactionSignal; prob: number };

type ProfileDef = {
  count:   number;
  gen:     (r: () => number) => Omit<QualityScores, "overall">;
  signals: SignalRule[];
};

const PROFILES: ProfileDef[] = [
  // ① High quality — all dims 70–95
  { count: 200,
    gen: (r) => ({
      helpfulness: ri(r, 70, 95), relevance: ri(r, 70, 95), accuracy: ri(r, 72, 95),
      naturalness: ri(r, 65, 95), safety: ri(r, 80, 100),   coherence: ri(r, 70, 95),
      satisfaction: ri(r, 70, 95),
    }),
    signals: [
      { key: "gratitude",      prob: 0.80 },
      { key: "quick_followup", prob: 0.40 },
      { key: "deepening",      prob: 0.50 },
    ],
  },
  // ② Partial failures — helpfulness 30–50
  { count: 120,
    gen: (r) => ({
      helpfulness: ri(r, 30, 50), relevance: ri(r, 60, 80), accuracy: ri(r, 60, 80),
      naturalness: ri(r, 60, 80), safety: ri(r, 70, 95),   coherence: ri(r, 60, 80),
      satisfaction: ri(r, 35, 55),
    }),
    signals: [
      { key: "message_shortening", prob: 0.25 },
      { key: "rephrasing",         prob: 0.20 },
    ],
  },
  // ③ Hard failures — relevance + accuracy 15–40
  { count: 80,
    gen: (r) => ({
      helpfulness: ri(r, 20, 50), relevance: ri(r, 15, 40), accuracy: ri(r, 15, 40),
      naturalness: ri(r, 50, 75), safety: ri(r, 65, 90),   coherence: ri(r, 40, 65),
      satisfaction: ri(r, 20, 45),
    }),
    signals: [
      { key: "abandonment",        prob: 0.60 },
      { key: "retry_pattern",      prob: 0.45 },
      { key: "rephrasing",         prob: 0.35 },
      { key: "escalation_request", prob: 0.15 },
    ],
  },
  // ④ Coherence failures — coherence 20–40
  { count: 60,
    gen: (r) => ({
      helpfulness: ri(r, 45, 70), relevance: ri(r, 55, 75), accuracy: ri(r, 50, 70),
      naturalness: ri(r, 50, 75), safety: ri(r, 70, 95),   coherence: ri(r, 20, 40),
      satisfaction: ri(r, 40, 65),
    }),
    signals: [
      { key: "rephrasing",         prob: 0.50 },
      { key: "message_shortening", prob: 0.30 },
      { key: "retry_pattern",      prob: 0.20 },
    ],
  },
  // ⑤ Safety flags — safety < 40
  { count: 30,
    gen: (r) => ({
      helpfulness: ri(r, 50, 80), relevance: ri(r, 55, 80), accuracy: ri(r, 50, 75),
      naturalness: ri(r, 50, 80), safety: ri(r, 10, 38),   coherence: ri(r, 55, 75),
      satisfaction: ri(r, 30, 60),
    }),
    signals: [
      { key: "escalation_request", prob: 0.25 },
      { key: "rephrasing",         prob: 0.20 },
      { key: "abandonment",        prob: 0.15 },
    ],
  },
  // ⑥ Perfect — all dims 90+
  { count: 10,
    gen: (r) => ({
      helpfulness: ri(r, 91, 100), relevance: ri(r, 91, 100), accuracy: ri(r, 90, 100),
      naturalness: ri(r, 90, 100), safety: ri(r, 95, 100),    coherence: ri(r, 90, 100),
      satisfaction: ri(r, 90, 100),
    }),
    signals: [
      { key: "gratitude",      prob: 0.95 },
      { key: "quick_followup", prob: 0.60 },
      { key: "deepening",      prob: 0.70 },
    ],
  },
];

function buildConversations(): MockConversation[] {
  const now = Date.now();
  const convos: MockConversation[] = [];
  let idx = 0;

  for (const p of PROFILES) {
    for (let i = 0; i < p.count; i++) {
      const rng = makeRng(idx * 31337 + 9001);
      const dims = p.gen(rng);
      const overall = computeOverall(dims);
      const msAgo = rng() * 29 * 86400000;
      const ts = new Date(now - msAgo);
      const intent        = INTENTS[Math.floor(rng() * INTENTS.length)];
      const user_id       = `user-${String(Math.floor(rng() * 150)).padStart(3, "0")}`;
      const model_version = rng() > 0.48 ? "v2.1" : "v2.0" as "v2.0" | "v2.1";

      // Signal generation (after all existing rng calls — does not alter above values)
      const signals: SatisfactionSignal[] = [];
      for (const rule of p.signals) {
        if (rng() < rule.prob) signals.push(rule.key);
      }
      const inferred_satisfaction = inferSatisfaction(signals);

      convos.push({
        id:                    `mock-${String(idx).padStart(4, "0")}`,
        timestamp:             ts.toISOString(),
        intent,
        user_id,
        model_version,
        scores:                { ...dims, overall },
        satisfaction_signals:  signals,
        inferred_satisfaction,
      });
      idx++;
    }
  }

  convos.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return convos;
}

export const MOCK_CONVERSATIONS: MockConversation[] = buildConversations();

// ─── Utility: derive dimensions from a real quality_score + id ────────────────

function hashStr(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function computeDimensionsFromScore(qualityScore: number, convId: string): QualityScores {
  const rng = makeRng(hashStr(convId));
  const spread = (f: number) =>
    Math.max(0, Math.min(100, Math.round(qualityScore + (rng() - 0.5) * f)));

  const helpfulness  = spread(30);
  const relevance    = spread(28);
  const accuracy     = spread(26);
  const coherence    = spread(28);
  const satisfaction = spread(24);
  const naturalness  = spread(20);
  const safety       = Math.max(0, Math.min(100, Math.round(82 + (rng() - 0.5) * 24)));

  return { helpfulness, relevance, accuracy, naturalness, safety, coherence, satisfaction, overall: qualityScore };
}

// ─── Utility: derive satisfaction from a real quality_score + id ──────────────

export function computeSatisfactionFromScore(
  qualityScore: number,
  convId: string,
): { signals: SatisfactionSignal[]; inferred: InferredSatisfaction } {
  const rng    = makeRng(hashStr(convId) ^ 0xf00ba7);
  const isHigh = qualityScore >= 70;
  const isMid  = qualityScore >= 40 && qualityScore < 70;
  const isLow  = qualityScore < 40;
  const signals: SatisfactionSignal[] = [];

  if (isHigh) {
    if (rng() < 0.75) signals.push("gratitude");
    if (rng() < 0.40) signals.push("quick_followup");
    if (rng() < 0.45) signals.push("deepening");
  }
  if (isMid) {
    if (rng() < 0.22) signals.push("rephrasing");
    if (rng() < 0.18) signals.push("message_shortening");
    if (rng() < 0.08) signals.push("gratitude");
  }
  if (isLow) {
    if (rng() < 0.55) signals.push("abandonment");
    if (rng() < 0.40) signals.push("retry_pattern");
    if (rng() < 0.32) signals.push("rephrasing");
    if (rng() < 0.12) signals.push("escalation_request");
  }

  return { signals, inferred: inferSatisfaction(signals) };
}

// ─── Helper: dimension score → colour ────────────────────────────────────────
export function dimColor(score: number | null): string {
  if (score === null) return "#3f3f46";
  if (score > 70) return "#22c55e";
  if (score > 40) return "#eab308";
  return "#ef4444";
}
