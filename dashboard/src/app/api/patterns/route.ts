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

  // Pattern 1: Polite Churner — users who show "gratitude" signals but had a below-average experience
  // These are users who say "thanks" but didn't truly get what they needed
  const politeChurners = convos.filter(c =>
    c.satisfaction_signals.includes("gratitude") &&
    (c.scores.overall < 72 || c.failure_tags.length >= 2)
  );

  // Pattern 2: Frustration Transfer — conversations with escalation_request signal
  const frustrationTransfers = convos.filter(c =>
    c.satisfaction_signals.includes("escalation_request") ||
    (c.inferred_satisfaction === "frustrated" && c.turns > 5)
  );

  // Pattern 3: Exhaustion Loop — conversations with retry_pattern or rephrasing + many turns
  const exhaustionLoops = convos.filter(c =>
    (c.satisfaction_signals.includes("retry_pattern") || c.satisfaction_signals.includes("rephrasing")) &&
    c.turns > 6
  );

  return NextResponse.json({
    total,
    politeChurner: {
      count: politeChurners.length,
      pct: total > 0 ? Math.round((politeChurners.length / total) * 1000) / 10 : 0,
      avgQuality: politeChurners.length > 0 ? Math.round(politeChurners.reduce((s, c) => s + c.scores.overall, 0) / politeChurners.length) : 0,
      examples: politeChurners.slice(0, 3).map(c => ({
        id: c.id,
        intent: c.intent,
        turns: c.turns,
        quality: Math.round(c.scores.overall),
        signals: c.satisfaction_signals,
      })),
    },
    frustrationTransfer: {
      count: frustrationTransfers.length,
      pct: total > 0 ? Math.round((frustrationTransfers.length / total) * 1000) / 10 : 0,
      avgTurns: frustrationTransfers.length > 0 ? Math.round(frustrationTransfers.reduce((s, c) => s + c.turns, 0) / frustrationTransfers.length * 10) / 10 : 0,
      examples: frustrationTransfers.slice(0, 3).map(c => ({
        id: c.id,
        intent: c.intent,
        turns: c.turns,
        quality: Math.round(c.scores.overall),
        satisfaction: c.inferred_satisfaction,
      })),
    },
    exhaustionLoop: {
      count: exhaustionLoops.length,
      pct: total > 0 ? Math.round((exhaustionLoops.length / total) * 1000) / 10 : 0,
      avgTurns: exhaustionLoops.length > 0 ? Math.round(exhaustionLoops.reduce((s, c) => s + c.turns, 0) / exhaustionLoops.length * 10) / 10 : 0,
      examples: exhaustionLoops.slice(0, 3).map(c => ({
        id: c.id,
        intent: c.intent,
        turns: c.turns,
        quality: Math.round(c.scores.overall),
      })),
    },
  });
}
