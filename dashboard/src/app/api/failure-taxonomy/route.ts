import { NextRequest, NextResponse } from "next/server";
import { FailureType } from "@/lib/mockQualityData";
import { getSegmentConversations, getSegmentFailureTypes } from "@/lib/mockSegmentData";

export const dynamic = "force-dynamic";

function cap(s: string) { return s.replace(/_/g, " "); }

// 4 weekly buckets (most recent last)
const WEEK_LABELS = ["4w ago", "3w ago", "Last week", "This week"];

export async function GET(req: NextRequest) {
  const sp      = req.nextUrl.searchParams;
  const intent  = sp.get("intent")  ?? "";
  const segment = sp.get("segment") ?? "ai_assistant";
  const days    = Math.min(90, Math.max(7, parseInt(sp.get("days") ?? "30", 10)));

  const FAILURE_TYPES = getSegmentFailureTypes(segment);
  const MOCK_CONVERSATIONS = getSegmentConversations(segment);

  const now      = Date.now();
  const cutoffMs = now - days * 86400000;

  // ── Filter ────────────────────────────────────────────────────────────────
  let convos = MOCK_CONVERSATIONS.filter(
    (c) => new Date(c.timestamp).getTime() >= cutoffMs,
  );
  if (intent) convos = convos.filter((c) => c.intent === intent);

  const intents = [...new Set(MOCK_CONVERSATIONS.map((c) => c.intent))].sort();
  const totalConversations = convos.length;
  const failedConvos = convos.filter((c) => c.failure_tags.length > 0);
  const totalFailed = failedConvos.length;

  // ── Frequency data ────────────────────────────────────────────────────────
  const freqCounts: Record<string, number> = {};
  for (const c of failedConvos) {
    for (const tag of c.failure_tags) {
      freqCounts[tag.type] = (freqCounts[tag.type] ?? 0) + 1;
    }
  }
  const totalTags = Object.values(freqCounts).reduce((a, b) => a + b, 0);
  const frequencyData = FAILURE_TYPES
    .map((ft) => ({
      key:   ft.key,
      label: ft.label,
      icon:  ft.icon,
      color: ft.color,
      count: freqCounts[ft.key] ?? 0,
      pct:   totalTags > 0 ? Math.round(((freqCounts[ft.key] ?? 0) / totalTags) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Weekly trend (4 buckets) ──────────────────────────────────────────────
  // bucket 0 = oldest (28–21d ago), bucket 3 = most recent (7–0d ago)
  const bucketMs = 7 * 86400000;
  const weeklyBuckets: Record<FailureType, number>[] = Array.from({ length: 4 }, () =>
    Object.fromEntries(FAILURE_TYPES.map((ft) => [ft.key, 0])) as Record<FailureType, number>,
  );

  for (const c of MOCK_CONVERSATIONS.filter((c) => new Date(c.timestamp).getTime() >= now - 28 * 86400000)) {
    const ageMs = now - new Date(c.timestamp).getTime();
    const bucket = 3 - Math.min(3, Math.floor(ageMs / bucketMs));
    for (const tag of c.failure_tags) {
      weeklyBuckets[bucket][tag.type as FailureType]++;
    }
  }

  const weeklyTrend = weeklyBuckets.map((bucket, i) => ({
    week: WEEK_LABELS[i],
    ...bucket,
  }));

  // ── Intent × Failure cross-tab ────────────────────────────────────────────
  const intentMap: Record<string, Record<string, number> & { total: number }> = {};
  for (const c of failedConvos) {
    if (!intentMap[c.intent]) {
      intentMap[c.intent] = Object.fromEntries(FAILURE_TYPES.map((ft) => [ft.key, 0])) as Record<string, number> & { total: number };
      intentMap[c.intent].total = 0;
    }
    for (const tag of c.failure_tags) {
      intentMap[c.intent][tag.type]++;
      intentMap[c.intent].total++;
    }
  }
  const intentCrossTab = Object.entries(intentMap)
    .map(([int, counts]) => ({ intent: int, label: cap(int), ...counts }))
    .sort((a, b) => (b.total as number) - (a.total as number))
    .slice(0, 10);

  // ── Examples (3 per failure type) ─────────────────────────────────────────
  const examples: Record<string, { convId: string; intent: string; turn: number; detail: string }[]> = {};
  for (const ft of FAILURE_TYPES) {
    const matching = failedConvos
      .filter((c) => c.failure_tags.some((t) => t.type === ft.key))
      .slice(0, 3);
    examples[ft.key] = matching.map((c) => {
      const tag = c.failure_tags.find((t) => t.type === ft.key)!;
      return { convId: c.id, intent: c.intent, turn: tag.turn, detail: tag.detail };
    });
  }

  // ── Top this week (vs last week) ──────────────────────────────────────────
  const thisWeekConvos = MOCK_CONVERSATIONS.filter((c) => {
    const age = now - new Date(c.timestamp).getTime();
    return age <= 7 * 86400000;
  });
  const lastWeekConvos = MOCK_CONVERSATIONS.filter((c) => {
    const age = now - new Date(c.timestamp).getTime();
    return age > 7 * 86400000 && age <= 14 * 86400000;
  });

  const countByType = (pool: typeof MOCK_CONVERSATIONS) => {
    const m: Record<string, number> = {};
    for (const c of pool) for (const t of c.failure_tags) m[t.type] = (m[t.type] ?? 0) + 1;
    return m;
  };
  const thisWeekCounts = countByType(thisWeekConvos);
  const lastWeekCounts = countByType(lastWeekConvos);

  const topThisWeek = FAILURE_TYPES.map((ft) => {
    const thisWeek = thisWeekCounts[ft.key] ?? 0;
    const lastWeek = lastWeekCounts[ft.key] ?? 0;
    const delta    = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : (thisWeek > 0 ? 100 : 0);
    return { key: ft.key, label: ft.label, icon: ft.icon, color: ft.color, thisWeek, lastWeek, delta, isAlert: delta > 20 && thisWeek > 0 };
  })
    .filter((f) => f.thisWeek > 0)
    .sort((a, b) => b.thisWeek - a.thisWeek)
    .slice(0, 5);

  return NextResponse.json({
    frequencyData, weeklyTrend, intentCrossTab, examples, topThisWeek,
    totalFailed, totalConversations, intents,
  });
}
