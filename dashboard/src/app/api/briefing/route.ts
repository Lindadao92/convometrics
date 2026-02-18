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

const MS = { DAY: 864e5 };

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

function qualityByIntent(rows: Row[]): Record<string, number> {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (!r.intent || r.quality_score === null) continue;
    (acc[r.intent] ??= { sum: 0, n: 0 }).sum += r.quality_score as number;
    acc[r.intent].n++;
  }
  return Object.fromEntries(
    Object.entries(acc).map(([i, { sum, n }]) => [i, Math.round(sum / n)])
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

function avgTtv(rows: Row[]): number {
  const valid = rows.filter(
    (r) =>
      r.completion_status === "completed" && r.metadata?.prompt_count_in_session != null
  );
  if (!valid.length) return 0;
  const avg =
    valid.reduce((s, r) => s + (r.metadata!.prompt_count_in_session as number), 0) /
    valid.length;
  return Math.round(avg * 10) / 10;
}

export async function GET() {
  const sb = getSupabaseServer();
  const { data: rows, error } = await sb
    .from("conversations")
    .select("quality_score, completion_status, intent, created_at, metadata, user_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ error: "No data" }, { status: 500 });

  const now = Date.now();
  const t7 = now - 7 * MS.DAY;
  const t14 = now - 14 * MS.DAY;

  // Attach timestamp once
  const allTs = (rows as Row[]).map((r) => ({
    ...r,
    _ts: new Date(r.created_at).getTime(),
  }));
  const thisWeek = allTs.filter((r) => r._ts >= t7);
  const lastWeek = allTs.filter((r) => r._ts >= t14 && r._ts < t7);

  // ── Briefing section ──────────────────────────────────────────────────────
  const srThis = successRate(thisWeek);
  const srLast = successRate(lastWeek);

  const failedThisWeek = new Set(
    thisWeek
      .filter((r) => r.completion_status === "failed" || r.completion_status === "abandoned")
      .map((r) => r.user_id)
      .filter((id): id is string => id !== null)
  );

  const qThis = qualityByIntent(thisWeek);
  const qLast = qualityByIntent(lastWeek);
  const vThis = volumeByIntent(thisWeek);
  const vLast = volumeByIntent(lastWeek);

  // Biggest quality regression (most negative delta)
  let biggestRegression: {
    intent: string;
    drop: number;
    thisWeek: number;
    prevWeek: number;
  } | null = null;

  for (const [intent, q] of Object.entries(qThis)) {
    const prev = qLast[intent];
    if (prev === undefined) continue;
    const drop = q - prev; // negative = regression
    if (biggestRegression === null || drop < biggestRegression.drop) {
      biggestRegression = { intent, drop, thisWeek: q, prevWeek: prev };
    }
  }

  // Fastest growing intent by volume week-over-week
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

  // ── KPI: Success Rate ─────────────────────────────────────────────────────
  // Daily sparkline covering last 14 days
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

  // ── KPI: Revenue at Risk ──────────────────────────────────────────────────
  const riskAll = atRiskUserSet(allTs);
  const riskThis = atRiskUserSet(thisWeek);
  const riskLast = atRiskUserSet(lastWeek);

  const failedSessionsCount = (rows as Row[]).filter(
    (r) => r.completion_status === "failed"
  ).length;
  const abandonedSessionsCount = (rows as Row[]).filter(
    (r) => r.completion_status === "abandoned"
  ).length;

  // ── KPI: Time to Value ────────────────────────────────────────────────────
  const ttvAll = avgTtv(rows as Row[]);
  const ttvThis = avgTtv(thisWeek);
  const ttvLast = avgTtv(lastWeek);

  // ── KPI: Feature Gap ─────────────────────────────────────────────────────
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

  // ── KPI: Release Impact ───────────────────────────────────────────────────
  const l7q = qualityByIntent(thisWeek);
  const p7q = qualityByIntent(lastWeek);

  const releaseByIntent = Object.keys(l7q)
    .filter((i) => p7q[i] !== undefined)
    .map((i) => ({ intent: i, last7: l7q[i], prev7: p7q[i], delta: l7q[i] - p7q[i] }))
    .sort((a, b) => a.delta - b.delta); // worst first

  // ── KPI: Segment Performance ──────────────────────────────────────────────
  type SegKey = "beginner" | "designer" | "developer";
  const segs: SegKey[] = ["beginner", "designer", "developer"];
  const segPerf: Record<SegKey, { completed: number; total: number; rate: number }> = {
    beginner: { completed: 0, total: 0, rate: 0 },
    designer: { completed: 0, total: 0, rate: 0 },
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
      successRateDelta: srThis - srLast,
      failedUsersThisWeek: failedThisWeek.size,
      biggestRegression,
      fastestGrowing,
      totalThisWeek: thisWeek.length,
    },
    kpis: {
      successRate: {
        current: srThis,
        delta: srThis - srLast,
        sparkline,
      },
      revenueAtRisk: {
        current: riskAll.size * 35,
        usersAtRisk: riskAll.size,
        delta: (riskThis.size - riskLast.size) * 35,
        thisWeekUsers: riskThis.size,
        lastWeekUsers: riskLast.size,
        failedSessions: failedSessionsCount,
        abandonedSessions: abandonedSessionsCount,
      },
      timeToValue: {
        avgMessages: ttvAll,
        delta: Math.round((ttvThis - ttvLast) * 10) / 10,
        thisWeek: ttvThis,
        lastWeek: ttvLast,
      },
      topFeatureGap: featureGaps[0] ?? null,
      allFeatureGaps: featureGaps,
      releaseImpact: {
        last7: avgQuality(thisWeek),
        prev7: avgQuality(lastWeek),
        delta: avgQuality(thisWeek) - avgQuality(lastWeek),
        byIntent: releaseByIntent,
      },
      segmentPerformance: segPerf,
    },
  });
}
