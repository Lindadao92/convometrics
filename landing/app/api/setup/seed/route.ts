import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getSession } from "@/lib/auth";

const DEMO_CALLS = [
  {
    external_call_id: "demo_001",
    platform: "vapi",
    duration_seconds: 204,
    transcript: [
      { role: "caller", text: "Hi, I was charged $49 but I downgraded to the free plan last Tuesday." },
      { role: "agent", text: "I can help with billing! Your current plan is Free. You have access to our core features including..." },
      { role: "caller", text: "I KNOW I'm on free. I'm asking about the $49 CHARGE." },
      { role: "agent", text: "For billing questions, please visit our help center at support.example.com/billing." },
      { role: "caller", text: "This is useless." },
    ],
    intent: "billing_dispute_with_context",
    outcome: "gave_up",
    outcome_confidence: 0.92,
    sentiment_score: 1.4,
    flags: ["frustration_transfer"],
    ai_analysis: "Caller asked about a specific historical charge after downgrading. Agent answered with current plan info instead of addressing the $49 charge. Caller grew frustrated and hung up. Classic context mismatch — agent answered a question that wasn't asked.",
  },
  {
    external_call_id: "demo_002",
    platform: "vapi",
    duration_seconds: 156,
    transcript: [
      { role: "caller", text: "I need to cancel my subscription." },
      { role: "agent", text: "I'd be happy to help you explore your options! Have you considered our discounted annual plan?" },
      { role: "caller", text: "No. I want to cancel. How do I cancel?" },
      { role: "agent", text: "I understand. Let me transfer you to our retention team who can assist with cancellations." },
      { role: "caller", text: "Forget it." },
    ],
    intent: "cancel_subscription_flow",
    outcome: "gave_up",
    outcome_confidence: 0.88,
    sentiment_score: 1.8,
    flags: ["polite_churner"],
    ai_analysis: "Caller wanted a direct cancellation path. Agent ran a retention script instead of processing the request. After being redirected to a 'retention team', the caller gave up. The agent scored this as a successful deflection, but the customer left without resolution.",
  },
  {
    external_call_id: "demo_003",
    platform: "vapi",
    duration_seconds: 94,
    transcript: [
      { role: "caller", text: "I need to move my Thursday appointment to next week." },
      { role: "agent", text: "I can see your appointment on Thursday at 2pm. Next week I have openings Tuesday 10am, Wednesday 3pm, or Thursday 11am. Which works best?" },
      { role: "caller", text: "Tuesday 10am." },
      { role: "agent", text: "Done! Rescheduled to Tuesday April 8th at 10am. Confirmation email sent." },
      { role: "caller", text: "Thanks!" },
    ],
    intent: "reschedule_appointment",
    outcome: "resolved",
    outcome_confidence: 0.97,
    sentiment_score: 4.6,
    flags: [],
    ai_analysis: "Caller wanted to reschedule. Agent provided clear options, caller picked one, agent confirmed. Clean resolution with no friction.",
  },
  {
    external_call_id: "demo_004",
    platform: "vapi",
    duration_seconds: 168,
    transcript: [
      { role: "caller", text: "I'm locked out of my account. I keep getting an error when I try to log in." },
      { role: "agent", text: "I can help with account access! Please try resetting your password at example.com/reset." },
      { role: "caller", text: "I already tried that three times. It says my email isn't recognized." },
      { role: "agent", text: "For account recovery when your email isn't recognized, please visit our help center." },
      { role: "caller", text: "Ok thanks I guess." },
    ],
    intent: "account_access_locked",
    outcome: "gave_up",
    outcome_confidence: 0.85,
    sentiment_score: 2.1,
    flags: ["polite_churner"],
    ai_analysis: "Caller was locked out and had already tried password reset. Agent suggested the same failed solution, then redirected to help center. Caller said 'ok thanks' — polite disengagement masking frustration. Agent marked as resolved but issue was unresolved.",
  },
  {
    external_call_id: "demo_005",
    platform: "vapi",
    duration_seconds: 87,
    transcript: [
      { role: "caller", text: "I requested a refund last week. Where is it?" },
      { role: "agent", text: "Refunds typically take 5-10 business days. Your refund of $29 was initiated on March 28th. You should see it by April 8th." },
      { role: "caller", text: "Ok, so a few more days. Got it." },
      { role: "agent", text: "Yes, you'll receive an email when it's processed. Anything else?" },
      { role: "caller", text: "Nope, that's all. Thanks." },
    ],
    intent: "refund_status_inquiry",
    outcome: "resolved",
    outcome_confidence: 0.93,
    sentiment_score: 3.8,
    flags: [],
    ai_analysis: "Caller asked about refund status. Agent gave a specific timeline based on the actual initiation date. Clear, helpful response. Resolved.",
  },
  {
    external_call_id: "demo_006",
    platform: "vapi",
    duration_seconds: 45,
    transcript: [
      { role: "caller", text: "Cancel my subscription immediately." },
      { role: "agent", text: "I'd love to help you explore options that might work better for—" },
      { role: "caller", text: "I don't want options. Get me a human." },
      { role: "agent", text: "Of course, transferring you now." },
    ],
    intent: "cancel_subscription_flow",
    outcome: "escalated",
    outcome_confidence: 0.95,
    sentiment_score: 1.2,
    flags: ["frustration_transfer"],
    ai_analysis: "Caller wanted immediate cancellation. Agent started retention pitch, caller cut it off and demanded a human. The frustration from the AI interaction will carry over to the human agent, likely depressing their CSAT score.",
  },
  {
    external_call_id: "demo_007",
    platform: "vapi",
    duration_seconds: 126,
    transcript: [
      { role: "caller", text: "What is my current balance?" },
      { role: "agent", text: "Your current balance is $142.50. Your next payment of $29 is due on April 14th." },
      { role: "caller", text: "Great, and can you confirm my plan?" },
      { role: "agent", text: "You're on the Pro plan at $29 per month, which includes unlimited calls and priority support." },
      { role: "caller", text: "Perfect, thanks." },
    ],
    intent: "check_balance",
    outcome: "resolved",
    outcome_confidence: 0.96,
    sentiment_score: 4.4,
    flags: [],
    ai_analysis: "Simple informational request. Agent provided accurate balance and plan details. No issues.",
  },
  {
    external_call_id: "demo_008",
    platform: "vapi",
    duration_seconds: 192,
    transcript: [
      { role: "caller", text: "I've called three times about this issue and nothing has been done." },
      { role: "agent", text: "I apologize for the inconvenience. Let me see how I can help today." },
      { role: "caller", text: "My invoice from February is wrong. I've explained this multiple times." },
      { role: "agent", text: "I can help with billing inquiries. Could you describe the issue with your February invoice?" },
      { role: "caller", text: "I already described it THREE TIMES. Just connect me to someone who can fix it." },
      { role: "agent", text: "I understand your frustration. Connecting you to a billing specialist now." },
    ],
    intent: "billing_dispute_with_context",
    outcome: "escalated",
    outcome_confidence: 0.91,
    sentiment_score: 1.1,
    flags: ["repeat_caller", "frustration_transfer"],
    ai_analysis: "Repeat caller — third call about the same billing issue. Agent didn't have access to prior interaction history and asked the caller to re-explain. This amplified frustration. Escalated to human agent who will receive a very angry customer.",
  },
  {
    external_call_id: "demo_009",
    platform: "vapi",
    duration_seconds: 30,
    transcript: [
      { role: "agent", text: "Thank you for calling! How can I help you today?" },
    ],
    intent: "unknown",
    outcome: "abandoned",
    outcome_confidence: 0.80,
    sentiment_score: 3.0,
    flags: [],
    ai_analysis: "Call connected but caller never spoke. Likely a misdial or caller dropped before engaging.",
  },
  {
    external_call_id: "demo_010",
    platform: "vapi",
    duration_seconds: 178,
    transcript: [
      { role: "caller", text: "Hi, I got an email saying my payment failed. But my card is fine." },
      { role: "agent", text: "I can see a failed payment attempt on April 1st. Your card ending in 4242 was declined. Would you like to update your payment method?" },
      { role: "caller", text: "The card works fine everywhere else. Can you just retry it?" },
      { role: "agent", text: "I've submitted a retry. It may take a few minutes to process. You'll receive a confirmation email once the payment goes through." },
      { role: "caller", text: "Alright, thanks." },
    ],
    intent: "payment_failed",
    outcome: "resolved",
    outcome_confidence: 0.88,
    sentiment_score: 3.5,
    flags: [],
    ai_analysis: "Caller reported a false payment failure. Agent identified the specific decline, offered a retry, and set expectations. Reasonable resolution.",
  },
  {
    external_call_id: "demo_011",
    platform: "vapi",
    duration_seconds: 210,
    transcript: [
      { role: "caller", text: "I was charged twice for the same order." },
      { role: "agent", text: "I can help with billing! Your current plan includes..." },
      { role: "caller", text: "This isn't about my plan. I ordered something and got charged twice. Order number 8847." },
      { role: "agent", text: "I see order #8847. It shows one charge of $67. Could you check your bank statement for a pending authorization that may not have fully processed?" },
      { role: "caller", text: "There are definitely two charges of $67. Can you refund one?" },
      { role: "agent", text: "I can see the duplicate. I've initiated a refund of $67 to your card ending in 5521. You should see it within 5-7 business days." },
      { role: "caller", text: "Ok thank you." },
    ],
    intent: "billing_dispute_with_context",
    outcome: "resolved",
    outcome_confidence: 0.90,
    sentiment_score: 3.2,
    flags: [],
    ai_analysis: "Duplicate charge complaint. Agent initially misunderstood as a plan question but recovered after caller provided the order number. Identified the duplicate and initiated refund. Resolved despite the initial mismatch.",
  },
  {
    external_call_id: "demo_012",
    platform: "vapi",
    duration_seconds: 65,
    transcript: [
      { role: "caller", text: "That's fine, I'll figure it out myself." },
      { role: "agent", text: "Is there anything else I can help you with?" },
      { role: "caller", text: "No." },
    ],
    intent: "account_access_locked",
    outcome: "gave_up",
    outcome_confidence: 0.82,
    sentiment_score: 2.0,
    flags: ["polite_churner"],
    ai_analysis: "Transcript begins mid-conversation — likely a continuation where the caller gave up after unhelpful responses. 'I'll figure it out myself' is classic polite disengagement. Agent marked as resolved.",
  },
  {
    external_call_id: "demo_013",
    platform: "vapi",
    duration_seconds: 140,
    transcript: [
      { role: "caller", text: "I want to upgrade to the business plan." },
      { role: "agent", text: "Great choice! The Business plan is $99/month and includes team management, API access, and priority support. Shall I upgrade you now?" },
      { role: "caller", text: "Yes please." },
      { role: "agent", text: "Done! You're now on the Business plan. Your next billing date is April 14th for $99. Welcome to Business!" },
      { role: "caller", text: "Thanks!" },
    ],
    intent: "upgrade_plan",
    outcome: "resolved",
    outcome_confidence: 0.98,
    sentiment_score: 4.8,
    flags: [],
    ai_analysis: "Upgrade request handled perfectly. Agent explained pricing, confirmed intent, processed immediately. High satisfaction.",
  },
  {
    external_call_id: "demo_014",
    platform: "vapi",
    duration_seconds: 185,
    transcript: [
      { role: "caller", text: "My package was supposed to arrive yesterday but tracking says it's still in transit." },
      { role: "agent", text: "I can see your order #9912 shipped on April 1st via standard shipping. The estimated delivery was April 4th. Let me check the tracking status." },
      { role: "caller", text: "Ok." },
      { role: "agent", text: "It shows your package is at the local distribution center. It should be delivered today or tomorrow. Would you like me to send you the tracking link?" },
      { role: "caller", text: "Sure, send it over." },
      { role: "agent", text: "Sent to your email on file. If it hasn't arrived by tomorrow evening, call us back and we'll expedite a replacement." },
      { role: "caller", text: "Sounds good, thanks." },
    ],
    intent: "shipping_status",
    outcome: "resolved",
    outcome_confidence: 0.91,
    sentiment_score: 3.9,
    flags: [],
    ai_analysis: "Shipping inquiry about a delayed package. Agent checked tracking, gave a realistic update, sent the tracking link, and set expectations for next steps. Good resolution.",
  },
  {
    external_call_id: "demo_015",
    platform: "vapi",
    duration_seconds: 98,
    transcript: [
      { role: "caller", text: "I need to reset my password but I'm not getting the reset email." },
      { role: "agent", text: "I've sent a new password reset link to your email. Please check your spam folder as well. The link expires in 30 minutes." },
      { role: "caller", text: "Got it, just came through. Thanks!" },
    ],
    intent: "password_reset",
    outcome: "resolved",
    outcome_confidence: 0.95,
    sentiment_score: 4.2,
    flags: [],
    ai_analysis: "Simple password reset. Agent sent the link proactively, caller confirmed receipt. Clean and fast.",
  },
  {
    external_call_id: "demo_016",
    platform: "vapi",
    duration_seconds: 220,
    transcript: [
      { role: "caller", text: "I want to return this product. It's not what I expected." },
      { role: "agent", text: "I can help with returns. Could you tell me the order number?" },
      { role: "caller", text: "Order 7823." },
      { role: "agent", text: "I see order #7823. This item is within the 30-day return window. I'll email you a prepaid return label. Once we receive the item, your refund will be processed within 3-5 business days." },
      { role: "caller", text: "How long until I get the label?" },
      { role: "agent", text: "It should arrive in your inbox within the next few minutes." },
      { role: "caller", text: "Ok, thanks." },
    ],
    intent: "product_return",
    outcome: "resolved",
    outcome_confidence: 0.93,
    sentiment_score: 3.6,
    flags: [],
    ai_analysis: "Return request processed smoothly. Agent confirmed eligibility, arranged the return label, and set timeline expectations. Resolved.",
  },
  {
    external_call_id: "demo_017",
    platform: "vapi",
    duration_seconds: 73,
    transcript: [
      { role: "caller", text: "I've been on hold for 20 minutes already with your other line. Can someone please just help me cancel?" },
      { role: "agent", text: "I apologize for the wait. I can help with cancellation. Let me pull up your account." },
      { role: "caller", text: "Finally. Just cancel it. Account email is john@test.com." },
      { role: "agent", text: "I've cancelled your subscription effective immediately. You'll receive a confirmation email shortly." },
      { role: "caller", text: "Thank you." },
    ],
    intent: "cancel_subscription_flow",
    outcome: "resolved",
    outcome_confidence: 0.94,
    sentiment_score: 2.8,
    flags: ["repeat_caller"],
    ai_analysis: "Caller was frustrated from a prior hold experience but the voice agent resolved the cancellation quickly and directly. Low sentiment due to prior frustration, but the actual interaction was efficient.",
  },
  {
    external_call_id: "demo_018",
    platform: "vapi",
    duration_seconds: 145,
    transcript: [
      { role: "caller", text: "My refund was supposed to arrive 10 days ago. It's not here." },
      { role: "agent", text: "Refunds typically take 5-10 business days to process. Your refund was initiated on March 22nd." },
      { role: "caller", text: "Right, that's 14 days ago. So where is it?" },
      { role: "agent", text: "I apologize for the delay. Refund processing times can vary by payment provider. If you haven't received it within 15 business days, please contact us again." },
      { role: "caller", text: "So you can't actually do anything?" },
      { role: "agent", text: "I'd recommend checking with your bank as well." },
    ],
    intent: "refund_status_inquiry",
    outcome: "gave_up",
    outcome_confidence: 0.87,
    sentiment_score: 1.6,
    flags: [],
    ai_analysis: "Overdue refund inquiry. Agent couldn't check actual processing status and offered no actionable solution beyond 'wait longer' and 'check with your bank.' Caller left without resolution.",
  },
  {
    external_call_id: "demo_019",
    platform: "vapi",
    duration_seconds: 52,
    transcript: [
      { role: "caller", text: "Hi, just checking if my appointment for Monday is still on." },
      { role: "agent", text: "Yes! Your appointment is confirmed for Monday April 7th at 3pm. Would you like a reminder?" },
      { role: "caller", text: "No I'm good. Thanks!" },
    ],
    intent: "appointment_confirmation",
    outcome: "resolved",
    outcome_confidence: 0.99,
    sentiment_score: 4.7,
    flags: [],
    ai_analysis: "Quick confirmation call. Agent had the info ready, confirmed immediately. Ideal interaction.",
  },
  {
    external_call_id: "demo_020",
    platform: "vapi",
    duration_seconds: 188,
    transcript: [
      { role: "caller", text: "I'm trying to use the API but I keep getting 403 errors." },
      { role: "agent", text: "A 403 error usually means your API key doesn't have the right permissions. Which endpoint are you calling?" },
      { role: "caller", text: "The /v2/calls endpoint." },
      { role: "agent", text: "That endpoint requires the 'calls:read' scope. You can update your API key permissions in the dashboard under Settings → API Keys → Edit Scopes." },
      { role: "caller", text: "Oh, let me check... yeah, I only had 'calls:write'. Adding read now. Thanks!" },
    ],
    intent: "technical_support",
    outcome: "resolved",
    outcome_confidence: 0.95,
    sentiment_score: 4.3,
    flags: [],
    ai_analysis: "Technical API support question. Agent correctly diagnosed the permission issue and provided specific steps. Caller resolved it live on the call.",
  },
];

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = session.orgId;

  // Check if already seeded
  const existing = await sql`SELECT count(*) as c FROM calls WHERE org_id = ${orgId}::uuid`;
  if (parseInt(existing.rows[0].c) > 0) {
    return NextResponse.json({ seeded: false, message: "Already has calls", count: parseInt(existing.rows[0].c) });
  }

  // Insert demo calls with dates spread across the last 2 weeks
  const now = new Date();
  let inserted = 0;

  for (let i = 0; i < DEMO_CALLS.length; i++) {
    const call = DEMO_CALLS[i];
    // Spread calls across last 14 days
    const daysAgo = Math.floor((i / DEMO_CALLS.length) * 14);
    const hoursOffset = Math.floor(Math.random() * 10) + 8; // 8am-6pm
    const startedAt = new Date(now);
    startedAt.setDate(startedAt.getDate() - daysAgo);
    startedAt.setHours(hoursOffset, Math.floor(Math.random() * 60), 0, 0);

    const endedAt = new Date(startedAt.getTime() + call.duration_seconds * 1000);

    await sql`
      INSERT INTO calls (
        org_id, external_call_id, platform, started_at, ended_at, duration_seconds,
        transcript, intent, outcome, outcome_confidence, sentiment_score,
        flags, ai_analysis, analysis_status
      ) VALUES (
        ${orgId}::uuid, ${call.external_call_id}, ${call.platform},
        ${startedAt.toISOString()}, ${endedAt.toISOString()}, ${call.duration_seconds},
        ${JSON.stringify(call.transcript)}, ${call.intent}, ${call.outcome},
        ${call.outcome_confidence}, ${call.sentiment_score},
        ${call.flags as any}, ${call.ai_analysis}, 'done'
      )
    `;
    inserted++;
  }

  return NextResponse.json({ seeded: true, count: inserted });
}
