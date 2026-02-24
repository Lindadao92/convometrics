import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET() {
  const sb = getSupabaseServer();

  // Parallel: total count, analyzed count, per-platform counts
  const [totalRes, analyzedRes, ...platformResults] = await Promise.all([
    sb.from("conversations").select("*", { count: "exact", head: true }),
    sb.from("conversations").select("*", { count: "exact", head: true }).not("intent", "is", null),
    ...PLATFORMS.map((p) =>
      sb.from("conversations").select("*", { count: "exact", head: true }).eq("metadata->>platform", p)
    ),
  ]);

  // Date range — two cheap single-row queries
  const [{ data: dateStart }, { data: dateEnd }] = await Promise.all([
    sb.from("conversations").select("created_at").order("created_at", { ascending: true }).limit(1),
    sb.from("conversations").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const total = totalRes.count ?? 0;
  const analyzedCount = analyzedRes.count ?? 0;

  const platformCounts = PLATFORMS.map((p, i) => ({
    platform: p,
    count: platformResults[i].count ?? 0,
  }));
  const activePlatforms = platformCounts.filter((p) => p.count > 0).map((p) => p.platform);

  return NextResponse.json({
    productName: "Character.ai",
    productDescription:
      "2,500 companion conversations analyzed across roleplay, emotional support, casual chat, and 6 other intents.",
    isMultiPlatform: activePlatforms.length > 1,
    platforms: activePlatforms,
    hasAnalyzedData: analyzedCount > 0,
    totalConversations: total,
    analyzedCount,
    dateRange: {
      start: (dateStart?.[0] as { created_at: string } | undefined)?.created_at ?? null,
      end: (dateEnd?.[0] as { created_at: string } | undefined)?.created_at ?? null,
    },
  });
}
