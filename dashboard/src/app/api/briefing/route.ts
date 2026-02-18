import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Row = {
  quality_score: number | null;
  completion_status: string | null;
  intent: string | null;
  created_at: string;
  metadata: {
    user_experience?: string;
    prompt_count_in_session?: number;
    project_type?: string;
  } | null;
  user_id: string | null;
};

const MS_DAY = 864e5;

function successRate(rows: Row[]): number {
  if (!rows.length) return 0;
  return Math.round(
    (rows.filter((r) => r.completion_status === "completed").length / rows.length) * 100
  );
}

function avgQuality(rows: Row[]): number {
  const scored = rows.filter((r) => r.quality_score !== null);
  if (!scored.length) return 0;
  return Math.round(
    scored.reduce((s, r) => s + (r.quality_score as number), 0) / scored.length
  );
}

function qualityByIntent(rows: Row[]): Record<string, { avg: number; n: number }> {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (!r.intent || r.quality_score === null) continue;
    (acc[r.intent] ??= { sum: 0, n: 0 }).sum += r.quality_score as number;
    acc[r.intent].n++;
  }
  return Object.fromEntries(
    Object.entries(acc).map(([i, { sum, n }]) => [i, { avg: Math.round(sum / n), n }])
  );
}

function volumeByIntent(rows: Row[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of rows) if (r.intent) c[r.intent] = (c[r.intent] || 0) + 1;
  return c;
}

function atRiskUserSet(rows: Row[]): Set<string> {
  return new Set(
    rows
      .filter((r) => r.completion_status === "failed" || r.completion_status === "abandoned")
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null)
  );
}

export async function GET() {
  const sb = getSupabaseServer();
  const { data: rows, error } = await sb
    .from("conversations")
    .select("quality_score, completion_status, intent, created_at, metadata, user_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ error: "No data" }, { status: 500 });

  const now = Date.now();
  const t7  = now - 7  * MS_DAY;
  const t14 = now - 14 * MS_DAY;

  const allTs = (rows as Row[]).map((r) => ({
    ...r,
    _ts: new Date(r.created_at).getTime(),
  }));
  const thisWeek = allTs.filter((r) => r._ts >= t7);
  const lastWeek = allTs.filter((r) => r._ts >= t14 && r._ts < t7);

  // ── Success rate ──────────────────────────────────────────────────────────
  const srThis = successRate(thisWeek);
  const srLast = successRate(lastWeek);

  // ── Failed users this week (failed OR abandoned) ───────────────────────────
  const failedUsersThisWeek = new Set(
    thisWeek
      .filter((r) => r.completion_status === "failed" || r.completion_status === "abandoned")
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null)
  ).size;

  // ── Users affected: strictly 'failed' this week ───────────────────────────
  const usersAffectedThisWeek = new Set(
    thisWeek
      .filter((r) => r.completion_status === "failed")
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null)
  ).size;

  const usersAffectedLastWeek = new Set(
    lastWeek
      .filter((r) => r.completion_status === "failed")
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null)
  ).size;

  // ── Volume by intent (for briefing fastest-growing) ───────────────────────
  const vThis = volumeByIntent(thisWeek);
  const vLast = volumeByIntent(lastWeek);

  // ── Worst intent by avg quality (all-time, min 5 conversations) ───────────
  const allIntentQuality = qualityByIntent(allTs);
  let worstIntent: { intent: string; avgQuality: number; volume: number } | null = null;
  for (const [intent, { avg, n }] of Object.entries(allIntentQuality)) {
    if (n < 5) continue;
    if (worstIntent === null || avg < worstIntent.avgQuality) {
      worstIntent = { intent, avgQuality: avg, volume: n };
    }
  }

  // ── Fastest growing intent week-over-week ─────────────────────────────────
  let fastestGrowing: {
    intent: string;
    pctChange: number;
    thisWeekCount: number;
    prevWeekCount: number;
  } | null = null;
  for (const [intent, count] of Object.entries(vThis)) {
    const prev = vLast[intent] ?? 0;
    if (prev === 0 || count < 2) continue;
    const pct = Math.round(((count - prev) / prev) * 100);
    if (fastestGrowing === null || pct > fastestGrowing.pctChange) {
      fastestGrowing = { intent, pctChange: pct, thisWeekCount: count, prevWeekCount: prev };
    }
  }

  // ── Success rate sparkline (14 days) ─────────────────────────────────────
  const daily: Record<string, { c: number; t: number }> = {};
  for (const r of allTs) {
    if (r._ts < t14) continue;
    const key = r.created_at.slice(0, 10);
    (daily[key] ??= { c: 0, t: 0 }).t++;
    if (r.completion_status === "completed") daily[key].c++;
  }
  const sparkline = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { c, t }]) => ({ date: date.slice(5), rate: Math.round((c / t) * 100) }));

  // ── Revenue at risk ────────────────────────────────────────────────────────
  const riskAll  = atRiskUserSet(allTs);
  const riskThis = atRiskUserSet(thisWeek);
  const riskLast = atRiskUserSet(lastWeek);

  // ── Top feature gap (highest-volume intent with <50% completion) ──────────
  const intentStats: Record<string, { completed: number; total: number }> = {};
  for (const r of rows as Row[]) {
    if (!r.intent) continue;
    (intentStats[r.intent] ??= { completed: 0, total: 0 }).total++;
    if (r.completion_status === "completed") intentStats[r.intent].completed++;
  }
  const featureGaps = Object.entries(intentStats)
    .map(([intent, { completed, total }]) => ({
      intent,
      completionRate: Math.round((completed / total) * 100),
      volume: total,
    }))
    .filter((x) => x.completionRate < 50)
    .sort((a, b) => b.volume - a.volume);

  // ── Segment performance ────────────────────────────────────────────────────
  type SegKey = "beginner" | "designer" | "developer";
  const segs: SegKey[] = ["beginner", "designer", "developer"];
  const segPerf: Record<SegKey, { completed: number; total: number; rate: number }> = {
    beginner:  { completed: 0, total: 0, rate: 0 },
    designer:  { completed: 0, total: 0, rate: 0 },
    developer: { completed: 0, total: 0, rate: 0 },
  };
  for (const r of rows as Row[]) {
    const exp = r.metadata?.user_experience as SegKey | undefined;
    if (!exp || !segPerf[exp]) continue;
    segPerf[exp].total++;
    if (r.completion_status === "completed") segPerf[exp].completed++;
  }
  for (const s of segs) {
    const { completed, total } = segPerf[s];
    segPerf[s].rate = total ? Math.round((completed / total) * 100) : 0;
  }

  return NextResponse.json({
    briefing: {
      successRateThisWeek: srThis,
      successRatePrevWeek: srLast,
      successRateDelta:    srThis - srLast,
      failedUsersThisWeek,
      worstIntent,
      fastestGrowing,
    },
    kpis: {
      successRate: {
        current:   srThis,
        delta:     srThis - srLast,
        sparkline,
      },
      revenueAtRisk: {
        current:          riskAll.size * 35,
        usersAtRisk:      riskAll.size,
        thisWeekUsers:    riskThis.size,
        lastWeekUsers:    riskLast.size,
        failedSessions:   (rows as Row[]).filter((r) => r.completion_status === "failed").length,
        abandonedSessions:(rows as Row[]).filter((r) => r.completion_status === "abandoned").length,
      },
      topFeatureGap:  featureGaps[0] ?? null,
      allFeatureGaps: featureGaps,
      worstIntent,
      usersAffected: {
        thisWeek: usersAffectedThisWeek,
        lastWeek: usersAffectedLastWeek,
        delta:    usersAffectedThisWeek - usersAffectedLastWeek,
      },
      segmentPerformance: segPerf,
    },
  });
}
