import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations } from "@/lib/mockSegmentData";
import { getDaysCutoff } from "@/lib/timestamp-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  try {
    const allConvos = getSegmentConversations(segment);
    
    // Use optimized timestamp calculation to avoid month boundary issues
    const cutoff = getDaysCutoff(days);
    const convos = allConvos.filter(c => new Date(c.timestamp).getTime() >= cutoff);
    const total = convos.length;

    if (total === 0) {
      return NextResponse.json({
        total: 0,
        reported: { resolution: 0, csat: 0, avgMessages: 0, conversations: 0 },
        actual: { resolution: 0, csat: 0, avgMessages: 0, actualAvgMessages: 0, conversations: 0, falsePositives: 0, loops: 0 }
      });
    }

    // Optimized filtering with single pass
    const completed = [];
    const falsePositives = [];
    const loops = [];
    const trulyResolved = [];
    
    let reportedCSATSum = 0;
    let actualCSATSum = 0;
    let totalTurns = 0;
    let resolvedTurns = 0;

    // Single pass through conversations for all calculations
    for (const convo of convos) {
      const isCompleted = convo.session_status === "Deep" || convo.session_status === "Normal";
      const isFrustrated = convo.inferred_satisfaction === "frustrated" || convo.inferred_satisfaction === "abandoned";
      const hasFailureTags = convo.failure_tags.length > 1;
      const hasGratitude = convo.satisfaction_signals.includes("gratitude");
      const hasRetryPattern = convo.satisfaction_signals.includes("retry_pattern") || convo.satisfaction_signals.includes("rephrasing");
      
      // Track completed conversations
      if (isCompleted) {
        completed.push(convo);
        
        // Identify false positives
        if (isFrustrated || hasFailureTags) {
          falsePositives.push(convo);
        }
      }

      // Track truly resolved conversations
      if (isCompleted && convo.inferred_satisfaction === "satisfied") {
        trulyResolved.push(convo);
        resolvedTurns += convo.turns;
      }

      // Track loops and dead-ends
      if (hasRetryPattern || 
          (convo.turns <= 2 && convo.session_status === "Brief") ||
          (convo.session_status === "Abandoned" && convo.turns <= 3)) {
        loops.push(convo);
      }

      // Calculate satisfaction scores
      reportedCSATSum += convo.scores.satisfaction;
      totalTurns += convo.turns;

      // Calculate adjusted satisfaction for actual CSAT
      let adjustedSatisfaction = convo.scores.satisfaction;
      
      // Cap frustrated/abandoned users' satisfaction
      if (isFrustrated) {
        adjustedSatisfaction = Math.min(adjustedSatisfaction, 30);
      }
      
      // Discount polite churners' satisfaction
      if (hasGratitude && (convo.scores.overall < 72 || hasFailureTags)) {
        adjustedSatisfaction = adjustedSatisfaction * (convo.scores.overall / 100);
      }
      
      actualCSATSum += adjustedSatisfaction;
    }

    // Calculate metrics
    const reportedResolution = Math.round((completed.length / total) * 1000) / 10;
    const reportedCSAT = Math.round((reportedCSATSum / total) / 20 * 10) / 10; // Scale 0-100 to 0-5
    const reportedAvgMessages = Math.round((totalTurns / total) * 10) / 10;

    const actualResolved = completed.length - falsePositives.length;
    const actualResolution = Math.round((actualResolved / total) * 1000) / 10;
    const actualCSAT = Math.round((actualCSATSum / total) / 20 * 10) / 10;
    const actualAvgMessages = trulyResolved.length > 0 
      ? Math.round((resolvedTurns / trulyResolved.length) * 10) / 10 
      : 0;

    const meaningful = total - loops.length;

    return NextResponse.json({
      total,
      reported: {
        resolution: reportedResolution,
        csat: reportedCSAT,
        avgMessages: reportedAvgMessages,
        conversations: total,
      },
      actual: {
        resolution: actualResolution,
        csat: actualCSAT,
        avgMessages: reportedAvgMessages, // Use reported for "all conversations" avg
        actualAvgMessages: actualAvgMessages, // Successful only
        conversations: meaningful,
        falsePositives: falsePositives.length,
        loops: loops.length,
      },
    });

  } catch (error) {
    console.error("Reality check API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}