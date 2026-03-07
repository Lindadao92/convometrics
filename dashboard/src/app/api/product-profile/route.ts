import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PLATFORMS = ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const;

export async function GET() {
  try {
    const sb = getSupabaseServer();

    // Parallel: total count, analyzed count, per-platform counts
    const [totalRes, analyzedRes, ...platformResults] = await Promise.all([
      sb.from("conversations").select("*", { count: "exact", head: true }),
      sb.from("conversations").select("*", { count: "exact", head: true }).not("intent", "is", null),
      ...PLATFORMS.map((p) =>
        sb.from("conversations").select("*", { count: "exact", head: true }).eq("metadata->>platform", p)
      ),
    ]);

    // Check for database errors
    if (totalRes.error) {
      console.error("Error fetching total conversations:", totalRes.error);
      throw new Error("Failed to fetch conversation data");
    }

    if (analyzedRes.error) {
      console.error("Error fetching analyzed conversations:", analyzedRes.error);
      throw new Error("Failed to fetch analyzed conversation data");
    }

    // Check platform result errors
    for (let i = 0; i < platformResults.length; i++) {
      if (platformResults[i].error) {
        console.error(`Error fetching ${PLATFORMS[i]} data:`, platformResults[i].error);
        throw new Error(`Failed to fetch ${PLATFORMS[i]} conversation data`);
      }
    }

    // Date range — two cheap single-row queries
    const [dateStartRes, dateEndRes] = await Promise.all([
      sb.from("conversations").select("created_at").order("created_at", { ascending: true }).limit(1),
      sb.from("conversations").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);

    // Check date query errors
    if (dateStartRes.error) {
      console.error("Error fetching start date:", dateStartRes.error);
      throw new Error("Failed to fetch conversation date range");
    }

    if (dateEndRes.error) {
      console.error("Error fetching end date:", dateEndRes.error);
      throw new Error("Failed to fetch conversation date range");
    }

    const total = totalRes.count ?? 0;
    const analyzedCount = analyzedRes.count ?? 0;

    const platformCounts = PLATFORMS.map((p, i) => ({
      platform: p,
      count: platformResults[i].count ?? 0,
    }));
    const activePlatforms = platformCounts.filter((p) => p.count > 0).map((p) => p.platform);

    // Return successful response
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
        start: (dateStartRes.data?.[0] as { created_at: string } | undefined)?.created_at ?? null,
        end: (dateEndRes.data?.[0] as { created_at: string } | undefined)?.created_at ?? null,
      },
    });
  } catch (error) {
    console.error("Product profile API error:", error);
    
    // Return appropriate error response
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { 
        error: errorMessage,
        code: "PRODUCT_PROFILE_ERROR"
      }, 
      { status: 500 }
    );
  }
}