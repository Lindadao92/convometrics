import { NextRequest, NextResponse } from "next/server";
import { MOCK_CONVERSATIONS, DIMENSIONS, computeDimensionsFromScore } from "@/lib/mockQualityData";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

// ─── Scripted comparison data (Flash = A, Brainiac = B) ──────────────────────

const SCRIPTED_DIMS: Record<string, { scoreA: number; scoreB: number; pValue: number }> = {
  helpfulness:  { scoreA: 62, scoreB: 75, pValue: 0.01 },
  relevance:    { scoreA: 63, scoreB: 72, pValue: 0.04 },
  accuracy:     { scoreA: 66, scoreB: 70, pValue: 0.12 },
  coherence:    { scoreA: 60, scoreB: 74, pValue: 0.01 },
  satisfaction: { scoreA: 58, scoreB: 71, pValue: 0.02 },
  naturalness:  { scoreA: 65, scoreB: 76, pValue: 0.01 },
  safety:       { scoreA: 80, scoreB: 82, pValue: 0.52 },
};

const SCRIPTED_OVERALL = { scoreA: 64, scoreB: 73 };

const SCRIPTED_REGRESSIONS = [
  {
    dimension: "accuracy", dimLabel: "Accuracy",
    intent: "creative_storytelling", intentLabel: "Creative Storytelling",
    scoreA: 71, scoreB: 65, delta: -6,
    pValue: 0.03, conversationsAffected: 31,
    description: "Brainiac occasionally over-embellishes plot details, introducing minor continuity errors in long-form creative sessions.",
  },
  {
    dimension: "safety", dimLabel: "Safety",
    intent: "roleplay", intentLabel: "Roleplay",
    scoreA: 84, scoreB: 78, delta: -6,
    pValue: 0.04, conversationsAffected: 19,
    description: "Brainiac's stronger character immersion sometimes weakens safety guardrails in intense roleplay scenarios.",
  },
];

const SCRIPTED_IMPROVEMENTS = [
  {
    dimension: "naturalness", dimLabel: "Naturalness",
    intent: null, intentLabel: "All intents",
    scoreA: 65, scoreB: 76, delta: 11,
    pValue: 0.01, conversationsAffected: null,
    description: "Brainiac sounds significantly more human and emotionally present across all companion intents — strongest finding in this comparison.",
  },
  {
    dimension: "coherence", dimLabel: "Coherence",
    intent: "emotional_support", intentLabel: "Emotional Support",
    scoreA: 57, scoreB: 72, delta: 15,
    pValue: 0.01, conversationsAffected: 42,
    description: "Brainiac maintains emotional thread and context across long emotional support sessions far better than Flash.",
  },
];

const SCRIPTED_RECOMMENDATION = {
  summary: "Brainiac improves overall quality by +9 points over Flash, with minor accuracy regression in creative storytelling.",
  details:
    "Naturalness improved significantly across all intents (+11 pts, p=0.01). Coherence in emotional support improved dramatically (+15 pts, p=0.01, 42 conversations). However, accuracy regressed in creative storytelling (−6 pts, p=0.03, 31 conversations) and safety dipped slightly in roleplay (−6 pts, p=0.04, 19 conversations). Recommend monitoring roleplay safety closely.",
  action: "approve" as const,
  actionLabel: "Approve Brainiac rollout with roleplay safety monitoring",
};

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const modelA = sp.get("modelA") ?? "Flash";
  const modelB = sp.get("modelB") ?? "Brainiac";
  const days   = parseInt(sp.get("days") ?? "30", 10);

  // Calculate cutoff at start of day (00:00:00) for consistent timezone handling
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const cutoff = cutoffDate.getTime();
  
  const ALL = MOCK_CONVERSATIONS.filter((c) => {
    try {
      return new Date(c.timestamp).getTime() >= cutoff;
    } catch (e) {
      console.warn('Invalid timestamp format:', c.timestamp);
      return false; // Exclude conversations with invalid timestamps
    }
  });
  const availableModels = [...new Set(ALL.map((c) => c.model_version))].sort();
  const convosA = ALL.filter((c) => c.model_version === modelA);
  const convosB = ALL.filter((c) => c.model_version === modelB);
  const countA  = convosA.length;
  const countB  = convosB.length;

  // ── Dimensions (scripted for Flash↔Brainiac, generic delta for other pairs) ─
  const isScripted = (modelA === "Flash" && modelB === "Brainiac") || (modelA === "Brainiac" && modelB === "Flash");
  const flip = modelA === "Brainiac" && modelB === "Flash"; // reversed pair

  const dimensions = DIMENSIONS.map((d) => {
    let scoreA: number, scoreB: number, pValue: number;
    if (isScripted) {
      const s = SCRIPTED_DIMS[d.key];
      scoreA = flip ? s.scoreB : s.scoreA;
      scoreB = flip ? s.scoreA : s.scoreB;
      pValue = s.pValue;
    } else {
      // Fallback: compute from mock data
      const avgOf = (convos: typeof MOCK_CONVERSATIONS) => {
        const vals = convos.filter((c) => c.scores.overall !== null).map((c) =>
          computeDimensionsFromScore(c.scores.overall, c.id)[d.key as keyof ReturnType<typeof computeDimensionsFromScore>] as number,
        );
        return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      };
      scoreA = avgOf(convosA);
      scoreB = avgOf(convosB);
      pValue = 0.5; // no significance for generic pairs
    }
    const delta = scoreB - scoreA;
    const significant = pValue < 0.05;
    const direction: "improved" | "regressed" | "neutral" =
      significant && delta > 0 ? "improved" : significant && delta < 0 ? "regressed" : "neutral";
    return { key: d.key, label: d.label, weight: d.weight, color: d.color, scoreA, scoreB, delta, pValue, significant, direction };
  });

  const overall = isScripted
    ? { scoreA: flip ? SCRIPTED_OVERALL.scoreB : SCRIPTED_OVERALL.scoreA, scoreB: flip ? SCRIPTED_OVERALL.scoreA : SCRIPTED_OVERALL.scoreB, delta: flip ? -4 : 4 }
    : { scoreA: Math.round(convosA.reduce((s, c) => s + c.scores.overall, 0) / (countA || 1)), scoreB: Math.round(convosB.reduce((s, c) => s + c.scores.overall, 0) / (countB || 1)), delta: 0 };
  if (!isScripted) overall.delta = overall.scoreB - overall.scoreA;

  const regressions = isScripted ? (flip ? SCRIPTED_IMPROVEMENTS.map((r) => ({ ...r, delta: -r.delta, scoreA: r.scoreB, scoreB: r.scoreA })) : SCRIPTED_REGRESSIONS) : [];
  const improvements = isScripted ? (flip ? SCRIPTED_REGRESSIONS.map((r) => ({ ...r, delta: -r.delta, scoreA: r.scoreB, scoreB: r.scoreA })) : SCRIPTED_IMPROVEMENTS) : [];
  const recommendation = isScripted ? SCRIPTED_RECOMMENDATION : {
    summary: "Insufficient scripted data for this model pair.",
    details: "Scripted story only available for Flash vs Brainiac.",
    action: "investigate" as const,
    actionLabel: "Review raw data",
  };

  // ── Sample conversations ───────────────────────────────────────────────────
  // samplesBetter: Brainiac high-quality conversations (naturalness shines)
  const betterPool = convosB
    .filter((c) => c.scores.overall >= 75 && c.intent !== "creative_storytelling")
    .sort((a, b) => {
      const na = computeDimensionsFromScore(a.scores.overall, a.id).naturalness;
      const nb = computeDimensionsFromScore(b.scores.overall, b.id).naturalness;
      return nb - na;
    })
    .slice(0, 3);

  const samplesBetter = betterPool.map((c) => {
    const dims = computeDimensionsFromScore(c.scores.overall, c.id);
    return {
      id: c.id, intent: c.intent, intentLabel: formatLabel(c.intent),
      model: modelB, overall: c.scores.overall,
      keyDim: "naturalness", keyDimLabel: "Naturalness", keyDimScore: dims.naturalness,
      improvement: dims.naturalness - SCRIPTED_DIMS.naturalness.scoreA,
      snippet: `User started a ${formatLabel(c.intent).toLowerCase()} session — Brainiac responded naturally and stayed in character.`,
    };
  });

  // samplesWorse: Brainiac creative_storytelling conversations where accuracy dropped
  const worsePool = convosB
    .filter((c) => c.intent === "creative_storytelling" || c.intent === "roleplay")
    .sort((a, b) => {
      const aa = computeDimensionsFromScore(a.scores.overall, a.id).accuracy;
      const ab = computeDimensionsFromScore(b.scores.overall, b.id).accuracy;
      return aa - ab; // lowest accuracy first
    })
    .slice(0, 3);

  const samplesWorse = worsePool.map((c) => {
    const dims = computeDimensionsFromScore(c.scores.overall, c.id);
    return {
      id: c.id, intent: c.intent, intentLabel: formatLabel(c.intent),
      model: modelA, overall: c.scores.overall,
      keyDim: "accuracy", keyDimLabel: "Accuracy", keyDimScore: dims.accuracy,
      regression: SCRIPTED_DIMS.accuracy.scoreA - dims.accuracy,
      snippet: `User engaged in ${formatLabel(c.intent).toLowerCase()} — Brainiac introduced minor continuity or safety issues.`,
    };
  });

  return NextResponse.json({
    modelA, modelB, countA, countB,
    overall, dimensions, regressions, improvements,
    samplesBetter, samplesWorse,
    recommendation, availableModels,
  });
}
