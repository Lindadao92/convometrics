import { NextRequest, NextResponse } from "next/server";
import { getSegmentConversations } from "@/lib/mockSegmentData";

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
  const total = convos.length;

  // "Reported" metrics — raw surface-level stats
  const completed = convos.filter(c => c.session_status === "Deep" || c.session_status === "Normal");
  const reportedResolution = total > 0 ? Math.round((completed.length / total) * 1000) / 10 : 0;
  const reportedCSAT = total > 0 ? Math.round((convos.reduce((s, c) => s + c.scores.satisfaction, 0) / total) / 20 * 10) / 10 : 0; // Scale 0-100 to 0-5
  const reportedAvgMessages = total > 0 ? Math.round(convos.reduce((s, c) => s + c.turns, 0) / total * 10) / 10 : 0;

  // "Actual" metrics — adjusted for false positives
  // False positives: completed but frustrated/abandoned satisfaction, or had failure tags
  const falsePositives = completed.filter(c =>
    c.inferred_satisfaction === "frustrated" ||
    c.inferred_satisfaction === "abandoned" ||
    c.failure_tags.length > 1
  );
  const actualResolved = completed.length - falsePositives.length;
  const actualResolution = total > 0 ? Math.round((actualResolved / total) * 1000) / 10 : 0;

  // Actual CSAT: adjust for inflated satisfaction scores
  // Polite churners and frustrated users have misleadingly high raw satisfaction —
  // cap their contribution to reflect actual experience
  const actualCSATSum = convos.reduce((sum, c) => {
    let sat = c.scores.satisfaction;
    // Frustrated/abandoned users: cap satisfaction at 30 (their real experience)
    if (c.inferred_satisfaction === "frustrated" || c.inferred_satisfaction === "abandoned") {
      sat = Math.min(sat, 30);
    }
    // Polite churners: discount satisfaction by quality ratio
    if (c.satisfaction_signals.includes("gratitude") && (c.scores.overall < 72 || c.failure_tags.length >= 2)) {
      sat = sat * (c.scores.overall / 100);
    }
    return sum + sat;
  }, 0);
  const actualCSAT = total > 0 ? Math.round((actualCSATSum / total) / 20 * 10) / 10 : 0;

  // Actual avg messages: only for truly resolved conversations
  const trulyResolved = convos.filter(c =>
    (c.session_status === "Deep" || c.session_status === "Normal") &&
    c.inferred_satisfaction === "satisfied"
  );
  const actualAvgMessages = trulyResolved.length > 0 ? Math.round(trulyResolved.reduce((s, c) => s + c.turns, 0) / trulyResolved.length * 10) / 10 : 0;

  // Meaningful conversations: exclude loops, dead-ends, premature closures
  const loops = convos.filter(c =>
    c.satisfaction_signals.includes("retry_pattern") ||
    (c.turns <= 2 && c.session_status === "Brief") ||
    (c.session_status === "Abandoned" && c.turns <= 3)
  );
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
}
