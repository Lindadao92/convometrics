import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations } from "@/lib/mockSegmentData";
import { getDaysCutoff } from "@/lib/timestamp-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);

  try {
    const allConvos = getSegmentConversations(segment);
    
    // Use optimized timestamp calculation
    const cutoff = getDaysCutoff(days);
    const convos = allConvos.filter(c => new Date(c.timestamp).getTime() >= cutoff);
    const total = convos.length;

    if (total === 0) {
      return NextResponse.json({
        total: 0,
        politeChurner: { count: 0, pct: 0, avgQuality: 0, examples: [] },
        frustrationTransfer: { count: 0, pct: 0, avgTurns: 0, examples: [] },
        exhaustionLoop: { count: 0, pct: 0, avgTurns: 0, examples: [] }
      });
    }

    // Optimized pattern detection with single pass
    const politeChurners = [];
    const frustrationTransfers = [];
    const exhaustionLoops = [];

    for (const convo of convos) {
      const hasGratitude = convo.satisfaction_signals.includes("gratitude");
      const hasEscalation = convo.satisfaction_signals.includes("escalation_request");
      const hasRetryPattern = convo.satisfaction_signals.includes("retry_pattern");
      const hasRephrasing = convo.satisfaction_signals.includes("rephrasing");
      const isFrustrated = convo.inferred_satisfaction === "frustrated";
      
      // Pattern 1: Polite Churner
      if (hasGratitude && (convo.scores.overall < 72 || convo.failure_tags.length >= 2)) {
        politeChurners.push(convo);
      }
      
      // Pattern 2: Frustration Transfer
      if (hasEscalation || (isFrustrated && convo.turns > 5)) {
        frustrationTransfers.push(convo);
      }
      
      // Pattern 3: Exhaustion Loop
      if ((hasRetryPattern || hasRephrasing) && convo.turns > 6) {
        exhaustionLoops.push(convo);
      }
    }

    // Helper function to calculate percentage
    const getPct = (count: number) => total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    
    // Helper function to create examples
    const getExamples = (conversations: any[], type: 'polite' | 'frustration' | 'exhaustion') => {
      return conversations.slice(0, 3).map(c => {
        const base = {
          id: c.id,
          intent: c.intent,
          turns: c.turns,
          quality: Math.round(c.scores.overall)
        };
        
        if (type === 'polite') {
          return { ...base, signals: c.satisfaction_signals };
        } else if (type === 'frustration') {
          return { ...base, satisfaction: c.inferred_satisfaction };
        } else {
          return base;
        }
      });
    };

    return NextResponse.json({
      total,
      politeChurner: {
        count: politeChurners.length,
        pct: getPct(politeChurners.length),
        avgQuality: politeChurners.length > 0 
          ? Math.round(politeChurners.reduce((sum, c) => sum + c.scores.overall, 0) / politeChurners.length) 
          : 0,
        examples: getExamples(politeChurners, 'polite'),
      },
      frustrationTransfer: {
        count: frustrationTransfers.length,
        pct: getPct(frustrationTransfers.length),
        avgTurns: frustrationTransfers.length > 0 
          ? Math.round(frustrationTransfers.reduce((sum, c) => sum + c.turns, 0) / frustrationTransfers.length * 10) / 10 
          : 0,
        examples: getExamples(frustrationTransfers, 'frustration'),
      },
      exhaustionLoop: {
        count: exhaustionLoops.length,
        pct: getPct(exhaustionLoops.length),
        avgTurns: exhaustionLoops.length > 0 
          ? Math.round(exhaustionLoops.reduce((sum, c) => sum + c.turns, 0) / exhaustionLoops.length * 10) / 10 
          : 0,
        examples: getExamples(exhaustionLoops, 'exhaustion'),
      },
    });

  } catch (error) {
    console.error("Patterns API error:", error);
    return NextResponse.json(
      { error: "Internal server error" }, 
      { status: 500 }
    );
  }
}