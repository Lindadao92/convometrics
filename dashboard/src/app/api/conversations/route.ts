import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const params = req.nextUrl.searchParams;

  const intent   = params.get("intent");
  const status   = params.get("status");
  const platform = params.get("platform");
  const minScore = params.get("min_score");
  const maxScore = params.get("max_score");
  const sortBy   = params.get("sort") || "created_at";
  const order    = params.get("order") || "desc";
  const page     = parseInt(params.get("page") || "0", 10);
  const limit    = 25;

  let query = sb
    .from("conversations")
    .select("id, conversation_id, user_id, intent, quality_score, completion_status, messages, created_at, metadata", { count: "exact" });

  if (intent)   query = query.eq("intent", intent);
  if (status)   query = query.eq("completion_status", status);
  if (platform && platform !== "all") query = query.eq("metadata->>platform", platform);
  if (minScore) query = query.gte("quality_score", parseInt(minScore, 10));
  if (maxScore) query = query.lte("quality_score", parseInt(maxScore, 10));

  query = query
    .order(sortBy, { ascending: order === "asc" })
    .range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Distinct intents for filter dropdown
  const { data: intentRows } = await sb
    .from("conversations")
    .select("intent")
    .not("intent", "is", null);
  const intents = [...new Set((intentRows || []).map((r) => r.intent).filter(Boolean))].sort();

  // Extract platform from metadata for each conversation
  const conversations = (data ?? []).map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return { ...r, platform: (meta?.platform as string) ?? "unknown" };
  });

  return NextResponse.json({ conversations, total: count ?? 0, page, pageSize: limit, intents });
}
