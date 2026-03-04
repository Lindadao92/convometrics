import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations } from "@/lib/mockSegmentData";
import { formatLabel } from "@/lib/formatLabel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  const allConvos = getSegmentConversations(segment);
  // Calculate cutoff at start of day (00:00:00) for consistent timezone handling
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const cutoff = cutoffDate.getTime();
  
  const convos = allConvos.filter(c => {
    try {
      return new Date(c.timestamp).getTime() >= cutoff;
    } catch (e) {
      console.warn('Invalid timestamp format:', c.timestamp);
      return false; // Exclude conversations with invalid timestamps
    }
  });

  // Group by intent and compute failure rates
  const intentMap = new Map<string, { count: number; failCount: number; qualitySum: number; turns: number[] }>();
  for (const c of convos) {
    const g = intentMap.get(c.intent) ?? { count: 0, failCount: 0, qualitySum: 0, turns: [] };
    g.count++;
    g.qualitySum += c.scores.overall;
    g.turns.push(c.turns);
    if (c.session_status === "Abandoned" || c.session_status === "Brief" || c.inferred_satisfaction === "frustrated") {
      g.failCount++;
    }
    intentMap.set(c.intent, g);
  }

  // Sort by failure impact (failure count * failure rate)
  const intentStats = Array.from(intentMap.entries())
    .map(([intent, g]) => ({
      intent,
      name: formatLabel(intent),
      count: g.count,
      failRate: g.count > 0 ? Math.round((g.failCount / g.count) * 1000) / 10 : 0,
      avgQuality: g.count > 0 ? Math.round(g.qualitySum / g.count) : 0,
      avgTurns: g.turns.length > 0 ? Math.round(g.turns.reduce((a, b) => a + b, 0) / g.turns.length * 10) / 10 : 0,
      failCount: g.failCount,
    }))
    .sort((a, b) => b.failCount - a.failCount);

  // Generate 3-5 recommendations
  const actions = intentStats.slice(0, 5).map((stat, i) => {
    const effort = stat.failRate > 50 ? "high" : stat.failRate > 30 ? "medium" : "low";
    const projection = Math.round(stat.failCount * 0.6); // Assume 60% addressable
    return {
      priority: i + 1,
      title: `Improve "${stat.name}" handling`,
      description: `${stat.failRate}% failure rate across ${stat.count} conversations. Average quality score is ${stat.avgQuality}/100 with ${stat.avgTurns} avg turns.`,
      intent: stat.intent,
      effort,
      impact: `~${projection} fewer failures`,
      metric: `${stat.failRate}% failure rate`,
      conversations: stat.count,
      failCount: stat.failCount,
    };
  });

  return NextResponse.json({ actions, totalConversations: convos.length });
}
