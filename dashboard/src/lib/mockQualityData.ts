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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  id:            string;
  timestamp:     string;
  intent:        string;
  user_id:       string;
  model_version: "v2.0" | "v2.1";
  scores:        QualityScores;
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

// ─── Generator ────────────────────────────────────────────────────────────────

type ProfileDef = {
  count: number;
  gen: (r: () => number) => Omit<QualityScores, "overall">;
};

const PROFILES: ProfileDef[] = [
  // ① High quality — all dims 70–95, overall 75–90
  { count: 200, gen: (r) => ({
    helpfulness:  ri(r, 70, 95), relevance:    ri(r, 70, 95), accuracy:     ri(r, 72, 95),
    naturalness:  ri(r, 65, 95), safety:       ri(r, 80, 100), coherence:    ri(r, 70, 95),
    satisfaction: ri(r, 70, 95),
  }) },
  // ② Partial failures — helpfulness 30–50, others 60–80
  { count: 120, gen: (r) => ({
    helpfulness:  ri(r, 30, 50), relevance:    ri(r, 60, 80), accuracy:     ri(r, 60, 80),
    naturalness:  ri(r, 60, 80), safety:       ri(r, 70, 95), coherence:    ri(r, 60, 80),
    satisfaction: ri(r, 35, 55),
  }) },
  // ③ Hard failures — relevance + accuracy 15–40
  { count: 80, gen: (r) => ({
    helpfulness:  ri(r, 20, 50), relevance:    ri(r, 15, 40), accuracy:     ri(r, 15, 40),
    naturalness:  ri(r, 50, 75), safety:       ri(r, 65, 90), coherence:    ri(r, 40, 65),
    satisfaction: ri(r, 20, 45),
  }) },
  // ④ Coherence failures — coherence 20–40, others mixed
  { count: 60, gen: (r) => ({
    helpfulness:  ri(r, 45, 70), relevance:    ri(r, 55, 75), accuracy:     ri(r, 50, 70),
    naturalness:  ri(r, 50, 75), safety:       ri(r, 70, 95), coherence:    ri(r, 20, 40),
    satisfaction: ri(r, 40, 65),
  }) },
  // ⑤ Safety flags — safety < 40
  { count: 30, gen: (r) => ({
    helpfulness:  ri(r, 50, 80), relevance:    ri(r, 55, 80), accuracy:     ri(r, 50, 75),
    naturalness:  ri(r, 50, 80), safety:       ri(r, 10, 38), coherence:    ri(r, 55, 75),
    satisfaction: ri(r, 30, 60),
  }) },
  // ⑥ Perfect — all dims 90+
  { count: 10, gen: (r) => ({
    helpfulness:  ri(r, 91, 100), relevance:    ri(r, 91, 100), accuracy:     ri(r, 90, 100),
    naturalness:  ri(r, 90, 100), safety:       ri(r, 95, 100), coherence:    ri(r, 90, 100),
    satisfaction: ri(r, 90, 100),
  }) },
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
      // Spread across last 29 days (a few convos land exactly on today)
      const msAgo = rng() * 29 * 86400000;
      const ts = new Date(now - msAgo);

      convos.push({
        id:            `mock-${String(idx).padStart(4, "0")}`,
        timestamp:     ts.toISOString(),
        intent:        INTENTS[Math.floor(rng() * INTENTS.length)],
        user_id:       `user-${String(Math.floor(rng() * 150)).padStart(3, "0")}`,
        model_version: rng() > 0.48 ? "v2.1" : "v2.0",
        scores:        { ...dims, overall },
      });
      idx++;
    }
  }

  // Sort newest first
  convos.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return convos;
}

export const MOCK_CONVERSATIONS: MockConversation[] = buildConversations();

// ─── Utility: derive dimension scores from a real quality_score + id ──────────
// Used client-side to attach consistent fake dimensions to Supabase conversations.

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

// ─── Helper: score → colour ───────────────────────────────────────────────────
export function dimColor(score: number | null): string {
  if (score === null) return "#3f3f46";
  if (score > 70) return "#22c55e";
  if (score > 40) return "#eab308";
  return "#ef4444";
}
