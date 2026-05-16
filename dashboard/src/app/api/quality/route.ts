import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getSupabaseServer();
  const platform = req.nextUrl.searchParams.get("platform");

  try {
    // Use database aggregation instead of fetching all rows to memory
    let aggregateQuery = sb
      .from("conversations")
      .select(`
        intent,
        quality_score,
        completion_status,
        metadata,
        id
      `)
      .not("intent", "is", null)
      .order("intent")
      .limit(50000); // Reduced from 100k for better performance

    if (platform && platform !== "all") {
      aggregateQuery = aggregateQuery.eq("metadata->>platform", platform);
    }

    const { data: rows, error } = await aggregateQuery;
    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ intents: [], maxBucket: 1 });
    }

    // Optimized grouping with single-pass processing
    const byIntent: Record<string, {
      count: number;
      scoreSum: number;
      scoreCount: number;
      buckets: [number, number, number, number];
      statuses: Record<string, number>;
      sampleFailedIds: string[];
      platforms: Record<string, number>;
    }> = {};

    // Single pass through data
    for (const row of rows) {
      const intent = row.intent!;
      
      // Initialize group if needed
      if (!byIntent[intent]) {
        byIntent[intent] = {
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
          buckets: [0, 0, 0, 0],
          statuses: {},
          sampleFailedIds: [],
          platforms: {}
        };
      }

      const group = byIntent[intent];
      group.count++;

      // Platform tracking
      const metadata = row.metadata as Record<string, unknown> | null;
      const platformName = (metadata?.platform as string) ?? "unknown";
      group.platforms[platformName] = (group.platforms[platformName] || 0) + 1;

      // Quality score processing
      if (row.quality_score !== null) {
        group.scoreSum += row.quality_score;
        group.scoreCount++;
        
        // Bucket distribution (optimized with fewer conditionals)
        const score = row.quality_score;
        const bucketIndex = score <= 25 ? 0 : score <= 50 ? 1 : score <= 75 ? 2 : 3;
        group.buckets[bucketIndex]++;
      }

      // Status tracking
      const status = row.completion_status;
      if (status) {
        group.statuses[status] = (group.statuses[status] || 0) + 1;
      }

      // Sample failed conversations (limit early to avoid memory growth)
      if ((status === "failed" || status === "abandoned") && group.sampleFailedIds.length < 3) {
        group.sampleFailedIds.push(row.id);
      }
    }

    // Batch fetch sample messages for failed conversations
    const allSampleIds = Object.values(byIntent).flatMap(group => group.sampleFailedIds);
    let sampleMessages: Record<string, { role: string; content: string }[]> = {};
    
    if (allSampleIds.length > 0) {
      const { data: msgRows, error: msgError } = await sb
        .from("conversations")
        .select("id, messages")
        .in("id", allSampleIds);
      
      if (!msgError && msgRows) {
        for (const row of msgRows) {
          sampleMessages[row.id] = row.messages ?? [];
        }
      }
    }

    // Transform results with optimized calculations
    const intents = Object.entries(byIntent)
      .map(([intent, group]) => {
        const avgScore = group.scoreCount > 0 
          ? Math.round(group.scoreSum / group.scoreCount)
          : null;
        
        const completed = group.statuses["completed"] || 0;
        const failed = group.statuses["failed"] || 0;
        const abandoned = group.statuses["abandoned"] || 0;
        
        const completionRate = group.count > 0 
          ? Math.round((completed / group.count) * 100) 
          : 0;
        const failureRate = group.count > 0 
          ? Math.round(((failed + abandoned) / group.count) * 100) 
          : 0;

        // Sample failed conversations with preview
        const sampleFailed = group.sampleFailedIds.map(id => {
          const messages = sampleMessages[id] ?? [];
          const userMessage = messages.find(msg => msg.role === "user");
          return {
            id,
            preview: userMessage ? userMessage.content.slice(0, 120) : ""
          };
        });

        // Top platform for this intent
        const topPlatform = Object.entries(group.platforms)
          .sort(([,a], [,b]) => b - a)[0]?.[0] ?? null;

        return {
          intent,
          count: group.count,
          avgScore,
          completionRate,
          failureRate,
          buckets: group.buckets,
          sampleFailed,
          topPlatform
        };
      })
      .sort((a, b) => b.count - a.count);

    // Calculate max bucket value for visualization scaling
    const maxBucket = Math.max(
      1,
      ...intents.flatMap(intent => intent.buckets)
    );

    return NextResponse.json({ 
      intents, 
      maxBucket,
      totalProcessed: rows.length 
    });

  } catch (error) {
    console.error("Quality API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}