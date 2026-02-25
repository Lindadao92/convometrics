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
  frustrated: { label: "Frustrated", color: "#f97316", icon: "!" },
  abandoned:  { label: "Abandoned",  color: "#ef4444", icon: "✗" },
};

// ─── Failure Taxonomy ──────────────────────────────────────────────────────────

export const FAILURE_TYPES = [
  { key: "tone_break",           icon: "🎭", label: "Tone Break",           description: "AI's emotional tone didn't match the context",                  color: "#ec4899" },
  { key: "context_loss",         icon: "🧠", label: "Context Loss",         description: "AI forgot something user said earlier",                         color: "#8b5cf6" },
  { key: "loop",                 icon: "🔄", label: "Loop",                 description: "AI repeated itself or got stuck",                               color: "#3b82f6" },
  { key: "character_break",      icon: "🎪", label: "Character Break",      description: "AI dropped persona and reverted to generic assistant mode",      color: "#d946ef" },
  { key: "hallucination",        icon: "💭", label: "Hallucination",        description: "AI generated factually incorrect claims",                        color: "#ef4444" },
  { key: "misunderstanding",     icon: "🎯", label: "Misunderstanding",     description: "AI interpreted user's intent incorrectly",                       color: "#f59e0b" },
  { key: "refusal_failure",      icon: "🚫", label: "Refusal Failure",      description: "AI refused legitimate request or failed to refuse bad one",      color: "#f97316" },
  { key: "abandonment_trigger",  icon: "🚪", label: "Abandonment Trigger",  description: "Specific turn where user disengaged",                            color: "#6b7280" },
  // ── Segment-specific failure types (support, tutor) ─────────────────────────
  { key: "escalation_needed",      icon: "📞", label: "Escalation Needed",      description: "Issue required human agent but AI failed to escalate",                      color: "#06b6d4" },
  { key: "giving_answer_directly", icon: "📖", label: "Gave Answer Directly",   description: "AI answered directly instead of guiding the learner to discover",           color: "#f59e0b" },
  { key: "too_advanced",           icon: "📈", label: "Too Advanced",           description: "Explanation was above the learner's current level",                          color: "#8b5cf6" },
  { key: "too_simple",             icon: "📉", label: "Too Simple",             description: "Response was below the learner's level",                                     color: "#06b6d4" },
  { key: "wrong_explanation",      icon: "❌", label: "Wrong Explanation",      description: "AI provided an incorrect conceptual or factual explanation",                 color: "#ef4444" },
] as const;

export type FailureType = typeof FAILURE_TYPES[number]["key"];

export interface FailureTag {
  type:   FailureType;
  turn:   number;
  detail: string;
}

// Companion-focused failure weights (must sum to 1.0)
const FAILURE_WEIGHTS: { key: FailureType; cumulative: number }[] = [
  { key: "tone_break",          cumulative: 0.26 },
  { key: "context_loss",        cumulative: 0.48 },
  { key: "loop",                cumulative: 0.64 },
  { key: "character_break",     cumulative: 0.76 },
  { key: "hallucination",       cumulative: 0.86 },
  { key: "misunderstanding",    cumulative: 0.94 },
  { key: "refusal_failure",     cumulative: 0.98 },
  { key: "abandonment_trigger", cumulative: 1.00 },
];

// Companion-focused failure detail bank
const FAILURE_DETAILS: Record<string, string[]> = {
  tone_break: [
    "AI responded cheerfully when user described feeling overwhelmed and alone",
    "Companion used humor during an emotional support session about a difficult breakup",
    "AI suggested 'look on the bright side' when user needed validation first",
    "Tone shifted to formal/clinical when user was being emotionally vulnerable",
    "AI added unsolicited life advice when user just wanted to be heard",
  ],
  context_loss: [
    "AI forgot the user's name and backstory established earlier in the conversation",
    "Character forgot established plot details and reintroduced resolved conflict",
    "AI re-asked about the user's situation after they'd shared it in detail",
    "Companion forgot the emotional context set at the start of the session",
    "AI ignored the ongoing narrative the user had been building over multiple turns",
  ],
  loop: [
    "AI kept offering the same three coping strategies across different phrasings",
    "Companion repeated 'I hear you' without moving the conversation forward",
    "AI looped back to the same question the user had already answered",
    "Repetitive empathy phrases without genuine progression or new insight",
    "AI gave the same roleplay response verbatim after user asked for variation",
  ],
  character_break: [
    "Medieval knight character suddenly said 'As an AI language model, I cannot...'",
    "Anime character dropped Japanese honorifics and started using corporate English",
    "Romantic partner character broke into bullet-pointed advice format mid-conversation",
    "Character referenced 'my training data' while in the middle of a story scene",
    "Fantasy wizard suddenly offered to 'help with any other questions' like a chatbot",
  ],
  hallucination: [
    "AI cited a non-existent study about mental health in an advice session",
    "Companion stated incorrect medical information presented as fact",
    "AI invented a historical event during a learning exploration session",
    "Character confidently provided wrong career salary data in an advice session",
    "AI fabricated a scientific explanation during a philosophical discussion",
  ],
  misunderstanding: [
    "AI read a playful tone as distress and responded with crisis resources",
    "Companion took ironic statement literally and responded out of context",
    "AI confused 'I need space' as a literal request instead of emotional need",
    "Companion interpreted emotional sharing as a request for solutions",
    "AI misread the emotional register of the user's message",
  ],
  refusal_failure: [
    "AI refused to continue a fantasy battle scene citing 'violence concerns'",
    "Character refused a creative storytelling prompt that was clearly fiction",
    "AI added excessive disclaimers to a benign roleplay scenario",
    "Character broke scene to lecture about the difference between fiction and reality",
    "AI refused to play a villain character role the user had specifically requested",
  ],
  abandonment_trigger: [
    "User stopped responding after AI gave formulaic empathy response",
    "User disengaged when companion failed to acknowledge the core emotion",
    "Conversation ended after AI pivoted to advice instead of listening",
    "User left when AI's response felt scripted rather than genuine",
    "Session abandoned after AI repeated a misunderstanding for the fourth time",
  ],
  // fallbacks for segment-specific types (support/tutor)
  escalation_needed: ["Issue required human escalation"],
  giving_answer_directly: ["AI gave the answer without guiding discovery"],
  too_advanced: ["Explanation was above the learner's level"],
  too_simple: ["Response was below the learner's level"],
  wrong_explanation: ["AI provided an incorrect explanation"],
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

export type ModelVersion = "Brainiac" | "Prime" | "Flash";
export type CharacterType = "Anime/Fiction" | "Original Character" | "Celebrity" | "Therapist/Advisor" | "Romantic Partner" | "Historical Figure" | "Game Character";
export type SessionStatus = "Deep" | "Normal" | "Brief" | "Abandoned";

export interface MockConversation {
  id:                    string;
  timestamp:             string;
  intent:                string;
  user_id:               string;
  model_version:         ModelVersion;
  character_type:        CharacterType;
  turns:                 number;
  session_status:        SessionStatus;
  scores:                QualityScores;
  satisfaction_signals:  SatisfactionSignal[];
  inferred_satisfaction: InferredSatisfaction;
  failure_tags:          FailureTag[];
}

// ─── Intent Distribution ─────────────────────────────────────────────────────

// Weighted intent selection: { intent, cumulative weight, target avg quality }
const INTENT_DIST: { intent: string; cumulative: number; avgQ: number }[] = [
  { intent: "roleplay",                cumulative: 0.28, avgQ: 72 },
  { intent: "emotional_support",       cumulative: 0.46, avgQ: 65 },
  { intent: "casual_chat",             cumulative: 0.61, avgQ: 76 },
  { intent: "creative_storytelling",   cumulative: 0.73, avgQ: 74 },
  { intent: "advice_seeking",          cumulative: 0.81, avgQ: 59 },
  { intent: "companionship",           cumulative: 0.88, avgQ: 71 },
  { intent: "humor_entertainment",     cumulative: 0.93, avgQ: 77 },
  { intent: "learning_exploration",    cumulative: 0.97, avgQ: 63 },
  { intent: "philosophical_discussion", cumulative: 1.00, avgQ: 70 },
];

export const INTENTS = INTENT_DIST.map(d => d.intent);

// ─── Character Type Distribution ──────────────────────────────────────────────

const CHAR_TYPE_DIST: { type: CharacterType; cumulative: number }[] = [
  { type: "Anime/Fiction",       cumulative: 0.35 },
  { type: "Original Character",  cumulative: 0.60 },
  { type: "Celebrity",           cumulative: 0.75 },
  { type: "Therapist/Advisor",   cumulative: 0.85 },
  { type: "Romantic Partner",    cumulative: 0.93 },
  { type: "Historical Figure",   cumulative: 0.97 },
  { type: "Game Character",      cumulative: 1.00 },
];

// ─── Model Distribution ──────────────────────────────────────────────────────

// Brainiac 30%, Prime 45%, Flash 25%
const MODEL_DIST: { model: ModelVersion; cumulative: number }[] = [
  { model: "Brainiac", cumulative: 0.30 },
  { model: "Prime",    cumulative: 0.75 },
  { model: "Flash",    cumulative: 1.00 },
];

// ─── Seeded RNG (xorshift32) ──────────────────────────────────────────────────

export function makeRng(seed: number) {
  let s = ((seed ^ 0x9e3779b9) >>> 0) || 1;
  return (): number => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

export function ri(rng: () => number, lo: number, hi: number): number {
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

// ─── Turn Count Generation ───────────────────────────────────────────────────
// Distribution: 1-5 turns (10%), 6-15 (25%), 16-30 (30%), 31-50 (20%), 51-120 (15%)

function genTurns(rng: () => number): number {
  const r = rng();
  if (r < 0.10) return ri(rng, 3, 5);
  if (r < 0.35) return ri(rng, 6, 15);
  if (r < 0.65) return ri(rng, 16, 30);
  if (r < 0.85) return ri(rng, 31, 50);
  return ri(rng, 51, 120);
}

// ─── Session Status from turns + satisfaction ────────────────────────────────

function sessionStatus(turns: number, satisfaction: InferredSatisfaction): SessionStatus {
  if (satisfaction === "abandoned" || turns < 3) return "Abandoned";
  if (turns >= 30) return "Deep";
  if (turns >= 10) return "Normal";
  return "Brief";
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

// ─── Weighted Selection Helpers ──────────────────────────────────────────────

function pickIntent(rng: () => number): string {
  const r = rng();
  for (const d of INTENT_DIST) {
    if (r < d.cumulative) return d.intent;
  }
  return INTENT_DIST[INTENT_DIST.length - 1].intent;
}

function pickCharacterType(rng: () => number): CharacterType {
  const r = rng();
  for (const d of CHAR_TYPE_DIST) {
    if (r < d.cumulative) return d.type;
  }
  return CHAR_TYPE_DIST[CHAR_TYPE_DIST.length - 1].type;
}

function pickModel(rng: () => number): ModelVersion {
  const r = rng();
  for (const d of MODEL_DIST) {
    if (r < d.cumulative) return d.model;
  }
  return MODEL_DIST[MODEL_DIST.length - 1].model;
}

// ─── Intent-Aware Quality Adjustment ─────────────────────────────────────────
// Shifts the base quality score toward the intent's target average

function intentQualityBias(baseOverall: number, intent: string, rng: () => number): number {
  const target = INTENT_DIST.find(d => d.intent === intent)?.avgQ ?? 69;
  // Blend: 60% base profile, 40% intent target + noise
  const blended = baseOverall * 0.6 + target * 0.4 + (rng() - 0.5) * 10;
  return Math.max(0, Math.min(100, Math.round(blended)));
}

// ─── Model Quality Adjustment ────────────────────────────────────────────────
// Brainiac +4, Prime 0, Flash -5

function modelQualityShift(model: ModelVersion): number {
  if (model === "Brainiac") return 4;
  if (model === "Flash") return -5;
  return 0;
}

// ─── Generator ────────────────────────────────────────────────────────────────

type SignalRule = { key: SatisfactionSignal; prob: number };

type ProfileDef = {
  count:   number;
  gen:     (r: () => number) => Omit<QualityScores, "overall">;
  signals: SignalRule[];
};

const PROFILES: ProfileDef[] = [
  // ① High quality — natural companion sessions
  { count: 200,
    gen: (r) => ({
      helpfulness: ri(r, 70, 95), relevance: ri(r, 70, 95), accuracy: ri(r, 62, 88),
      naturalness: ri(r, 75, 97), safety: ri(r, 80, 100),   coherence: ri(r, 72, 95),
      satisfaction: ri(r, 70, 95),
    }),
    signals: [
      { key: "gratitude",      prob: 0.80 },
      { key: "quick_followup", prob: 0.40 },
      { key: "deepening",      prob: 0.55 },
    ],
  },
  // ② Good sessions — minor friction
  { count: 150,
    gen: (r) => ({
      helpfulness: ri(r, 58, 78), relevance: ri(r, 55, 78), accuracy: ri(r, 50, 72),
      naturalness: ri(r, 62, 85), safety: ri(r, 72, 95),   coherence: ri(r, 58, 80),
      satisfaction: ri(r, 55, 78),
    }),
    signals: [
      { key: "gratitude",      prob: 0.55 },
      { key: "deepening",      prob: 0.35 },
      { key: "quick_followup", prob: 0.30 },
      { key: "message_shortening", prob: 0.12 },
    ],
  },
  // ③ Tone/naturalness failures — character feels off
  { count: 80,
    gen: (r) => ({
      helpfulness: ri(r, 48, 68), relevance: ri(r, 52, 72), accuracy: ri(r, 45, 68),
      naturalness: ri(r, 18, 48), safety: ri(r, 68, 90),   coherence: ri(r, 50, 72),
      satisfaction: ri(r, 38, 60),
    }),
    signals: [
      { key: "message_shortening", prob: 0.50 },
      { key: "rephrasing",         prob: 0.38 },
    ],
  },
  // ④ Coherence/context failures — forgot backstory
  { count: 60,
    gen: (r) => ({
      helpfulness: ri(r, 45, 68), relevance: ri(r, 48, 70), accuracy: ri(r, 42, 65),
      naturalness: ri(r, 55, 78), safety: ri(r, 70, 92),   coherence: ri(r, 18, 42),
      satisfaction: ri(r, 40, 62),
    }),
    signals: [
      { key: "rephrasing",         prob: 0.55 },
      { key: "retry_pattern",      prob: 0.25 },
      { key: "message_shortening", prob: 0.28 },
    ],
  },
  // ⑤ Hard failures — bad experience
  { count: 50,
    gen: (r) => ({
      helpfulness: ri(r, 20, 48), relevance: ri(r, 22, 50), accuracy: ri(r, 18, 45),
      naturalness: ri(r, 28, 55), safety: ri(r, 62, 88),   coherence: ri(r, 25, 52),
      satisfaction: ri(r, 18, 42),
    }),
    signals: [
      { key: "abandonment",        prob: 0.58 },
      { key: "retry_pattern",      prob: 0.42 },
      { key: "rephrasing",         prob: 0.35 },
      { key: "escalation_request", prob: 0.15 },
    ],
  },
  // ⑥ Safety concerns
  { count: 25,
    gen: (r) => ({
      helpfulness: ri(r, 45, 75), relevance: ri(r, 50, 78), accuracy: ri(r, 45, 72),
      naturalness: ri(r, 48, 78), safety: ri(r, 8, 35),    coherence: ri(r, 50, 75),
      satisfaction: ri(r, 28, 55),
    }),
    signals: [
      { key: "escalation_request", prob: 0.25 },
      { key: "rephrasing",         prob: 0.18 },
      { key: "abandonment",        prob: 0.15 },
    ],
  },
  // ⑦ Perfect sessions — deep engagement
  { count: 10,
    gen: (r) => ({
      helpfulness: ri(r, 90, 100), relevance: ri(r, 90, 100), accuracy: ri(r, 85, 100),
      naturalness: ri(r, 92, 100), safety: ri(r, 95, 100),    coherence: ri(r, 90, 100),
      satisfaction: ri(r, 92, 100),
    }),
    signals: [
      { key: "gratitude",      prob: 0.95 },
      { key: "quick_followup", prob: 0.65 },
      { key: "deepening",      prob: 0.80 },
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
      const baseOverall = computeOverall(dims);

      const intent         = pickIntent(rng);
      const character_type = pickCharacterType(rng);
      const model_version  = pickModel(rng);
      const user_id        = `user-${String(Math.floor(rng() * 200)).padStart(3, "0")}`;

      // Apply intent and model quality adjustments
      const shift = modelQualityShift(model_version);
      const adjustedOverall = Math.max(0, Math.min(100,
        intentQualityBias(baseOverall, intent, rng) + shift
      ));

      // Re-scale dimensions to match adjusted overall
      const scale = baseOverall > 0 ? adjustedOverall / baseOverall : 1;
      const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v * scale)));
      const adjustedDims = {
        helpfulness:  clamp(dims.helpfulness),
        relevance:    clamp(dims.relevance),
        accuracy:     clamp(dims.accuracy),
        naturalness:  clamp(dims.naturalness),
        safety:       Math.max(0, Math.min(100, Math.round(dims.safety + shift))),
        coherence:    clamp(dims.coherence),
        satisfaction: clamp(dims.satisfaction),
      };

      const msAgo = rng() * 29 * 86400000;
      const ts = new Date(now - msAgo);

      const turns = genTurns(rng);

      // Signal generation
      const signals: SatisfactionSignal[] = [];
      for (const rule of p.signals) {
        if (rng() < rule.prob) signals.push(rule.key);
      }
      const inferred_satisfaction = inferSatisfaction(signals);

      const session_status = sessionStatus(turns, inferred_satisfaction);

      // Failure tag generation — independent RNG
      const frng = makeRng(idx * 31337 + 4242);
      const isFailed = adjustedOverall < 65 || Object.values(adjustedDims).some((v) => v < 40);
      const failure_tags: FailureTag[] = [];
      if (isFailed) {
        const numFailures = frng() < 0.25 ? 2 : 1;
        const picked = new Set<FailureType>();
        for (let f = 0; f < numFailures; f++) {
          const roll = frng();
          for (const { key, cumulative } of FAILURE_WEIGHTS) {
            if (roll < cumulative && !picked.has(key)) {
              picked.add(key);
              const details = FAILURE_DETAILS[key] ?? ["AI failed unexpectedly"];
              const detailIdx = Math.floor(frng() * details.length);
              const failTurn = Math.min(turns, Math.floor(frng() * Math.min(turns, 30)) + 2);
              failure_tags.push({ type: key, turn: failTurn, detail: details[detailIdx] });
              break;
            }
          }
        }
      }

      convos.push({
        id:                    `mock-${String(idx).padStart(4, "0")}`,
        timestamp:             ts.toISOString(),
        intent,
        user_id,
        model_version,
        character_type,
        turns,
        session_status,
        scores:                { ...adjustedDims, overall: adjustedOverall },
        satisfaction_signals:  signals,
        inferred_satisfaction,
        failure_tags,
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

// ─── Utility: derive failure tags from a real quality_score + id ──────────────

export function computeFailuresFromScore(qualityScore: number, convId: string): FailureTag[] {
  if (qualityScore >= 65) return [];
  const rng = makeRng(hashStr(convId) ^ 0xdeadbeef);
  const numFailures = rng() < 0.25 ? 2 : 1;
  const picked = new Set<FailureType>();
  const tags: FailureTag[] = [];
  for (let f = 0; f < numFailures; f++) {
    const roll = rng();
    for (const { key, cumulative } of FAILURE_WEIGHTS) {
      if (roll < cumulative && !picked.has(key)) {
        picked.add(key);
        const details = FAILURE_DETAILS[key] ?? ["AI failed unexpectedly"];
        const detailIdx = Math.floor(rng() * details.length);
        const turn = Math.floor(rng() * 20) + 2;
        tags.push({ type: key, turn, detail: details[detailIdx] });
        break;
      }
    }
  }
  return tags;
}

// ─── Helper: dimension score → colour ────────────────────────────────────────
export function dimColor(score: number | null): string {
  if (score === null) return "#3f3f46";
  if (score > 75) return "#22c55e";
  if (score > 55) return "#eab308";
  if (score > 40) return "#f97316";
  return "#ef4444";
}
