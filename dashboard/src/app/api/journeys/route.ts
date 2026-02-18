import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MS_WEEK = 7 * 864e5;

// A user "reaches" a funnel stage if they have ≥1 completed conversation
// with that intent. The first stage counts any conversation at all.
const FUNNEL_STAGES: { stage: string; intent: string | null }[] = [
  { stage: "First Prompt",        intent: null           },
  { stage: "Successful Scaffold", intent: "scaffold_app"  },
  { stage: "Added Feature",       intent: "add_feature"   },
  { stage: "Fixed a Bug",         intent: "fix_bug"       },
  { stage: "Deployed",            intent: "deploy_app"    },
];

export async function GET() {
  const sb = getSupabaseServer();

  const { data: rows, error } = await sb
    .from("conversations")
    .select("user_id, intent, completion_status, quality_score, created_at, conversation_id")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ funnel: [], users: [] });

  const now         = Date.now();
  const churnCutoff = now - MS_WEEK;

  // ── Group by user_id ───────────────────────────────────────────────────────
  const byUser: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!row.user_id) continue;
    (byUser[row.user_id] ??= []).push(row);
  }
  const userEntries = Object.entries(byUser);

  // ── Funnel ─────────────────────────────────────────────────────────────────
  const funnelCounts = FUNNEL_STAGES.map(({ stage, intent }) => {
    if (intent === null) {
      return { stage, count: userEntries.length };
    }
    const count = userEntries.filter(([, convos]) =>
      convos.some((c) => c.intent === intent && c.completion_status === "completed")
    ).length;
    return { stage, count };
  });

  const firstCount = Math.max(funnelCounts[0]?.count ?? 0, 1);
  const funnel = funnelCounts.map((f, i) => ({
    stage:      f.stage,
    count:      f.count,
    pctOfFirst: Math.round((f.count / firstCount) * 100),
    pctOfPrev:  i === 0
      ? 100
      : Math.round((f.count / Math.max(funnelCounts[i - 1].count, 1)) * 100),
  }));

  // ── Users ──────────────────────────────────────────────────────────────────
  const users = userEntries
    .map(([user_id, convos]) => {
      // convos already sorted asc by created_at from Supabase
      const firstSeen = convos[0].created_at;
      const lastSeen  = convos[convos.length - 1].created_at;
      const lastTs    = new Date(lastSeen).getTime();

      const intents = [...new Set(
        convos.map((c) => c.intent).filter((x): x is string => x !== null),
      )];

      const completed   = convos.filter((c) => c.completion_status === "completed").length;
      const successRate = Math.round((completed / convos.length) * 100);

      return {
        user_id,
        totalSessions: convos.length,
        firstSeen:     firstSeen.slice(0, 10),
        lastSeen:      lastSeen.slice(0, 10),
        intents,
        successRate,
        status: (lastTs < churnCutoff ? "churned" : "active") as "active" | "churned",
        conversations: convos.map((c) => ({
          conversation_id:   c.conversation_id,
          intent:            c.intent,
          quality_score:     c.quality_score,
          completion_status: c.completion_status,
          created_at:        c.created_at,
        })),
      };
    })
    // Active users first, then sort by last seen descending
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

  return NextResponse.json({ funnel, users });
}
