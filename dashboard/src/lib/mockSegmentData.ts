// ─── Per-segment mock conversation generator ───────────────────────────────────
// AI Assistant  → uses existing MOCK_CONVERSATIONS from mockQualityData.ts
// AI Companion  → 300 conversations, naturalness/coherence focused, center ~65
// AI Support    → 300 conversations, helpfulness/accuracy focused, center ~71
// AI Tutor      → 300 conversations, guidance-focused, center ~69

import {
  MockConversation, FailureTag, FailureType, SatisfactionSignal, InferredSatisfaction,
  makeRng, ri, MOCK_CONVERSATIONS, FAILURE_TYPES,
} from "./mockQualityData";
import { DemoSegment } from "./demo-mode-context";

// ─── Segment metadata ──────────────────────────────────────────────────────────

export interface SegmentMeta {
  key: DemoSegment;
  name: string;
  emoji: string;
  description: string;
  keyInsight: string;
  briefing: string[];
  intents: string[];
  failureTypes: FailureType[];
  dimensionEmphasis: string; // human-readable note
}

export const SEGMENT_META: Record<DemoSegment, SegmentMeta> = {
  ai_assistant: {
    key: "ai_assistant",
    name: "AI Assistant",
    emoji: "🤖",
    description: "General-purpose conversational AI for information, coding, writing, and analysis.",
    keyInsight: "Hallucination is the #1 accuracy failure — most frequent in code_help and explain_concept. Brainstorming and writing tasks show the highest satisfaction rates.",
    briefing: [
      "Overall quality stable at 73/100 — helpfulness and accuracy leading dimensions",
      "Hallucination rate up 12% in code-heavy conversations this week",
      "Users in brainstorming sessions stay 40% longer than in debug_error sessions",
    ],
    intents: ["research_question","code_help","writing_task","analysis","brainstorming","debug_error","explain_concept","connect_api","data_analysis","summarization"],
    failureTypes: ["misunderstanding","context_loss","loop","hallucination","tone_break","refusal_failure","abandonment_trigger"],
    dimensionEmphasis: "Balanced — helpfulness (25%) and accuracy (20%) weighted highest",
  },
  ai_companion: {
    key: "ai_companion",
    name: "AI Companion",
    emoji: "💬",
    description: "Emotionally intelligent AI focused on support, connection, and creative engagement.",
    keyInsight: "Users who have high-quality emotional_support conversations in their first session return at 2.8× the rate of users who start with casual_chat.",
    briefing: [
      "Tone breaks spiked 24% — companion was cheerful during emotional_support sessions",
      "Context loss in roleplay increased as sessions grew longer (>12 turns)",
      "Users who experienced naturalness score >80 had 3.1× longer average sessions",
    ],
    intents: ["emotional_support","roleplay","casual_chat","advice_seeking","creative_storytelling","venting","companionship","humor","philosophical_discussion"],
    failureTypes: ["tone_break","context_loss","loop","abandonment_trigger","misunderstanding"],
    dimensionEmphasis: "Naturalness and coherence matter most; accuracy weighted less than other segments",
  },
  ai_support: {
    key: "ai_support",
    name: "AI Support Agent",
    emoji: "🎧",
    description: "Customer service AI handling billing, technical issues, returns, and account management.",
    keyInsight: "billing_issue has 89% resolution rate but complaint only 34%. Complaint conversations average 3.2 retry patterns per session.",
    briefing: [
      "Misunderstanding rate up 8% in billing_issue — users rephrasing the same question",
      "Escalation rate highest in complaint intent at 41% of failed sessions",
      "Technical problem resolution improved — avg 2.1 turns shorter this week",
    ],
    intents: ["billing_issue","technical_problem","feature_request","account_access","complaint","return_request","shipping_status","upgrade_inquiry","cancellation"],
    failureTypes: ["misunderstanding","context_loss","escalation_needed","loop","abandonment_trigger"],
    dimensionEmphasis: "Helpfulness (25%) and accuracy (20%) are critical; naturalness weighted lower",
  },
  ai_tutor: {
    key: "ai_tutor",
    name: "AI Tutor",
    emoji: "📚",
    description: "Educational AI guiding learners through concepts, practice problems, and exam preparation.",
    keyInsight: "step_by_step_walkthrough has 82% learning success rate vs 41% for homework_help where giving_answer_directly is most frequent. Students learn better when the AI guides instead of tells.",
    briefing: [
      "Giving answers directly is the top failure mode — 31% of poor-quality sessions",
      "Concept explanation quality improved 8pts after recent prompt refinements",
      "Students in exam_prep show the highest engagement (deepening signal: 67%)",
    ],
    intents: ["concept_explanation","practice_problem","homework_help","exam_prep","language_practice","step_by_step_walkthrough","quiz_review","study_planning"],
    failureTypes: ["giving_answer_directly","too_advanced","too_simple","wrong_explanation","misunderstanding"],
    dimensionEmphasis: "Helpfulness and accuracy critical; naturalness matters less than in companion",
  },
};

// ─── Internal helpers ──────────────────────────────────────────────────────────

function inferSatisfaction(signals: SatisfactionSignal[]): InferredSatisfaction {
  const has = (k: SatisfactionSignal) => signals.includes(k);
  if (has("abandonment")) return "abandoned";
  if (has("escalation_request") || has("retry_pattern")) return "frustrated";
  if (has("rephrasing") && !has("gratitude") && !has("deepening") && !has("quick_followup")) return "frustrated";
  if (has("gratitude") || has("deepening") || has("quick_followup")) return "satisfied";
  if (has("message_shortening")) return "neutral";
  return "neutral";
}

function computeOverall(dims: { helpfulness: number; relevance: number; accuracy: number; coherence: number; satisfaction: number; naturalness: number; safety: number }): number {
  return Math.round(
    0.25 * dims.helpfulness + 0.20 * dims.relevance + 0.20 * dims.accuracy +
    0.15 * dims.coherence  + 0.10 * dims.satisfaction + 0.05 * dims.naturalness + 0.05 * dims.safety,
  );
}

// ─── Profile type ──────────────────────────────────────────────────────────────

type DimGen = (r: () => number) => { helpfulness: number; relevance: number; accuracy: number; coherence: number; satisfaction: number; naturalness: number; safety: number };
type SignalRule = { key: SatisfactionSignal; prob: number };
type FailureRule = { key: FailureType; cumulative: number };

interface SegmentProfile {
  count: number;
  gen: DimGen;
  signals: SignalRule[];
  failureWeights: FailureRule[]; // used when conversation is "failed" (overall < 65 or any dim < 40)
}

// ─── Companion profiles ────────────────────────────────────────────────────────

const COMPANION_PROFILES: SegmentProfile[] = [
  // ① Excellent companion sessions
  { count: 15,
    gen: (r) => ({ helpfulness: ri(r,75,92), relevance: ri(r,72,90), accuracy: ri(r,62,82), coherence: ri(r,78,95), satisfaction: ri(r,75,92), naturalness: ri(r,80,97), safety: ri(r,80,100) }),
    signals: [{ key:"gratitude",prob:0.90 },{ key:"deepening",prob:0.78 },{ key:"quick_followup",prob:0.52 }],
    failureWeights: [{ key:"tone_break",cumulative:0.40 },{ key:"context_loss",cumulative:0.65 },{ key:"loop",cumulative:0.85 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ② Good sessions
  { count: 90,
    gen: (r) => ({ helpfulness: ri(r,60,82), relevance: ri(r,58,80), accuracy: ri(r,50,75), coherence: ri(r,62,84), satisfaction: ri(r,58,80), naturalness: ri(r,65,88), safety: ri(r,72,95) }),
    signals: [{ key:"gratitude",prob:0.72 },{ key:"deepening",prob:0.55 },{ key:"quick_followup",prob:0.38 }],
    failureWeights: [{ key:"tone_break",cumulative:0.40 },{ key:"context_loss",cumulative:0.65 },{ key:"loop",cumulative:0.85 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ③ Tone break failures — cheerful when user needs empathy
  { count: 75,
    gen: (r) => ({ helpfulness: ri(r,52,72), relevance: ri(r,55,75), accuracy: ri(r,48,68), coherence: ri(r,52,72), satisfaction: ri(r,40,62), naturalness: ri(r,20,50), safety: ri(r,68,90) }),
    signals: [{ key:"message_shortening",prob:0.55 },{ key:"rephrasing",prob:0.40 }],
    failureWeights: [{ key:"tone_break",cumulative:0.55 },{ key:"context_loss",cumulative:0.78 },{ key:"loop",cumulative:0.92 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ④ Context loss — forgot backstory
  { count: 60,
    gen: (r) => ({ helpfulness: ri(r,48,68), relevance: ri(r,52,72), accuracy: ri(r,45,65), coherence: ri(r,20,45), satisfaction: ri(r,42,62), naturalness: ri(r,55,75), safety: ri(r,68,92) }),
    signals: [{ key:"rephrasing",prob:0.62 },{ key:"retry_pattern",prob:0.28 }],
    failureWeights: [{ key:"context_loss",cumulative:0.50 },{ key:"tone_break",cumulative:0.72 },{ key:"loop",cumulative:0.88 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ⑤ Hard failures
  { count: 45,
    gen: (r) => ({ helpfulness: ri(r,22,50), relevance: ri(r,25,52), accuracy: ri(r,20,48), coherence: ri(r,28,55), satisfaction: ri(r,20,45), naturalness: ri(r,30,58), safety: ri(r,65,88) }),
    signals: [{ key:"abandonment",prob:0.55 },{ key:"retry_pattern",prob:0.45 },{ key:"rephrasing",prob:0.35 }],
    failureWeights: [{ key:"tone_break",cumulative:0.35 },{ key:"context_loss",cumulative:0.60 },{ key:"loop",cumulative:0.80 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ⑥ Very frustrated
  { count: 15,
    gen: (r) => ({ helpfulness: ri(r,15,38), relevance: ri(r,18,42), accuracy: ri(r,15,38), coherence: ri(r,15,40), satisfaction: ri(r,12,35), naturalness: ri(r,20,45), safety: ri(r,62,85) }),
    signals: [{ key:"abandonment",prob:0.80 },{ key:"retry_pattern",prob:0.62 }],
    failureWeights: [{ key:"tone_break",cumulative:0.40 },{ key:"context_loss",cumulative:0.65 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
];

// ─── Support profiles ──────────────────────────────────────────────────────────

const SUPPORT_PROFILES: SegmentProfile[] = [
  // ① Fully resolved
  { count: 120,
    gen: (r) => ({ helpfulness: ri(r,72,92), relevance: ri(r,70,88), accuracy: ri(r,70,88), coherence: ri(r,65,85), satisfaction: ri(r,68,88), naturalness: ri(r,62,82), safety: ri(r,78,98) }),
    signals: [{ key:"gratitude",prob:0.80 },{ key:"quick_followup",prob:0.28 }],
    failureWeights: [{ key:"misunderstanding",cumulative:0.40 },{ key:"context_loss",cumulative:0.68 },{ key:"escalation_needed",cumulative:0.85 },{ key:"loop",cumulative:0.95 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ② Partially resolved
  { count: 90,
    gen: (r) => ({ helpfulness: ri(r,52,70), relevance: ri(r,55,72), accuracy: ri(r,55,72), coherence: ri(r,50,68), satisfaction: ri(r,48,68), naturalness: ri(r,52,70), safety: ri(r,72,92) }),
    signals: [{ key:"message_shortening",prob:0.38 },{ key:"rephrasing",prob:0.28 }],
    failureWeights: [{ key:"misunderstanding",cumulative:0.40 },{ key:"context_loss",cumulative:0.68 },{ key:"escalation_needed",cumulative:0.85 },{ key:"loop",cumulative:0.95 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ③ Escalation needed
  { count: 60,
    gen: (r) => ({ helpfulness: ri(r,35,58), relevance: ri(r,42,62), accuracy: ri(r,40,60), coherence: ri(r,38,58), satisfaction: ri(r,32,55), naturalness: ri(r,48,65), safety: ri(r,68,88) }),
    signals: [{ key:"escalation_request",prob:0.65 },{ key:"retry_pattern",prob:0.42 },{ key:"rephrasing",prob:0.32 }],
    failureWeights: [{ key:"escalation_needed",cumulative:0.42 },{ key:"misunderstanding",cumulative:0.70 },{ key:"context_loss",cumulative:0.88 },{ key:"loop",cumulative:0.96 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
  // ④ Hard failures
  { count: 30,
    gen: (r) => ({ helpfulness: ri(r,20,48), relevance: ri(r,25,50), accuracy: ri(r,25,50), coherence: ri(r,22,48), satisfaction: ri(r,18,42), naturalness: ri(r,40,60), safety: ri(r,65,85) }),
    signals: [{ key:"abandonment",prob:0.52 },{ key:"retry_pattern",prob:0.58 },{ key:"escalation_request",prob:0.32 }],
    failureWeights: [{ key:"misunderstanding",cumulative:0.35 },{ key:"escalation_needed",cumulative:0.65 },{ key:"context_loss",cumulative:0.85 },{ key:"abandonment_trigger",cumulative:1.00 }],
  },
];

// ─── Tutor profiles ────────────────────────────────────────────────────────────

const TUTOR_PROFILES: SegmentProfile[] = [
  // ① Expert guidance
  { count: 15,
    gen: (r) => ({ helpfulness: ri(r,82,95), relevance: ri(r,78,92), accuracy: ri(r,80,95), coherence: ri(r,78,92), satisfaction: ri(r,78,92), naturalness: ri(r,70,88), safety: ri(r,82,100) }),
    signals: [{ key:"deepening",prob:0.82 },{ key:"gratitude",prob:0.72 },{ key:"quick_followup",prob:0.58 }],
    failureWeights: [{ key:"giving_answer_directly",cumulative:0.35 },{ key:"too_advanced",cumulative:0.58 },{ key:"too_simple",cumulative:0.78 },{ key:"wrong_explanation",cumulative:0.92 },{ key:"misunderstanding",cumulative:1.00 }],
  },
  // ② Good tutoring — guided approach
  { count: 90,
    gen: (r) => ({ helpfulness: ri(r,68,88), relevance: ri(r,65,85), accuracy: ri(r,70,90), coherence: ri(r,65,84), satisfaction: ri(r,62,82), naturalness: ri(r,60,80), safety: ri(r,78,96) }),
    signals: [{ key:"deepening",prob:0.62 },{ key:"gratitude",prob:0.60 },{ key:"quick_followup",prob:0.42 }],
    failureWeights: [{ key:"giving_answer_directly",cumulative:0.35 },{ key:"too_advanced",cumulative:0.58 },{ key:"too_simple",cumulative:0.78 },{ key:"wrong_explanation",cumulative:0.92 },{ key:"misunderstanding",cumulative:1.00 }],
  },
  // ③ Gave answer directly (lower helpfulness for guided discovery)
  { count: 75,
    gen: (r) => ({ helpfulness: ri(r,50,68), relevance: ri(r,60,80), accuracy: ri(r,65,85), coherence: ri(r,55,75), satisfaction: ri(r,50,70), naturalness: ri(r,55,75), safety: ri(r,75,92) }),
    signals: [{ key:"quick_followup",prob:0.38 },{ key:"message_shortening",prob:0.22 }],
    failureWeights: [{ key:"giving_answer_directly",cumulative:0.55 },{ key:"too_advanced",cumulative:0.72 },{ key:"too_simple",cumulative:0.86 },{ key:"wrong_explanation",cumulative:0.95 },{ key:"misunderstanding",cumulative:1.00 }],
  },
  // ④ Level mismatch (too advanced or too simple)
  { count: 75,
    gen: (r) => ({ helpfulness: ri(r,45,65), relevance: ri(r,50,70), accuracy: ri(r,52,72), coherence: ri(r,30,55), satisfaction: ri(r,38,60), naturalness: ri(r,48,68), safety: ri(r,72,90) }),
    signals: [{ key:"rephrasing",prob:0.46 },{ key:"message_shortening",prob:0.35 }],
    failureWeights: [{ key:"too_advanced",cumulative:0.32 },{ key:"too_simple",cumulative:0.62 },{ key:"giving_answer_directly",cumulative:0.80 },{ key:"wrong_explanation",cumulative:0.92 },{ key:"misunderstanding",cumulative:1.00 }],
  },
  // ⑤ Wrong explanations
  { count: 45,
    gen: (r) => ({ helpfulness: ri(r,28,55), relevance: ri(r,38,60), accuracy: ri(r,20,50), coherence: ri(r,35,58), satisfaction: ri(r,28,52), naturalness: ri(r,42,65), safety: ri(r,70,88) }),
    signals: [{ key:"retry_pattern",prob:0.45 },{ key:"rephrasing",prob:0.40 }],
    failureWeights: [{ key:"wrong_explanation",cumulative:0.45 },{ key:"giving_answer_directly",cumulative:0.68 },{ key:"too_advanced",cumulative:0.82 },{ key:"misunderstanding",cumulative:0.94 },{ key:"too_simple",cumulative:1.00 }],
  },
];

// ─── Failure detail bank (segment-specific) ────────────────────────────────────

const COMPANION_FAILURE_DETAILS: Partial<Record<FailureType, string[]>> = {
  tone_break: [
    "AI responded cheerfully when user described feeling overwhelmed and alone",
    "Companion used humor during a venting session about a difficult breakup",
    "AI suggested 'look on the bright side' when user needed validation first",
    "Tone shifted to formal/clinical when user was being emotionally vulnerable",
    "AI added unsolicited life advice when user just wanted to be heard",
  ],
  context_loss: [
    "AI forgot the user's name and backstory established two sessions ago",
    "Character in roleplay broke consistency mid-conversation",
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
  abandonment_trigger: [
    "User stopped responding after AI gave formulaic empathy response",
    "User disengaged when companion failed to acknowledge the core emotion",
    "Conversation ended after AI pivoted to advice instead of listening",
    "User left when AI's response felt scripted rather than genuine",
    "Session abandoned after AI repeated a misunderstanding for the fourth time",
  ],
  misunderstanding: [
    "AI read a playful tone as distress and responded with crisis resources",
    "Companion took ironic statement literally and responded out of context",
    "AI confused 'I need space' as a literal request instead of emotional need",
    "Companion interpreted venting as a request for solutions",
    "AI misread the emotional register of the user's message",
  ],
};

const SUPPORT_FAILURE_DETAILS: Partial<Record<FailureType, string[]>> = {
  misunderstanding: [
    "AI addressed a billing question when user was asking about their account plan",
    "AI confused a refund request with an exchange request",
    "Support agent interpreted technical description as a different product issue",
    "AI answered a shipping question instead of the tracking question asked",
    "AI misidentified the product model from the customer's description",
  ],
  context_loss: [
    "AI forgot the order number customer provided in the opening message",
    "Agent re-asked for account verification that was already completed",
    "AI ignored the resolution the customer said they'd already tried",
    "Agent lost track of which item the complaint was about after three turns",
    "AI forgot that the customer had already been transferred once before",
  ],
  escalation_needed: [
    "Customer had been asking for a refund for three weeks — AI kept deferring",
    "AI failed to escalate a billing dispute to the finance team when required",
    "Customer explicitly asked for a supervisor four times without escalation",
    "Complex fraud case needed human review but AI kept attempting self-service",
    "Emotional distress signals clear but AI continued automated flow",
  ],
  loop: [
    "AI kept asking for order number customer had already provided",
    "Support agent offered same FAQ link response three times consecutively",
    "AI entered troubleshooting loop for an issue that needed account access",
    "Agent kept requesting screenshots the customer couldn't take on their device",
    "AI repeated identical resolution steps after customer confirmed they failed",
  ],
  abandonment_trigger: [
    "Customer stopped responding after 35-minute resolution loop with no progress",
    "User abandoned session when AI failed to understand the third description",
    "Customer disengaged after AI's response clearly didn't match their issue",
    "Session ended when AI gave wrong information about return policy",
    "Customer left after escalation was denied despite clear policy eligibility",
  ],
};

const TUTOR_FAILURE_DETAILS: Partial<Record<FailureType, string[]>> = {
  giving_answer_directly: [
    "AI solved the entire practice problem before student could attempt any steps",
    "Complete worked solution provided when student only asked 'where do I start?'",
    "AI answered the homework question directly — no scaffolding or prompts",
    "Student asked for a hint; AI gave the full methodology and result",
    "AI wrote the essay outline instead of guiding the student through brainstorming",
  ],
  too_advanced: [
    "AI introduced epsilon-delta proofs to a student learning limits for the first time",
    "Explanation referenced graduate-level concepts for a high school chemistry question",
    "AI used matrix notation to explain a concept the student hadn't encountered yet",
    "Abstract explanation assumed familiarity with concepts not yet in the curriculum",
    "AI jumped to edge cases and exceptions before the student grasped the core rule",
  ],
  too_simple: [
    "AI explained what a variable is to a computer science student asking about recursion",
    "Student indicated they understood the basics; AI re-explained prerequisites anyway",
    "Condescending simplification of a university-level physics question",
    "AI treated a graduate-level statistics question as a beginner probability problem",
    "Over-scaffolded a student who had explicitly indicated prior mastery",
  ],
  wrong_explanation: [
    "AI stated that photosynthesis produces CO2 instead of O2",
    "Incorrect explanation of the order of operations led to systematic errors",
    "AI described a sorting algorithm with wrong time complexity",
    "Historical dates provided were off by a decade with confident assertion",
    "AI's worked math example contained an arithmetic error in step 2",
  ],
  misunderstanding: [
    "AI taught grammar rules for the wrong language than the one student specified",
    "AI solved a different problem type than the practice problem described",
    "Tutor misunderstood 'help me understand' as 'give me the answer'",
    "AI prepared student for the wrong exam format based on ambiguous question",
    "Tutor confused 'quiz me on chapter 4' with 'explain chapter 4'",
  ],
};

// ─── Core builder ──────────────────────────────────────────────────────────────

function buildSegmentConversations(
  segment: Exclude<DemoSegment, "ai_assistant">,
  profiles: SegmentProfile[],
  intents: string[],
  failureDetails: Partial<Record<FailureType, string[]>>,
  idPrefix: string,
): MockConversation[] {
  const now = Date.now();
  const convos: MockConversation[] = [];
  let idx = 0;

  // Segment-specific default failure details fallback
  const defaultFallback: Record<FailureType, string[]> = {
    misunderstanding: ["AI misinterpreted the user's intent"],
    context_loss: ["AI lost track of context from earlier in the conversation"],
    loop: ["AI repeated a previous response without adding value"],
    hallucination: ["AI generated a factually incorrect claim"],
    tone_break: ["AI's tone was inappropriate for the context"],
    refusal_failure: ["AI refused a legitimate request"],
    abandonment_trigger: ["User disengaged after an unhelpful response"],
    escalation_needed: ["Issue required human escalation"],
    giving_answer_directly: ["AI gave the answer without guiding discovery"],
    too_advanced: ["Explanation was above the learner's level"],
    too_simple: ["Response was below the learner's level"],
    wrong_explanation: ["AI provided an incorrect explanation"],
  };

  const getDetails = (type: FailureType): string[] =>
    failureDetails[type] ?? defaultFallback[type];

  for (const p of profiles) {
    for (let i = 0; i < p.count; i++) {
      const seed = idx * 31337 + 9001 + (segment === "ai_companion" ? 100000 : segment === "ai_support" ? 200000 : 300000);
      const rng = makeRng(seed);
      const dims = p.gen(rng);
      const overall = computeOverall(dims);
      const msAgo = rng() * 29 * 86400000;
      const ts = new Date(now - msAgo);
      const intent = intents[Math.floor(rng() * intents.length)];
      const user_id = `user-${String(Math.floor(rng() * 150)).padStart(3, "0")}`;
      const model_version = rng() > 0.48 ? "v2.1" : "v2.0" as "v2.0" | "v2.1";

      // Satisfaction signals
      const signals: SatisfactionSignal[] = [];
      for (const rule of p.signals) {
        if (rng() < rule.prob) signals.push(rule.key);
      }
      const inferred_satisfaction = inferSatisfaction(signals);

      // Failure tags — independent RNG
      const frng = makeRng(seed + 4242);
      const isFailed = overall < 65 || Object.values(dims).some((v) => v < 40);
      const failure_tags: FailureTag[] = [];
      if (isFailed) {
        const numFailures = frng() < 0.25 ? 2 : 1;
        const picked = new Set<FailureType>();
        for (let f = 0; f < numFailures; f++) {
          const roll = frng();
          for (const { key, cumulative } of p.failureWeights) {
            if (roll < cumulative && !picked.has(key)) {
              picked.add(key);
              const details = getDetails(key);
              const detailIdx = Math.floor(frng() * details.length);
              const turn = Math.floor(frng() * 7) + 2;
              failure_tags.push({ type: key, turn, detail: details[detailIdx] });
              break;
            }
          }
        }
      }

      convos.push({
        id: `${idPrefix}-${String(idx).padStart(4, "0")}`,
        timestamp: ts.toISOString(),
        intent,
        user_id,
        model_version,
        scores: { ...dims, overall },
        satisfaction_signals: signals,
        inferred_satisfaction,
        failure_tags,
      });
      idx++;
    }
  }

  convos.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return convos;
}

// ─── Pre-computed segment datasets ────────────────────────────────────────────

export const COMPANION_CONVERSATIONS: MockConversation[] = buildSegmentConversations(
  "ai_companion",
  COMPANION_PROFILES,
  SEGMENT_META.ai_companion.intents,
  COMPANION_FAILURE_DETAILS,
  "cmp",
);

export const SUPPORT_CONVERSATIONS: MockConversation[] = buildSegmentConversations(
  "ai_support",
  SUPPORT_PROFILES,
  SEGMENT_META.ai_support.intents,
  SUPPORT_FAILURE_DETAILS,
  "sup",
);

export const TUTOR_CONVERSATIONS: MockConversation[] = buildSegmentConversations(
  "ai_tutor",
  TUTOR_PROFILES,
  SEGMENT_META.ai_tutor.intents,
  TUTOR_FAILURE_DETAILS,
  "tut",
);

// ─── Segment data accessors ────────────────────────────────────────────────────

export function getSegmentConversations(segment: string): MockConversation[] {
  switch (segment) {
    case "ai_companion": return COMPANION_CONVERSATIONS;
    case "ai_support":   return SUPPORT_CONVERSATIONS;
    case "ai_tutor":     return TUTOR_CONVERSATIONS;
    default:             return MOCK_CONVERSATIONS;
  }
}

export function getSegmentMeta(segment: string): SegmentMeta {
  return SEGMENT_META[(segment as DemoSegment) in SEGMENT_META ? segment as DemoSegment : "ai_assistant"];
}

export function getSegmentFailureTypes(segment: string) {
  const meta = getSegmentMeta(segment);
  return FAILURE_TYPES.filter((ft) => meta.failureTypes.includes(ft.key as FailureType));
}

// ─── Mock overview stats ───────────────────────────────────────────────────────

export function computeMockOverviewStats(segment: string) {
  const convos = getSegmentConversations(segment);
  const meta = getSegmentMeta(segment);
  const n = convos.length;

  let qualitySum = 0, qualityCount = 0;
  let completedCount = 0, abandonedCount = 0;
  const intentCounts: Record<string, { count: number; qualitySum: number; qualityCount: number; failCount: number; completeCount: number }> = {};
  const qualityBuckets: Record<string, number> = { "0–20": 0, "21–40": 0, "41–60": 0, "61–80": 0, "81–100": 0 };
  const statusCounts: Record<string, number> = {};

  for (const c of convos) {
    const q = c.scores.overall;
    qualitySum += q; qualityCount++;

    // Derive completion status from inferred satisfaction
    const status = c.inferred_satisfaction === "abandoned" ? "abandoned" : c.inferred_satisfaction === "satisfied" ? "completed" : "completed";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (status === "completed") completedCount++;
    if (status === "abandoned") abandonedCount++;

    if (q <= 20) qualityBuckets["0–20"]++;
    else if (q <= 40) qualityBuckets["21–40"]++;
    else if (q <= 60) qualityBuckets["41–60"]++;
    else if (q <= 80) qualityBuckets["61–80"]++;
    else qualityBuckets["81–100"]++;

    intentCounts[c.intent] ??= { count: 0, qualitySum: 0, qualityCount: 0, failCount: 0, completeCount: 0 };
    const ic = intentCounts[c.intent];
    ic.count++;
    ic.qualitySum += q; ic.qualityCount++;
    if (c.failure_tags.length > 0) ic.failCount++;
    if (status === "completed") ic.completeCount++;
  }

  const avgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null;
  const completionRate = n > 0 ? Math.round((completedCount / n) * 1000) / 10 : null;
  const failureRate = n > 0 ? Math.round((abandonedCount / n) * 1000) / 10 : null;

  const intentArr = Object.entries(intentCounts).map(([intent, g]) => ({
    intent, count: g.count,
    avgQuality: g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null,
    completionRate: g.count > 0 ? Math.round((g.completeCount / g.count) * 1000) / 10 : 0,
    failRate: g.count > 0 ? Math.round((g.failCount / g.count) * 1000) / 10 : 0,
  }));

  const topTopic = intentArr.length > 0 ? [...intentArr].sort((a, b) => b.count - a.count)[0].intent : null;

  const topPerformingTopics = intentArr
    .filter((x) => x.avgQuality !== null && x.count >= 3)
    .sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0))
    .slice(0, 3)
    .map(({ intent, avgQuality, count, completionRate }) => ({ intent, avgQuality: avgQuality!, count, completionRate }));

  const worstPerformingTopics = intentArr
    .filter((x) => x.avgQuality !== null && x.count >= 3)
    .sort((a, b) => (a.avgQuality ?? 100) - (b.avgQuality ?? 100))
    .slice(0, 3)
    .map(({ intent, avgQuality, count, failRate }) => ({ intent, avgQuality: avgQuality!, count, failRate }));

  const healthScore = avgQuality !== null && completionRate !== null && failureRate !== null
    ? Math.round((avgQuality / 100) * (completionRate / 100) * (1 - failureRate / 100) * 100)
    : null;

  // Turn distribution (simulated)
  const rng = makeRng(0xabcdef + segment.length);
  const turnBuckets: Record<string, number> = { "1": 0, "2–3": 0, "4–6": 0, "7–10": 0, "10+": 0 };
  for (let i = 0; i < n; i++) {
    const t = Math.floor(rng() * 12) + 1;
    if (t === 1) turnBuckets["1"]++;
    else if (t <= 3) turnBuckets["2–3"]++;
    else if (t <= 6) turnBuckets["4–6"]++;
    else if (t <= 10) turnBuckets["7–10"]++;
    else turnBuckets["10+"]++;
  }
  const avgTurns = Math.round(4 + rng() * 3); // ~4–7 turns

  return {
    stats: {
      total: n,
      analyzed: n,
      avgQuality,
      completionRate,
      failureRate,
      avgTurns,
      totalMessages: n * avgTurns,
      topTopic,
    },
    healthScore,
    byPlatform: [{ platform: "demo", total: n, analyzed: n, avgQuality, completionRate }],
    turnDistribution: Object.entries(turnBuckets).map(([label, count]) => ({ label, count })),
    qualityDistribution: Object.entries(qualityBuckets).map(([label, count]) => ({ label, count })),
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    topPerformingTopics,
    worstPerformingTopics,
    recentAnalyzed: [],
    avgTurnsByPlatform: [],
    segmentMeta: { keyInsight: meta.keyInsight, briefing: meta.briefing, name: meta.name, emoji: meta.emoji },
  };
}

// ─── Mock performance stats ────────────────────────────────────────────────────

export function computeMockPerformanceStats(segment: string) {
  const convos = getSegmentConversations(segment);

  const qualityBuckets: Record<string, number> = { "0–20": 0, "21–40": 0, "41–60": 0, "61–80": 0, "81–100": 0 };
  const statusCounts: Record<string, number> = {};
  const byIntent: Record<string, { qualitySum: number; qualityCount: number; completedCount: number; failCount: number; count: number; turnSum: number }> = {};

  for (const c of convos) {
    const q = c.scores.overall;
    if (q <= 20) qualityBuckets["0–20"]++;
    else if (q <= 40) qualityBuckets["21–40"]++;
    else if (q <= 60) qualityBuckets["41–60"]++;
    else if (q <= 80) qualityBuckets["61–80"]++;
    else qualityBuckets["81–100"]++;

    const status = c.inferred_satisfaction === "abandoned" ? "abandoned" : "completed";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    byIntent[c.intent] ??= { qualitySum: 0, qualityCount: 0, completedCount: 0, failCount: 0, count: 0, turnSum: 0 };
    const g = byIntent[c.intent];
    g.count++; g.qualitySum += q; g.qualityCount++;
    if (status === "completed") g.completedCount++;
    if (c.failure_tags.length > 0) g.failCount++;
    g.turnSum += 3 + Math.floor(Math.random() * 7);
  }

  const intentArr = Object.entries(byIntent).map(([intent, g]) => ({
    intent,
    avgQuality: g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null,
    completionRate: g.count > 0 ? Math.round((g.completedCount / g.count) * 1000) / 10 : 0,
    failureRate: g.count > 0 ? Math.round((g.failCount / g.count) * 1000) / 10 : 0,
    count: g.count,
  }));

  const impactMatrix = intentArr
    .filter((x) => x.avgQuality !== null)
    .map((x) => {
      const qualityGap = 80 - (x.avgQuality ?? 80);
      return {
        intent: x.intent, count: x.count, failureRate: x.failureRate,
        avgQuality: x.avgQuality, qualityGap: Math.max(0, qualityGap),
        impactScore: Math.round(x.count * (qualityGap / 100) * (x.failureRate / 100 + 0.1)),
      };
    })
    .sort((a, b) => b.impactScore - a.impactScore);

  const fixFirst = impactMatrix.slice(0, 3).map((x) => ({ ...x, examples: [] as string[] }));

  return {
    qualityDistribution: Object.entries(qualityBuckets).map(([label, count]) => ({ label, count })),
    qualityByTopic: intentArr.filter((x) => x.avgQuality !== null).sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0)).map(({ intent, avgQuality, count }) => ({ intent, avgQuality: avgQuality!, count })),
    qualityByPlatform: [{ platform: "demo", avgQuality: Math.round(convos.reduce((s, c) => s + c.scores.overall, 0) / convos.length), completionRate: 72, count: convos.length }],
    qualityByTurns: [
      { group: "1 turn",   avgQuality: Math.round(convos.filter(c => c.scores.overall >= 75).length / convos.length * 100), count: Math.round(convos.length * 0.12) },
      { group: "2–3 turns", avgQuality: Math.round(convos.reduce((s,c) => s + c.scores.overall, 0) / convos.length), count: Math.round(convos.length * 0.28) },
      { group: "4–6 turns", avgQuality: Math.round(convos.reduce((s,c) => s + c.scores.overall, 0) / convos.length) + 3, count: Math.round(convos.length * 0.35) },
      { group: "7–10 turns", avgQuality: Math.round(convos.reduce((s,c) => s + c.scores.overall, 0) / convos.length) + 5, count: Math.round(convos.length * 0.18) },
      { group: "10+ turns", avgQuality: Math.round(convos.reduce((s,c) => s + c.scores.overall, 0) / convos.length) - 2, count: Math.round(convos.length * 0.07) },
    ],
    statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    completionByTopic: intentArr.sort((a, b) => b.completionRate - a.completionRate).map(({ intent, completionRate, count }) => ({ intent, completionRate, count })),
    abandonmentHistogram: Array.from({ length: 10 }, (_, i) => ({
      turn: i + 1,
      count: Math.round(convos.length * 0.03 * Math.exp(-i * 0.3)),
    })),
    impactMatrix,
    fixFirst,
    total: convos.length,
    insights: {
      qualityDrop: getSegmentMeta(segment).briefing[0],
      abandonment: getSegmentMeta(segment).briefing[1],
      topFix: getSegmentMeta(segment).briefing[2],
    },
  };
}

// ─── Mock topics stats ─────────────────────────────────────────────────────────

export function computeMockTopicsStats(segment: string) {
  const convos = getSegmentConversations(segment);
  const meta = getSegmentMeta(segment);

  const byIntent: Record<string, { qualitySum: number; qualityCount: number; failCount: number; completeCount: number; count: number; firstSeen: string }> = {};

  for (const c of convos) {
    byIntent[c.intent] ??= { qualitySum: 0, qualityCount: 0, failCount: 0, completeCount: 0, count: 0, firstSeen: c.timestamp };
    const g = byIntent[c.intent];
    g.count++; g.qualitySum += c.scores.overall; g.qualityCount++;
    if (c.failure_tags.length > 0) g.failCount++;
    if (c.inferred_satisfaction !== "abandoned") g.completeCount++;
    if (c.timestamp < g.firstSeen) g.firstSeen = c.timestamp;
  }

  const unclustered = Object.entries(byIntent)
    .map(([intent, g]) => ({
      label: intent,
      count: g.count,
      avgQuality: g.qualityCount > 0 ? Math.round(g.qualitySum / g.qualityCount) : null,
      failureRate: g.count > 0 ? Math.round((g.failCount / g.count) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const bestQuality = [...unclustered].filter(x => x.avgQuality !== null).sort((a, b) => (b.avgQuality ?? 0) - (a.avgQuality ?? 0));
  const worstQuality = [...unclustered].filter(x => x.avgQuality !== null).sort((a, b) => (a.avgQuality ?? 100) - (b.avgQuality ?? 100));

  return {
    clusters: [],
    emergingTopics: unclustered.slice(0, 3).map((u) => ({
      label: u.label,
      count: Math.round(u.count * 0.3),
      clusterName: null,
      firstSeen: new Date(Date.now() - 10 * 86400000).toISOString(),
      avgQuality: u.avgQuality,
    })),
    unclustered,
    hasClusterData: false,
    totalConversations: convos.length,
    uniqueTopicsCount: unclustered.length,
    topicInsights: {
      mostDiscussed: unclustered.length > 0 ? { name: unclustered[0].label, count: unclustered[0].count } : null,
      biggestQualityGap: worstQuality.length > 0 && bestQuality.length > 0
        ? { label: worstQuality[0].label, count: worstQuality[0].count, avgQuality: worstQuality[0].avgQuality! }
        : null,
      fastestGrowing: unclustered.length > 1 ? { label: unclustered[1].label, count: unclustered[1].count, clusterName: null } : null,
      platformSpecialization: [],
    },
    segmentMeta: { keyInsight: meta.keyInsight, name: meta.name, emoji: meta.emoji },
  };
}
