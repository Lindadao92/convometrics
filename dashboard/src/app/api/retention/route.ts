import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_DAY  = 864e5;
const MS_WEEK = 7 * MS_DAY;

/** Returns the timestamp of the Sunday that starts the week containing `ts`. */
function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d.getTime();
}

function weekLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET() {
  const sb = getSupabaseServer();

  const { data: rows, error } = await sb
    .from("conversations")
    .select("user_id, completion_status, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) {
    return NextResponse.json({ cohorts: [], maxWeeks: 0, successRetention: 0, failedRetention: 0, successCount: 0, failedCount: 0 });
  }

  const now = Date.now();

  // ── Group conversations by user ────────────────────────────────────────────
  const byUser: Record<string, { ts: number; status: string | null }[]> = {};
  for (const row of rows) {
    if (!row.user_id) continue;
    (byUser[row.user_id] ??= []).push({
      ts:     new Date(row.created_at).getTime(),
      status: row.completion_status,
    });
  }

  // ── Build per-user info ────────────────────────────────────────────────────
  interface UserInfo {
    userId:            string;
    cohortWeek:        number;   // Sunday timestamp of the cohort week
    firstTs:           number;
    firstStatus:       string | null;
    weekOffsets:       Set<number>;
    returnedAfter3d:   boolean;
  }

  const users: UserInfo[] = Object.entries(byUser).map(([userId, convos]) => {
    const sorted      = convos.sort((a, b) => a.ts - b.ts);
    const firstTs     = sorted[0].ts;
    const cohortWeek  = weekStart(firstTs);
    const weekOffsets = new Set(
      sorted.map((c) => Math.floor((c.ts - cohortWeek) / MS_WEEK))
    );
    return {
      userId,
      cohortWeek,
      firstTs,
      firstStatus:     sorted[0].status,
      weekOffsets,
      returnedAfter3d: sorted.some((c) => c.ts - firstTs >= 3 * MS_DAY),
    };
  });

  // ── Cohort weeks, sorted ascending ────────────────────────────────────────
  const allCohortWeeks = [
    ...new Set(users.map((u) => u.cohortWeek)),
  ].sort((a, b) => a - b);

  const earliestCohort = allCohortWeeks[0] ?? now;
  const maxWeeks       = Math.min(Math.floor((now - earliestCohort) / MS_WEEK), 8);

  // ── Build cohort rows ──────────────────────────────────────────────────────
  const cohorts = allCohortWeeks.map((cohortWeek) => {
    const cohortUsers    = users.filter((u) => u.cohortWeek === cohortWeek);
    const maxElapsed     = Math.floor((now - cohortWeek) / MS_WEEK);

    const weeks: (number | null)[] = Array.from({ length: maxWeeks + 1 }, (_, w) => {
      if (w > maxElapsed) return null; // week hasn't elapsed yet → empty cell
      const retained = cohortUsers.filter((u) => u.weekOffsets.has(w)).length;
      return Math.round((retained / cohortUsers.length) * 100);
    });

    return {
      cohortLabel: weekLabel(cohortWeek),
      cohortStart: new Date(cohortWeek).toISOString().slice(0, 10),
      userCount:   cohortUsers.length,
      weeks,
    };
  });

  // ── First-session quality vs retention ────────────────────────────────────
  const successUsers = users.filter((u) => u.firstStatus === "completed");
  const failedUsers  = users.filter((u) => u.firstStatus !== "completed");

  function retentionPct(group: UserInfo[]): number {
    if (!group.length) return 0;
    return Math.round(
      (group.filter((u) => u.returnedAfter3d).length / group.length) * 100
    );
  }

  return NextResponse.json({
    cohorts,
    maxWeeks,
    successRetention: retentionPct(successUsers),
    failedRetention:  retentionPct(failedUsers),
    successCount:     successUsers.length,
    failedCount:      failedUsers.length,
  });
}
