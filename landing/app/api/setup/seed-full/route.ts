import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

export const maxDuration = 60;

const INTENTS = [
  "billing_dispute_with_context",
  "cancel_subscription_flow",
  "account_access_locked",
  "refund_status_inquiry",
  "reschedule_appointment",
  "upgrade_plan",
  "check_balance",
  "shipping_status",
  "password_reset",
  "product_return",
  "technical_support",
  "payment_failed",
];

const OUTCOMES = ["resolved", "gave_up", "escalated", "abandoned"];

// Intent-specific outcome weights: [resolved, gave_up, escalated, abandoned]
const INTENT_WEIGHTS: Record<string, number[]> = {
  billing_dispute_with_context: [0.14, 0.45, 0.35, 0.06],
  cancel_subscription_flow: [0.22, 0.38, 0.32, 0.08],
  account_access_locked: [0.38, 0.30, 0.25, 0.07],
  refund_status_inquiry: [0.55, 0.25, 0.15, 0.05],
  reschedule_appointment: [0.91, 0.04, 0.03, 0.02],
  upgrade_plan: [0.85, 0.08, 0.04, 0.03],
  check_balance: [0.88, 0.06, 0.03, 0.03],
  shipping_status: [0.72, 0.15, 0.08, 0.05],
  password_reset: [0.80, 0.10, 0.06, 0.04],
  product_return: [0.65, 0.18, 0.12, 0.05],
  technical_support: [0.60, 0.20, 0.15, 0.05],
  payment_failed: [0.70, 0.15, 0.10, 0.05],
};

const TRANSCRIPTS: Record<string, Record<string, { role: string; text: string }[]>> = {
  billing_dispute_with_context: {
    gave_up: [
      { role: "caller", text: "I was charged $49 but I downgraded to free last Tuesday." },
      { role: "agent", text: "I can help with billing! Your current plan is Free." },
      { role: "caller", text: "I KNOW I'm on free. I'm asking about the $49 CHARGE." },
      { role: "agent", text: "For billing questions, please visit our help center." },
      { role: "caller", text: "This is useless." },
    ],
    resolved: [
      { role: "caller", text: "I see a $49 charge but I downgraded last week." },
      { role: "agent", text: "I can see your downgrade on March 29th. The $49 was charged before it took effect. I'll initiate a refund now." },
      { role: "caller", text: "Great, when will I see it?" },
      { role: "agent", text: "Within 3-5 business days. Confirmation email sent." },
      { role: "caller", text: "Perfect, thanks!" },
    ],
    escalated: [
      { role: "caller", text: "I got charged $49 after downgrading. Fix this now." },
      { role: "agent", text: "I can help with billing! Your current plan is..." },
      { role: "caller", text: "Get me a real person." },
      { role: "agent", text: "Transferring you now." },
    ],
  },
  cancel_subscription_flow: {
    gave_up: [
      { role: "caller", text: "I need to cancel my subscription." },
      { role: "agent", text: "Have you considered our discounted annual plan?" },
      { role: "caller", text: "No. I want to cancel." },
      { role: "agent", text: "Let me transfer you to our retention team." },
      { role: "caller", text: "Forget it." },
    ],
    resolved: [
      { role: "caller", text: "Cancel my subscription please." },
      { role: "agent", text: "I've cancelled your Pro plan. It stays active until April 14th." },
      { role: "caller", text: "Thanks." },
    ],
    escalated: [
      { role: "caller", text: "Cancel. Now." },
      { role: "agent", text: "I'd love to explore options—" },
      { role: "caller", text: "Human. Now." },
      { role: "agent", text: "Connecting you." },
    ],
  },
  reschedule_appointment: {
    resolved: [
      { role: "caller", text: "Move my Thursday appointment to next week." },
      { role: "agent", text: "I have Tuesday 10am or Wednesday 3pm. Which works?" },
      { role: "caller", text: "Tuesday." },
      { role: "agent", text: "Done! Rescheduled to Tuesday at 10am." },
    ],
  },
};

const DEFAULT_TRANSCRIPT = {
  resolved: [
    { role: "caller", text: "Hi, I need help with my account." },
    { role: "agent", text: "I'd be happy to help. What do you need?" },
    { role: "caller", text: "Just need to update my payment method." },
    { role: "agent", text: "Done! Your payment method has been updated." },
    { role: "caller", text: "Thanks." },
  ],
  gave_up: [
    { role: "caller", text: "I have a problem." },
    { role: "agent", text: "I can help! Could you provide more details?" },
    { role: "caller", text: "I already explained this twice." },
    { role: "agent", text: "For further assistance, please visit our help center." },
    { role: "caller", text: "Ok thanks." },
  ],
  escalated: [
    { role: "caller", text: "This isn't working. Get me a person." },
    { role: "agent", text: "I apologize. Let me connect you." },
  ],
  abandoned: [
    { role: "agent", text: "Thank you for calling! How can I help?" },
  ],
};

function pickWeighted(weights: number[]): number {
  const r = Math.random();
  let cumul = 0;
  for (let i = 0; i < weights.length; i++) {
    cumul += weights[i];
    if (r < cumul) return i;
  }
  return weights.length - 1;
}

function getTranscript(intent: string, outcome: string) {
  const intentTs = TRANSCRIPTS[intent];
  if (intentTs && intentTs[outcome]) return intentTs[outcome];
  if (intentTs) {
    const keys = Object.keys(intentTs);
    if (keys.length > 0) return intentTs[keys[0]];
  }
  return (DEFAULT_TRANSCRIPT as any)[outcome] || DEFAULT_TRANSCRIPT.resolved;
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.orgId;

  // Delete existing calls for this org to start fresh
  await sql`DELETE FROM calls WHERE org_id = ${orgId}::uuid`;

  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  weekStart.setHours(0, 0, 0, 0);

  let inserted = 0;

  // Generate ~60 calls per week for 8 weeks = ~480 calls
  for (let weekOffset = 7; weekOffset >= 0; weekOffset--) {
    const wStart = new Date(weekStart);
    wStart.setDate(wStart.getDate() - weekOffset * 7);

    // Vary volume per week: 45-75 calls
    const callsThisWeek = 45 + Math.floor(Math.random() * 30);

    for (let c = 0; c < callsThisWeek; c++) {
      // Pick intent (weighted toward failing ones)
      const intentIdx = Math.floor(Math.random() * INTENTS.length);
      const intent = INTENTS[intentIdx];

      // Pick outcome based on intent weights
      const weights = INTENT_WEIGHTS[intent] || [0.5, 0.25, 0.15, 0.10];
      const outcomeIdx = pickWeighted(weights);
      const outcome = OUTCOMES[outcomeIdx];

      // Sentiment: correlate with outcome
      let sentiment: number;
      if (outcome === "resolved") sentiment = 3.5 + Math.random() * 1.5;
      else if (outcome === "gave_up") sentiment = 1.2 + Math.random() * 1.5;
      else if (outcome === "escalated") sentiment = 0.8 + Math.random() * 1.5;
      else sentiment = 2 + Math.random() * 2;

      // Flags
      const flags: string[] = [];
      if (outcome === "gave_up" && Math.random() < 0.35) flags.push("polite_churner");
      if (outcome === "escalated" && Math.random() < 0.25) flags.push("frustration_transfer");
      if (Math.random() < 0.12) flags.push("repeat_caller");

      // Duration
      const baseDur = outcome === "resolved" ? 110 : outcome === "gave_up" ? 80 : outcome === "escalated" ? 65 : 25;
      const duration = Math.max(15, Math.round(baseDur + (Math.random() - 0.5) * 60));

      // Timestamp: random time during the week
      const dayInWeek = Math.floor(Math.random() * 7);
      const hour = 8 + Math.floor(Math.random() * 10);
      const minute = Math.floor(Math.random() * 60);
      const startedAt = new Date(wStart);
      startedAt.setDate(startedAt.getDate() + dayInWeek);
      startedAt.setHours(hour, minute, 0, 0);
      const endedAt = new Date(startedAt.getTime() + duration * 1000);

      const transcript = getTranscript(intent, outcome);
      const confidence = 0.75 + Math.random() * 0.2;

      // Simple analysis text
      const analyses: Record<string, string> = {
        resolved: `Caller asked about ${intent.replace(/_/g, " ")}. Agent resolved the issue directly.`,
        gave_up: `Caller needed help with ${intent.replace(/_/g, " ")}. Agent failed to address the specific issue. Caller disengaged.`,
        escalated: `Caller requested human agent after AI failed to handle ${intent.replace(/_/g, " ")}.`,
        abandoned: `Call ended before meaningful interaction on ${intent.replace(/_/g, " ")}.`,
      };

      await sql`
        INSERT INTO calls (org_id, external_call_id, platform, started_at, ended_at, duration_seconds,
          transcript, intent, outcome, outcome_confidence, sentiment_score, flags, ai_analysis, analysis_status)
        VALUES (${orgId}::uuid, ${"seed-" + inserted}, 'vapi', ${startedAt.toISOString()}, ${endedAt.toISOString()}, ${duration},
          ${JSON.stringify(transcript)}, ${intent}, ${outcome}, ${confidence}, ${Math.round(sentiment * 10) / 10},
          ${flags as any}, ${analyses[outcome]}, 'done')
      `;
      inserted++;
    }
  }

  return NextResponse.json({ seeded: true, count: inserted });
}
