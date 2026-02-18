import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_WEEK = 7 * 864e5;

type Row = {
  intent: string | null;
  quality_score: number | null;
  completion_status: string | null;
  created_at: string;
  user_id: string | null;
  _ts: number;
};

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

function uniqueUsers(rows: Row[]): number {
  return new Set(rows.map((r) => r.user_id).filter((id): id is string => id !== null)).size;
}

export async function GET() {
  const sb = getSupabaseServer();
  const { data: raw, error } = await sb
    .from("conversations")
    .select("intent, quality_score, completion_status, created_at, user_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!raw?.length) return NextResponse.json({ error: "No data" }, { status: 500 });

  const now = Date.now();
  const t7  = now - MS_WEEK;
  const t14 = now - 2 * MS_WEEK;

  const rows: Row[]    = raw.map((r) => ({ ...r, _ts: new Date(r.created_at).getTime() }));
  const thisWeek       = rows.filter((r) => r._ts >= t7);
  const lastWeek       = rows.filter((r) => r._ts >= t14 && r._ts < t7);

  // ── Key metrics ────────────────────────────────────────────────────────────
  const metrics = {
    successRate:   { thisWeek: successRate(thisWeek),    lastWeek: successRate(lastWeek) },
    conversations: { thisWeek: thisWeek.length,           lastWeek: lastWeek.length },
    uniqueUsers:   { thisWeek: uniqueUsers(thisWeek),     lastWeek: uniqueUsers(lastWeek) },
    avgQuality:    { thisWeek: avgQuality(thisWeek),      lastWeek: avgQuality(lastWeek) },
  };

  // ── Intent week-over-week deltas ───────────────────────────────────────────
  type IntentBucket = { scores: number[]; completed: number; total: number };
  const tw: Record<string, IntentBucket> = {};
  const lw: Record<string, IntentBucket> = {};

  for (const r of thisWeek) {
    if (!r.intent) continue;
    tw[r.intent] ??= { scores: [], completed: 0, total: 0 };
    tw[r.intent].total++;
    if (r.quality_score !== null) tw[r.intent].scores.push(r.quality_score);
    if (r.completion_status === "completed") tw[r.intent].completed++;
  }
  for (const r of lastWeek) {
    if (!r.intent) continue;
    lw[r.intent] ??= { scores: [], completed: 0, total: 0 };
    lw[r.intent].total++;
    if (r.quality_score !== null) lw[r.intent].scores.push(r.quality_score);
    if (r.completion_status === "completed") lw[r.intent].completed++;
  }

  function bucketAvg(b: IntentBucket): number | null {
    if (!b.scores.length) return null;
    return Math.round(b.scores.reduce((a, v) => a + v, 0) / b.scores.length);
  }
  function bucketCompletion(b: IntentBucket): number {
    return b.total ? Math.round((b.completed / b.total) * 100) : 0;
  }

  const allIntents = new Set([...Object.keys(tw), ...Object.keys(lw)]);

  const intentDeltas = [...allIntents]
    .map((intent) => {
      const a = tw[intent];
      const b = lw[intent];
      if (!a || !b || a.total < 2 || b.total < 2) return null;

      const qThis = bucketAvg(a);
      const qLast = bucketAvg(b);
      const cThis = bucketCompletion(a);
      const cLast = bucketCompletion(b);

      const qualityDelta    = qThis !== null && qLast !== null ? qThis - qLast : null;
      const completionDelta = cThis - cLast;
      // Combined score: weight completion 60%, quality 40%
      const combinedDelta   = (qualityDelta ?? 0) * 0.4 + completionDelta * 0.6;

      return {
        intent,
        thisWeekQuality:    qThis,
        lastWeekQuality:    qLast,
        thisWeekCompletion: cThis,
        lastWeekCompletion: cLast,
        qualityDelta,
        completionDelta,
        combinedDelta,
        thisWeekCount: a.total,
      };
    })
    .filter(<T>(x: T | null): x is T => x !== null)
    .sort((a, b) => b.combinedDelta - a.combinedDelta);

  const improving = intentDeltas.slice(0, 3);
  const declining = intentDeltas.slice(-3).reverse();

  // ── Sprint priorities (deterministic, data-driven) ─────────────────────────
  const priorities: string[] = [];

  // 1. Worst intent by completion rate this week (min 3 convos)
  const worstThisWeek = [...Object.entries(tw)]
    .map(([intent, b]) => ({ intent, completion: bucketCompletion(b), quality: bucketAvg(b), count: b.total }))
    .filter((x) => x.count >= 3)
    .sort((a, b) => a.completion - b.completion)[0];

  if (worstThisWeek) {
    priorities.push(
      `Fix "${worstThisWeek.intent.replace(/_/g, " ")}" — only ${worstThisWeek.completion}% success rate this week across ${worstThisWeek.count} sessions. Add a guided recovery flow, clearer error messages, and a fallback path for stuck users.`
    );
  }

  // 2. Sharpest decliner
  const sharpest = declining[0];
  if (sharpest && sharpest.combinedDelta < -5) {
    const parts: string[] = [];
    if (sharpest.qualityDelta !== null && sharpest.qualityDelta < 0)
      parts.push(`quality down ${Math.abs(sharpest.qualityDelta)} pts`);
    if (sharpest.completionDelta < 0)
      parts.push(`success rate down ${Math.abs(sharpest.completionDelta)}pp`);
    priorities.push(
      `Investigate regression in "${sharpest.intent.replace(/_/g, " ")}" (${parts.join(", ")} week-over-week). Audit recent model outputs, check for prompt drift, and review the top 5 failed sessions from this week.`
    );
  } else {
    // Fallback: overall rate
    const drop = metrics.successRate.lastWeek - metrics.successRate.thisWeek;
    if (drop > 0) {
      priorities.push(
        `Run a prompt engineering sprint to recover the ${drop}pp drop in overall success rate (now ${metrics.successRate.thisWeek}%). Focus on the bottom three intents by completion rate.`
      );
    } else {
      priorities.push(
        `Success rate is stable at ${metrics.successRate.thisWeek}%. Invest in the "${improving[0]?.intent.replace(/_/g, " ") ?? "top"}" momentum and identify why it's improving — then apply the same changes to lower-performing intents.`
      );
    }
  }

  // 3. User reach / engagement priority
  const userDelta = metrics.uniqueUsers.thisWeek - metrics.uniqueUsers.lastWeek;
  if (userDelta < 0) {
    priorities.push(
      `Weekly active users declined from ${metrics.uniqueUsers.lastWeek} to ${metrics.uniqueUsers.thisWeek}. Audit onboarding flows and re-engagement triggers. Consider a proactive nudge for users who failed in the last 7 days.`
    );
  } else {
    priorities.push(
      `User volume is up ${userDelta > 0 ? `by ${userDelta}` : "and stable"} this week (${metrics.uniqueUsers.thisWeek} active users). Double down on "${improving[0]?.intent.replace(/_/g, " ") ?? "high-performing"}" and instrument any new intents emerging in unstructured conversations.`
    );
  }

  const weekFrom = new Date(t7).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const weekTo   = new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return NextResponse.json({
    weekRange: { from: weekFrom, to: weekTo },
    metrics,
    improving,
    declining,
    sprintPriorities: priorities,
  });
}
