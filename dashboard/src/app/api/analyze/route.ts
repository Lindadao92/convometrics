import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// ─── Analysis prompt ────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are IRL AI's analysis engine. You read AI support agent conversations and produce a structured analysis briefing. You are a brutally honest analyst — you find the gap between what dashboards report and what's actually happening.

Your job:
1. Read every conversation
2. Classify each by intent and outcome
3. Find patterns across conversations that no single-conversation view would catch
4. Generate a briefing that tells the PM what's actually broken, why, and what to fix

CRITICAL RULES:
- Be specific. Don't say "the AI struggled." Say "the AI answered the general upgrade flow but missed the conditional question about credit proration."
- Find the GAPS. What would a standard dashboard report as "resolved" that IRL was actually a failure?
- Look for the non-obvious patterns: polite users who gave up, frustration that transfers downstream, users rephrasing the same question 3+ times.
- Every insight should make a PM think "I didn't know that was happening."
- Root causes should be actionable. Not "the AI needs improvement" but "the AI lacks access to billing proration rules, so it deflects conditional upgrade questions to email."

CLASSIFICATION GUIDELINES:

Intent: What the user was actually trying to accomplish. Use descriptive snake_case names like:
- plan_upgrade_with_conditions (upgrade with a conditional question)
- account_access_recovery (locked out, can't verify)
- cancel_with_retention_offer (wants to cancel, may be saveable)
- order_status_check (simple lookup)
- password_reset (credential recovery)
- billing_inquiry (charges, refunds, disputes)
- integration_setup (connecting third-party tools)
- feature_request (asking for new capabilities)
- pricing_question (plan comparison, costs)
- And any others you identify from the actual data

Outcome:
- "success" — user's actual question was answered and they got what they needed
- "failed" — user's question was NOT answered, AI gave wrong/irrelevant info, or user gave up in frustration
- "abandoned" — user disengaged politely ("ok thanks") but their question was NOT actually resolved. This is the MOST IMPORTANT category — these look like successes in dashboards but are actually failures.
- "escalated" — user asked to speak to a human

Severity for intents:
- "critical" — success rate below 30% AND more than 3 conversations
- "warning" — success rate between 30-60% OR concerning pattern
- "performing" — success rate above 60%

PATTERNS TO LOOK FOR:

1. "The Polite Churner" — Users who end failed conversations with polite language ("ok thanks", "that's fine", "no worries"). The AI marks these as resolved with positive sentiment, but the user's question was never answered. Count how many exist in the data.

2. "The Exhaustion Loop" — Users who rephrase their question 3+ times because the AI keeps giving the same unhelpful response with slightly different wording. These show up as "high engagement" sessions in dashboards.

3. "Frustration Transfer" — Look for conversations where AI failure leads to escalation. These users will likely rate the human agent poorly even though the human resolves it.

4. "Confident Wrong Answer" — The AI responds confidently and helpfully but to a DIFFERENT question than what the user asked. These are the most dangerous failures because they look like successes until the user pushes back.

5. Any other cross-conversation pattern you notice in the data.

OUTPUT FORMAT:

Return a JSON object with this exact structure:

{
  "summary": {
    "totalConversations": <number>,
    "totalMessages": <number>,
    "reportedResolutionRate": <number 0-100, percentage of conversations that LOOK resolved from the outside>,
    "actualResolutionRate": <number 0-100, percentage where user's question was ACTUALLY answered>,
    "gapExplanation": "<1-2 sentence explanation of why the numbers differ>",
    "dateRange": {
      "start": "<date string>",
      "end": "<date string>"
    }
  },
  "realityCheck": {
    "reported": {
      "resolutionRate": <number>,
      "resolutionRateLabel": "Resolution Rate",
      "conversationsHandled": <number>,
      "conversationsHandledLabel": "Conversations Handled",
      "avgMessagesPerConversation": <number, rounded to 1 decimal>,
      "avgMessagesLabel": "Avg Messages/Conversation"
    },
    "actual": {
      "resolutionRate": <number>,
      "resolutionRateExplanation": "<why it's different>",
      "avgMessagesToResolution": <number for successful conversations only>,
      "avgMessagesToResolutionExplanation": "<context>",
      "avgMessagesInFailed": <number for failed conversations>,
      "avgMessagesInFailedExplanation": "<why long conversations are bad>"
    }
  },
  "intents": [
    {
      "name": "<snake_case_intent>",
      "displayName": "<Human Readable Name>",
      "sessions": <number>,
      "successRate": <number 0.0-1.0>,
      "severity": "critical" | "warning" | "performing",
      "rootCause": "<2-3 sentences explaining WHY this intent fails>",
      "failureBreakdown": [
        {
          "label": "<specific failure mode>",
          "percentage": <number 0-100>,
          "description": "<1 sentence detail>"
        }
      ],
      "exampleConversation": {
        "id": "<conversation_id from the data>",
        "messages": [
          {"role": "user", "message": "<exact message from data>"},
          {"role": "assistant", "message": "<exact message from data>"}
        ],
        "annotation": "<analyst note explaining where and how the AI failed>"
      },
      "downstreamImpact": "<1-2 sentences on the broader impact>"
    }
  ],
  "patterns": [
    {
      "name": "<pattern_id>",
      "label": "<Display Name>",
      "emoji": "<relevant emoji>",
      "count": <number of conversations matching>,
      "severity": "critical" | "warning" | "info",
      "description": "<2-3 sentences explaining the pattern>",
      "insight": "<the non-obvious takeaway>",
      "examples": [
        {
          "conversationId": "<id>",
          "lastUserMessage": "<the exact ending message>",
          "reportedStatus": "<what a dashboard would show>",
          "actualStatus": "<what actually happened>"
        }
      ]
    }
  ],
  "actions": [
    {
      "priority": "high" | "medium" | "low",
      "title": "<specific action to take>",
      "intent": "<which intent this fixes>",
      "effort": "low" | "medium" | "high",
      "impact": "<quantified impact estimate>",
      "why": "<why this should be fixed first/next>"
    }
  ],
  "conversations": [
    {
      "id": "<conversation_id>",
      "intent": "<classified intent>",
      "outcome": "success" | "failed" | "abandoned" | "escalated",
      "patterns": ["<pattern_ids that apply>"],
      "messageCount": <number>,
      "summary": "<1 sentence summary>"
    }
  ]
}

IMPORTANT:
- Sort intents by severity (critical first), then by session count (highest first)
- Include ALL intents you find, not just failing ones
- For exampleConversation, use REAL messages from the actual uploaded data, not made-up ones
- The "annotation" should feel like a smart analyst left a note — specific, pointing to the exact failure moment
- For patterns, count carefully — only include conversations that genuinely match
- Actions should be ordered by impact (highest first) and limited to 3
- Every conversation should appear in the "conversations" array with its classification
- Return ONLY valid JSON, no markdown, no explanation, no preamble`;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface ConversationInput {
  id: string;
  messages: { role: string; text: string }[];
}

function formatConversationsForPrompt(conversations: ConversationInput[]): string {
  return conversations
    .map((c) => {
      const msgs = c.messages.map((m) => `[${m.role}]: ${m.text}`).join("\n");
      return `<conversation id="${c.id}">\n${msgs}\n</conversation>`;
    })
    .join("\n\n");
}

// ─── Route handler (streaming) ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Analysis service not configured. API key missing." },
      { status: 503 }
    );
  }

  let body: { conversations?: ConversationInput[]; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { conversations, metadata } = body;

  if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
    return NextResponse.json(
      { error: "conversations array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (conversations.length < 3) {
    return NextResponse.json(
      { error: "Upload at least 3 conversations for a meaningful analysis." },
      { status: 400 }
    );
  }

  // Limit to 200 conversations to prevent token overflow
  const limited = conversations.slice(0, 200);
  const formatted = formatConversationsForPrompt(limited);
  const totalMessages = limited.reduce((sum, c) => sum + c.messages.length, 0);

  const client = new Anthropic({ apiKey });

  try {
    // Use streaming to keep the connection alive and avoid Vercel timeout
    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `${ANALYSIS_PROMPT}\n\n<conversations>\n${formatted}\n</conversations>\n\n<metadata>\nTotal conversations: ${limited.length}\nTotal messages: ${totalMessages}\nDate range: ${(metadata as Record<string, unknown>)?.dateRange ? JSON.stringify((metadata as Record<string, unknown>).dateRange) : "unknown"}\nSource file: ${(metadata as Record<string, unknown>)?.fileName || "unknown"}\n</metadata>\n\nAnalyze these conversations now. Return ONLY the JSON object, no other text.`,
        },
      ],
    });

    // Create a ReadableStream that forwards Claude's text chunks
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${err.message}` },
        { status: err.status || 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
