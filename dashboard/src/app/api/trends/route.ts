import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface TrendDataPoint {
  date: string;
  totalConversations: number;
  avgQualityScore: number;
  completionRate: number;
  failureRate: number;
  topIntent: string;
  platformBreakdown: Record<string, number>;
}

interface TrendsResponse {
  timeframe: string;
  dataPoints: TrendDataPoint[];
  insights: {
    qualityTrend: 'improving' | 'declining' | 'stable';
    qualityChange: number;
    completionTrend: 'improving' | 'declining' | 'stable';
    completionChange: number;
    growthRate: number;
    anomalies: Array<{
      date: string;
      type: 'quality_drop' | 'volume_spike' | 'failure_spike';
      description: string;
    }>;
  };
}

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
  const interval = req.nextUrl.searchParams.get("interval") ?? "daily"; // daily, weekly, monthly
  
  // Demo mode: return mock trends data
  if (segment) {
    return NextResponse.json(generateMockTrends(segment, days, interval));
  }

  const sb = getSupabaseServer();

  try {
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch conversation data within date range
    const { data: conversations, error } = await sb
      .from("conversations")
      .select("id, quality_score, completion_status, created_at, intent, metadata")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching trends data:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        timeframe: `${days} days`,
        dataPoints: [],
        insights: {
          qualityTrend: 'stable' as const,
          qualityChange: 0,
          completionTrend: 'stable' as const,
          completionChange: 0,
          growthRate: 0,
          anomalies: []
        }
      });
    }

    // Group data by time interval
    const groupedData = groupByInterval(conversations, interval);
    const dataPoints: TrendDataPoint[] = [];

    // Process each time bucket
    for (const [dateKey, convos] of Object.entries(groupedData)) {
      const totalConversations = convos.length;
      
      // Calculate quality score average
      const qualityScores = convos.filter(c => c.quality_score !== null).map(c => c.quality_score!);
      const avgQualityScore = qualityScores.length > 0 
        ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
        : 0;

      // Calculate completion rate
      const completedCount = convos.filter(c => c.completion_status === 'completed').length;
      const completionRate = totalConversations > 0 
        ? Math.round((completedCount / totalConversations) * 1000) / 10
        : 0;

      // Calculate failure rate
      const failedCount = convos.filter(c => 
        c.completion_status === 'failed' || c.completion_status === 'abandoned'
      ).length;
      const failureRate = totalConversations > 0 
        ? Math.round((failedCount / totalConversations) * 1000) / 10
        : 0;

      // Find top intent
      const intentCounts: Record<string, number> = {};
      convos.forEach(c => {
        if (c.intent) {
          intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1;
        }
      });
      const topIntent = Object.entries(intentCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

      // Platform breakdown
      const platformBreakdown: Record<string, number> = {};
      convos.forEach(c => {
        const metadata = c.metadata as Record<string, unknown> | null;
        const platform = (metadata?.platform as string) ?? 'unknown';
        platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
      });

      dataPoints.push({
        date: dateKey,
        totalConversations,
        avgQualityScore,
        completionRate,
        failureRate,
        topIntent,
        platformBreakdown
      });
    }

    // Generate insights
    const insights = generateInsights(dataPoints);

    return NextResponse.json({
      timeframe: `${days} days`,
      dataPoints,
      insights
    });

  } catch (error) {
    console.error("Unexpected error in trends API:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching trends data" },
      { status: 500 }
    );
  }
}

function groupByInterval(conversations: any[], interval: string): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  conversations.forEach(convo => {
    const date = new Date(convo.created_at);
    let key: string;

    switch (interval) {
      case 'weekly':
        // Get start of week (Monday)
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + 1);
        key = startOfWeek.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      default: // daily
        key = date.toISOString().split('T')[0];
        break;
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(convo);
  });

  return grouped;
}

function generateInsights(dataPoints: TrendDataPoint[]): TrendsResponse['insights'] {
  if (dataPoints.length < 2) {
    return {
      qualityTrend: 'stable',
      qualityChange: 0,
      completionTrend: 'stable', 
      completionChange: 0,
      growthRate: 0,
      anomalies: []
    };
  }

  // Calculate trends
  const firstHalf = dataPoints.slice(0, Math.ceil(dataPoints.length / 2));
  const secondHalf = dataPoints.slice(Math.ceil(dataPoints.length / 2));

  const firstHalfQuality = firstHalf.reduce((sum, dp) => sum + dp.avgQualityScore, 0) / firstHalf.length;
  const secondHalfQuality = secondHalf.reduce((sum, dp) => sum + dp.avgQualityScore, 0) / secondHalf.length;
  const qualityChange = Math.round(((secondHalfQuality - firstHalfQuality) / firstHalfQuality) * 1000) / 10;

  const firstHalfCompletion = firstHalf.reduce((sum, dp) => sum + dp.completionRate, 0) / firstHalf.length;
  const secondHalfCompletion = secondHalf.reduce((sum, dp) => sum + dp.completionRate, 0) / secondHalf.length;
  const completionChange = Math.round(((secondHalfCompletion - firstHalfCompletion) / firstHalfCompletion) * 1000) / 10;

  // Growth rate calculation
  const firstConversations = firstHalf.reduce((sum, dp) => sum + dp.totalConversations, 0);
  const secondConversations = secondHalf.reduce((sum, dp) => sum + dp.totalConversations, 0);
  const growthRate = firstConversations > 0 
    ? Math.round(((secondConversations - firstConversations) / firstConversations) * 1000) / 10
    : 0;

  // Detect anomalies
  const anomalies: TrendsResponse['insights']['anomalies'] = [];
  
  // Quality drops
  dataPoints.forEach((dp, i) => {
    if (i > 0) {
      const prevDp = dataPoints[i - 1];
      const qualityDrop = ((dp.avgQualityScore - prevDp.avgQualityScore) / prevDp.avgQualityScore) * 100;
      if (qualityDrop < -20) {
        anomalies.push({
          date: dp.date,
          type: 'quality_drop',
          description: `Quality dropped ${Math.abs(Math.round(qualityDrop))}% from previous period`
        });
      }

      const volumeSpike = ((dp.totalConversations - prevDp.totalConversations) / prevDp.totalConversations) * 100;
      if (volumeSpike > 50) {
        anomalies.push({
          date: dp.date,
          type: 'volume_spike',
          description: `Conversation volume increased ${Math.round(volumeSpike)}% from previous period`
        });
      }

      const failureSpike = dp.failureRate - prevDp.failureRate;
      if (failureSpike > 15) {
        anomalies.push({
          date: dp.date,
          type: 'failure_spike',
          description: `Failure rate increased ${Math.round(failureSpike)}% from previous period`
        });
      }
    }
  });

  return {
    qualityTrend: qualityChange > 5 ? 'improving' : qualityChange < -5 ? 'declining' : 'stable',
    qualityChange,
    completionTrend: completionChange > 5 ? 'improving' : completionChange < -5 ? 'declining' : 'stable',
    completionChange,
    growthRate,
    anomalies: anomalies.slice(0, 5) // Limit to 5 most recent anomalies
  };
}

function generateMockTrends(segment: string, days: number, interval: string): TrendsResponse {
  // Generate mock trend data for demo mode
  const dataPoints: TrendDataPoint[] = [];
  const intervalCount = interval === 'daily' ? Math.min(days, 30) : interval === 'weekly' ? Math.min(Math.ceil(days / 7), 8) : Math.min(Math.ceil(days / 30), 6);
  
  for (let i = 0; i < intervalCount; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (intervalCount - i - 1) * (interval === 'daily' ? 1 : interval === 'weekly' ? 7 : 30));
    
    const baseQuality = 65 + Math.random() * 20;
    const baseConversations = 100 + Math.random() * 200;
    
    dataPoints.push({
      date: date.toISOString().split('T')[0],
      totalConversations: Math.round(baseConversations),
      avgQualityScore: Math.round(baseQuality),
      completionRate: Math.round(baseQuality * 0.8 + Math.random() * 10),
      failureRate: Math.round(20 - baseQuality * 0.2 + Math.random() * 10),
      topIntent: ['billing_inquiry', 'technical_problem', 'feature_request', 'account_access'][Math.floor(Math.random() * 4)],
      platformBreakdown: {
        chatgpt: Math.round(Math.random() * 50),
        claude: Math.round(Math.random() * 30),
        gemini: Math.round(Math.random() * 20)
      }
    });
  }

  return {
    timeframe: `${days} days`,
    dataPoints,
    insights: {
      qualityTrend: 'improving',
      qualityChange: 12.5,
      completionTrend: 'stable',
      completionChange: 2.1,
      growthRate: 23.8,
      anomalies: []
    }
  };
}