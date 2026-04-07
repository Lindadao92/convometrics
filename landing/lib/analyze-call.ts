import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@vercel/postgres";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYSTEM_PROMPT = `You are a voice agent analytics engine. Analyze this call transcript and return valid JSON only, no markdown fences:
{
  "intent": "snake_case_label for what the caller wanted",
  "outcome": "resolved | gave_up | escalated | abandoned",
  "outcome_confidence": 0.85,
  "sentiment_score": 1.4,
  "flags": ["polite_churner"],
  "analysis": "2-3 sentences: what the caller needed, what the agent did, why it succeeded or failed"
}

Flag rules:
- polite_churner: caller said something like 'ok thanks' or 'that's fine' but clearly did not get what they needed
- frustration_transfer: caller explicitly asked for a human due to agent failure
- repeat_caller: transcript implies this is not their first call about this issue

Return ONLY the JSON object. No explanation, no markdown fences.`;

interface AnalysisResult {
  intent: string;
  outcome: "resolved" | "gave_up" | "escalated" | "abandoned";
  outcome_confidence: number;
  sentiment_score: number;
  flags: string[];
  analysis: string;
}

function formatTranscript(
  transcript: { role: string; text: string }[]
): string {
  return transcript.map((t) => `${t.role}: ${t.text}`).join("\n");
}

export async function analyzeCall(callId: string): Promise<void> {
  const result = await sql`
    SELECT id, transcript FROM calls WHERE id = ${callId}::uuid
  `;
  const call = result.rows[0];
  if (!call) {
    console.error(`[analyze] Call ${callId} not found`);
    return;
  }

  const transcript = call.transcript;
  if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
    await sql`
      UPDATE calls SET analysis_status = 'failed', ai_analysis = 'No transcript'
      WHERE id = ${callId}::uuid
    `;
    return;
  }

  const transcriptText = formatTranscript(transcript);

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcriptText }],
    });

    let raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed: AnalysisResult = JSON.parse(raw);
    const flags = parsed.flags || [];

    await sql`
      UPDATE calls SET
        intent = ${parsed.intent},
        outcome = ${parsed.outcome},
        outcome_confidence = ${parsed.outcome_confidence},
        sentiment_score = ${parsed.sentiment_score},
        flags = ${flags as any},
        ai_analysis = ${parsed.analysis},
        analysis_status = 'done'
      WHERE id = ${callId}::uuid
    `;

    console.log(`[analyze] Call ${callId}: intent=${parsed.intent}, outcome=${parsed.outcome}`);
  } catch (err) {
    console.error(`[analyze] Call ${callId} failed:`, err);
    await sql`
      UPDATE calls SET analysis_status = 'failed', ai_analysis = ${String(err)}
      WHERE id = ${callId}::uuid
    `;
  }
}

export async function analyzePendingCalls(orgId: string): Promise<number> {
  const result = await sql`
    SELECT id FROM calls
    WHERE org_id = ${orgId}::uuid AND analysis_status = 'pending'
    LIMIT 100
  `;

  let done = 0;
  for (const row of result.rows) {
    await analyzeCall(row.id);
    done++;
  }
  return done;
}
