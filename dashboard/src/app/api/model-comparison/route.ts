import { NextRequest, NextResponse } from "next/server";
import { MOCK_CONVERSATIONS, DIMENSIONS, computeDimensionsFromScore } from "@/lib/mockQualityData";

export const dynamic = "force-dynamic";

function cap(s: string) { return s.replace(/_/g, " "); }

// ─── Scripted comparison data (v2.0 = A, v2.1 = B) ───────────────────────────

const SCRIPTED_DIMS: Record<string, { scoreA: number; scoreB: number; pValue: number }> = {
  helpfulness:  { scoreA: 71, scoreB: 73, pValue: 0.18 },
  relevance:    { scoreA: 70, scoreB: 71, pValue: 0.31 },
  accuracy:     { scoreA: 76, scoreB: 71, pValue: 0.08 },
  coherence:    { scoreA: 69, scoreB: 70, pValue: 0.44 },
  satisfaction: { scoreA: 66, scoreB: 68, pValue: 0.22 },
  naturalness:  { scoreA: 58, scoreB: 69, pValue: 0.01 },
  safety:       { scoreA: 82, scoreB: 83, pValue: 0.61 },
};

const SCRIPTED_OVERALL = { scoreA: 68, scoreB: 72 };

const SCRIPTED_REGRESSIONS = [
  {
    dimension: "accuracy", dimLabel: "Accuracy",
    intent: "code_help", intentLabel: "Code Help",
    scoreA: 79, scoreB: 64, delta: -15,
    pValue: 0.02, conversationsAffected: 23,
    description: "v2.1 hallucinates more in code generation tasks — likely caused by fine-tuning data that under-represented precise technical content.",
  },
  {
    dimension: "accuracy", dimLabel: "Accuracy",
    intent: "explain_concept", intentLabel: "Explain Concept",
    scoreA: 81, scoreB: 71, delta: -10,
    pValue: 0.04, conversationsAffected: 17,
    description: "Explanations contain more factual errors, particularly for nuanced or multi-step concepts.",
  },
];

const SCRIPTED_IMPROVEMENTS = [
  {
    dimension: "naturalness", dimLabel: "Naturalness",
    intent: null, intentLabel: "All intents",
    scoreA: 58, scoreB: 69, delta: 11,
    pValue: 0.01, conversationsAffected: null,
    description: "v2.1 sounds more conversational and human across all intent categories — highest-confidence finding in this update.",
  },
];

const SCRIPTED_RECOMMENDATION = {
  summary: "v2.1 improves overall quality by +4 points but introduces accuracy regression in code_help.",
  details:
    "Naturalness improved significantly across all intents (+11 pts, p=0.01). However, accuracy regressed in code_help (−15 pts, p=0.02, 23 conversations) and explain_concept (−10 pts, p=0.04, 17 conversations) — both high-volume intents. The accuracy regressions are statistically significant and likely linked to fine-tuning changes.",
  action: "investigate" as const,
  actionLabel: "Investigate code_help & explain_concept accuracy before full rollout",
};

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp     = req.nextUrl.searchParams;
  const modelA = sp.get("modelA") ?? "v2.0";
  const modelB = sp.get("modelB") ?? "v2.1";

  const availableModels = [...new Set(MOCK_CONVERSATIONS.map((c) => c.model_version))].sort();
  const convosA = MOCK_CONVERSATIONS.filter((c) => c.model_version === modelA);
  const convosB = MOCK_CONVERSATIONS.filter((c) => c.model_version === modelB);
  const countA  = convosA.length;
  const countB  = convosB.length;

  // ── Dimensions (scripted for v2.0↔v2.1, generic delta for other pairs) ────
  const isScripted = (modelA === "v2.0" && modelB === "v2.1") || (modelA === "v2.1" && modelB === "v2.0");
  const flip = modelA === "v2.1" && modelB === "v2.0"; // reversed pair

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
    details: "Scripted story only available for v2.0 vs v2.1.",
    action: "investigate" as const,
    actionLabel: "Review raw data",
  };

  // ── Sample conversations ───────────────────────────────────────────────────
  // samplesBetter: v2.1 high-quality non-code_help conversations (naturalness shines)
  const betterPool = convosB
    .filter((c) => c.scores.overall >= 75 && c.intent !== "code_help")
    .sort((a, b) => {
      const na = computeDimensionsFromScore(a.scores.overall, a.id).naturalness;
      const nb = computeDimensionsFromScore(b.scores.overall, b.id).naturalness;
      return nb - na;
    })
    .slice(0, 3);

  const samplesBetter = betterPool.map((c) => {
    const dims = computeDimensionsFromScore(c.scores.overall, c.id);
    return {
      id: c.id, intent: c.intent, intentLabel: cap(c.intent),
      model: modelB, overall: c.scores.overall,
      keyDim: "naturalness", keyDimLabel: "Naturalness", keyDimScore: dims.naturalness,
      improvement: dims.naturalness - SCRIPTED_DIMS.naturalness.scoreA,
      snippet: `User asked a ${cap(c.intent).toLowerCase()} question — v2.1 responded conversationally and clearly.`,
    };
  });

  // samplesWorse: v2.1 code_help conversations where accuracy dropped
  const worsePool = convosB
    .filter((c) => c.intent === "code_help")
    .sort((a, b) => {
      const aa = computeDimensionsFromScore(a.scores.overall, a.id).accuracy;
      const ab = computeDimensionsFromScore(b.scores.overall, b.id).accuracy;
      return aa - ab; // lowest accuracy first
    })
    .slice(0, 3);

  const samplesWorse = worsePool.map((c) => {
    const dims = computeDimensionsFromScore(c.scores.overall, c.id);
    return {
      id: c.id, intent: c.intent, intentLabel: cap(c.intent),
      model: modelA, overall: c.scores.overall,
      keyDim: "accuracy", keyDimLabel: "Accuracy", keyDimScore: dims.accuracy,
      regression: SCRIPTED_DIMS.accuracy.scoreA - dims.accuracy,
      snippet: `User asked for code help — v2.1 introduced subtle inaccuracies in the implementation.`,
    };
  });

  return NextResponse.json({
    modelA, modelB, countA, countB,
    overall, dimensions, regressions, improvements,
    samplesBetter, samplesWorse,
    recommendation, availableModels,
  });
}
