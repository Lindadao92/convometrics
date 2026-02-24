import { NextRequest, NextResponse } from "next/server";
import {
  MOCK_CONVERSATIONS, SIGNALS, SATISFACTION_META,
  InferredSatisfaction, SatisfactionSignal, MockConversation,
} from "@/lib/mockQualityData";

export const dynamic = "force-dynamic";

function cap(s: string) { return s.replace(/_/g, " "); }

const SAT_ORDER: InferredSatisfaction[] = ["satisfied", "neutral", "frustrated", "abandoned"];

// Signals that indicate negative sentiment (shown as "top frustration signals")
const FRUSTRATION_SIGNALS = new Set<SatisfactionSignal>([
  "rephrasing", "message_shortening", "escalation_request", "retry_pattern", "abandonment",
]);

export async function GET(req: NextRequest) {
  const sp    = req.nextUrl.searchParams;
  const intent = sp.get("intent") ?? "";
  const model  = sp.get("model")  ?? "";
  const days   = Math.min(90, Math.max(7, parseInt(sp.get("days") ?? "30", 10)));

  const now      = Date.now();
  const cutoffMs = now - days * 86400000;

  // ── Filter ───────────────────────────────────────────────────────────────
  let convos: MockConversation[] = MOCK_CONVERSATIONS.filter(
    c => new Date(c.timestamp).getTime() >= cutoffMs,
  );
  if (intent) convos = convos.filter(c => c.intent === intent);
  if (model)  convos = convos.filter(c => c.model_version === model);

  const intents = [...new Set(MOCK_CONVERSATIONS.map(c => c.intent))].sort();
  const total   = convos.length;

  if (total === 0) {
    return NextResponse.json({
      distribution: SAT_ORDER.map(k => ({ key: k, ...SATISFACTION_META[k], count: 0, pct: 0 })),
      topFrustrationSignals: [], dailyTrend: [], byIntent: [],
      intents, models: ["v2.0", "v2.1"], total: 0,
    });
  }

  // ── Satisfaction distribution ─────────────────────────────────────────────
  const satCounts = Object.fromEntries(SAT_ORDER.map(k => [k, 0])) as Record<InferredSatisfaction, number>;
  for (const c of convos) satCounts[c.inferred_satisfaction]++;

  const distribution = SAT_ORDER.map(k => ({
    key:   k,
    label: SATISFACTION_META[k].label,
    color: SATISFACTION_META[k].color,
    icon:  SATISFACTION_META[k].icon,
    count: satCounts[k],
    pct:   total > 0 ? Math.round((satCounts[k] / total) * 1000) / 10 : 0,
  }));

  // ── Top frustration signals ───────────────────────────────────────────────
  const signalCounts: Record<string, number> = {};
  for (const c of convos) {
    for (const sig of c.satisfaction_signals) {
      if (FRUSTRATION_SIGNALS.has(sig)) {
        signalCounts[sig] = (signalCounts[sig] ?? 0) + 1;
      }
    }
  }
  const sigMeta = Object.fromEntries(SIGNALS.map(s => [s.key, s]));
  const topFrustrationSignals = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({
      key,
      label: sigMeta[key]?.label ?? cap(key),
      emoji: sigMeta[key]?.emoji ?? "⚠️",
      color: sigMeta[key]?.color ?? "#f59e0b",
      count,
    }));

  // ── Daily trend ───────────────────────────────────────────────────────────
  type DayEntry = { counts: Record<InferredSatisfaction, number>; total: number };
  const dayMap = new Map<string, DayEntry>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoffMs + i * 86400000);
    const k = d.toISOString().slice(0, 10);
    dayMap.set(k, {
      counts: { satisfied: 0, neutral: 0, frustrated: 0, abandoned: 0 },
      total:  0,
    });
  }
  for (const c of convos) {
    const k = c.timestamp.slice(0, 10);
    const e = dayMap.get(k);
    if (e) { e.counts[c.inferred_satisfaction]++; e.total++; }
  }
  const dailyTrend = [...dayMap.entries()].map(([date, { counts, total: dt }]) => ({
    date:      date.slice(5), // MM-DD
    satisfied: dt > 0 ? Math.round((counts.satisfied  / dt) * 100) : null,
    frustrated: dt > 0 ? Math.round(((counts.frustrated + counts.abandoned) / dt) * 100) : null,
    neutral:   dt > 0 ? Math.round((counts.neutral    / dt) * 100) : null,
    abandoned: dt > 0 ? Math.round((counts.abandoned  / dt) * 100) : null,
  }));

  // ── Satisfaction by intent ────────────────────────────────────────────────
  const intentMap: Record<string, Record<InferredSatisfaction, number>> = {};
  for (const c of convos) {
    intentMap[c.intent] ??= { satisfied: 0, neutral: 0, frustrated: 0, abandoned: 0 };
    intentMap[c.intent][c.inferred_satisfaction]++;
  }

  const byIntent = Object.entries(intentMap)
    .map(([intent, counts]) => {
      const n = Object.values(counts).reduce((a, b) => a + b, 0);
      const frustratedPct = n > 0 ? Math.round(((counts.frustrated + counts.abandoned) / n) * 100) : 0;
      return {
        intent,
        label:         cap(intent),
        satisfiedPct:  n > 0 ? Math.round((counts.satisfied  / n) * 100) : 0,
        neutralPct:    n > 0 ? Math.round((counts.neutral    / n) * 100) : 0,
        frustratedPct: n > 0 ? Math.round((counts.frustrated / n) * 100) : 0,
        abandonedPct:  n > 0 ? Math.round((counts.abandoned  / n) * 100) : 0,
        negativePct:   frustratedPct, // combined frustrated + abandoned for sort
        count:         n,
      };
    })
    .sort((a, b) => b.negativePct - a.negativePct);

  return NextResponse.json({
    distribution, topFrustrationSignals, dailyTrend, byIntent,
    intents, models: ["v2.0", "v2.1"], total,
  });
}
