// ─── Dynamic Topics API Route for Convometrics ────────────────────────────────
// Add to: /Users/linda/convometrics/dashboard/src/app/api/dynamic-topics/route.ts
//
// This API route provides dynamic topic discovery capabilities
// to identify emerging conversation patterns beyond hardcoded intents

import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations, getSegmentMeta } from "@/lib/mockSegmentData";
import { runTopicDiscoveryAnalysis } from "@/lib/dynamic-topic-discovery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const includePatterns = req.nextUrl.searchParams.get("patterns") !== "false";
  const includeInsights = req.nextUrl.searchParams.get("insights") !== "false";
  
  try {
    // Get conversation data for the segment
    const allConvos = getSegmentConversations(segment);
    const cutoff = Date.now() - days * 86400000;
    const conversations = allConvos.filter(c => new Date(c.timestamp).getTime() >= cutoff);
    
    if (conversations.length === 0) {
      return NextResponse.json({
        error: "No conversations found for the specified segment and time range",
        segment,
        days,
        total: 0,
      }, { status: 404 });
    }
    
    // Get known intents for this segment
    const segmentMeta = getSegmentMeta(segment);
    const knownIntents = segmentMeta.intents || [];
    
    // Run dynamic topic discovery analysis
    const analysis = runTopicDiscoveryAnalysis(conversations, knownIntents);
    
    // Filter response based on query parameters
    const response: any = {
      segment,
      timeRange: {
        days,
        startDate: new Date(cutoff).toISOString(),
        endDate: new Date().toISOString(),
      },
      summary: analysis.summary,
      clusters: analysis.clusters,
    };
    
    if (includePatterns) {
      response.patterns = analysis.patterns;
    }
    
    if (includeInsights) {
      response.insights = analysis.insights;
    }
    
    // Add metadata
    response.metadata = {
      segmentName: segmentMeta.name,
      segmentEmoji: segmentMeta.emoji,
      knownIntentsCount: knownIntents.length,
      analyzedConversations: conversations.length,
      generatedAt: new Date().toISOString(),
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    return NextResponse.json({
      error: "Failed to analyze dynamic topics",
      details: error.message,
      segment,
      days,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversations, knownIntents = [], options = {} } = body;
    
    if (!conversations || !Array.isArray(conversations)) {
      return NextResponse.json({
        error: "conversations array is required",
      }, { status: 400 });
    }
    
    if (conversations.length === 0) {
      return NextResponse.json({
        error: "At least one conversation is required for analysis",
      }, { status: 400 });
    }
    
    // Validate conversation structure
    const invalidConversations = conversations.filter((c: any) => 
      !c.id || !c.timestamp || !c.intent || !c.scores || !c.satisfaction_signals
    );
    
    if (invalidConversations.length > 0) {
      return NextResponse.json({
        error: "Invalid conversation format",
        details: "Each conversation must have: id, timestamp, intent, scores, satisfaction_signals",
        invalidCount: invalidConversations.length,
      }, { status: 400 });
    }
    
    // Run analysis on uploaded data
    const analysis = runTopicDiscoveryAnalysis(conversations, knownIntents);
    
    const response = {
      uploadedData: {
        conversationsCount: conversations.length,
        knownIntentsCount: knownIntents.length,
        timeRange: {
          earliest: Math.min(...conversations.map((c: any) => new Date(c.timestamp).getTime())),
          latest: Math.max(...conversations.map((c: any) => new Date(c.timestamp).getTime())),
        },
      },
      analysis,
      metadata: {
        analyzedAt: new Date().toISOString(),
        processingTimeMs: Date.now(), // Would be calculated in real implementation
      },
    };
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    return NextResponse.json({
      error: "Failed to process uploaded conversation data",
      details: error.message,
    }, { status: 500 });
  }
}

// ─── Additional helper endpoint for cluster details ───────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { clusterId, segment, action } = body;
    
    if (!clusterId || !segment) {
      return NextResponse.json({
        error: "clusterId and segment are required",
      }, { status: 400 });
    }
    
    // Get conversations for detailed cluster analysis
    const allConvos = getSegmentConversations(segment);
    const analysis = runTopicDiscoveryAnalysis(allConvos, []);
    const cluster = analysis.clusters.find(c => c.id === clusterId);
    
    if (!cluster) {
      return NextResponse.json({
        error: "Cluster not found",
        clusterId,
      }, { status: 404 });
    }
    
    // Get detailed conversations for this cluster
    const clusterConversations = allConvos.filter(c => 
      cluster.conversations.includes(c.id)
    );
    
    let response: any = {
      cluster,
      conversationsCount: clusterConversations.length,
    };
    
    switch (action) {
      case "details":
        response.conversations = clusterConversations.map(c => ({
          id: c.id,
          timestamp: c.timestamp,
          intent: c.intent,
          turns: c.turns,
          quality: c.scores.overall,
          satisfaction: c.inferred_satisfaction,
          failureTypes: c.failure_tags.map(f => f.type),
        }));
        break;
        
      case "quality_analysis":
        const qualityBuckets = {
          excellent: clusterConversations.filter(c => c.scores.overall >= 80).length,
          good: clusterConversations.filter(c => c.scores.overall >= 60 && c.scores.overall < 80).length,
          poor: clusterConversations.filter(c => c.scores.overall < 60).length,
        };
        
        response.qualityAnalysis = {
          buckets: qualityBuckets,
          averageQuality: Math.round(
            clusterConversations.reduce((sum, c) => sum + c.scores.overall, 0) / 
            clusterConversations.length
          ),
          qualityTrend: cluster.quality.trend,
        };
        break;
        
      case "failure_analysis":
        const failureMap: Record<string, number> = {};
        clusterConversations.forEach(c => {
          c.failure_tags.forEach(f => {
            failureMap[f.type] = (failureMap[f.type] || 0) + 1;
          });
        });
        
        response.failureAnalysis = {
          topFailures: Object.entries(failureMap)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([type, count]) => ({ type, count })),
          failureRate: Math.round(
            (clusterConversations.filter(c => c.failure_tags.length > 0).length / 
             clusterConversations.length) * 100
          ),
        };
        break;
        
      default:
        return NextResponse.json({
          error: "Invalid action. Supported: details, quality_analysis, failure_analysis",
        }, { status: 400 });
    }
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    return NextResponse.json({
      error: "Failed to get cluster details",
      details: error.message,
    }, { status: 500 });
  }
}

// ─── Example Usage ─────────────────────────────────────────────────────────────
/*

// GET endpoint examples:
// /api/dynamic-topics?segment=ai_assistant&days=30&patterns=true&insights=true
// /api/dynamic-topics?segment=ai_support&days=7&patterns=false

// POST endpoint for custom data:
const response = await fetch('/api/dynamic-topics', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversations: conversationData,
    knownIntents: ['help', 'complaint', 'question'],
    options: { minClusterSize: 5 }
  })
});

// PATCH endpoint for cluster details:
const clusterDetails = await fetch('/api/dynamic-topics', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clusterId: 'cluster_0',
    segment: 'ai_assistant',
    action: 'details'
  })
});

*/