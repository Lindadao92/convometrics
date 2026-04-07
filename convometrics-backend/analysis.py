import json
import logging
from datetime import datetime

import anthropic
from sqlalchemy.orm import Session

from database import Analysis, Call, User

logger = logging.getLogger("convometrics.analysis")

client = anthropic.Anthropic()

ANALYSIS_PROMPT = """You are an expert voice agent analyst for ConvoMetrics. Analyze this voice agent call transcript and return structured JSON.

<transcript>
{transcript}
</transcript>

Analyze the transcript and return ONLY valid JSON with these fields:

{{
  "intent": "snake_case label for the customer's primary intent (e.g. billing_dispute, cancel_subscription, account_access, refund_inquiry, reschedule_appointment, general_question)",
  "resolved": true/false — did the customer actually get what they needed? Be strict. If they said "ok thanks" but their actual question was never answered, that is NOT resolved.,
  "resolution_type": one of "resolved", "abandoned", "false_positive", "escalated":
    - "resolved": customer's actual need was met
    - "abandoned": customer gave up or hung up without resolution
    - "false_positive": agent marked it as handled but the customer's real question was never addressed (e.g. "ok thanks" after a non-answer)
    - "escalated": customer was transferred to a human agent,
  "failure_pattern": null if resolved, otherwise one of:
    - "polite_churner": customer said something agreeable ("ok thanks", "that's fine") but their issue wasn't resolved
    - "frustration_transfer": customer was frustrated by AI and that frustration will carry to the next human interaction
    - "context_mismatch": agent answered a different question than what was asked
    - "loop_failure": agent repeated the same response or redirected to self-service that already failed
    - null if no clear pattern,
  "failure_reason": null if resolved, otherwise a single sentence explaining why the call failed from the customer's perspective,
  "sentiment": one of "positive", "neutral", "negative", "frustrated" — based on the customer's final state, not their opening tone,
  "turns": number of back-and-forth exchanges (count each user message as one turn)
}}

Be especially watchful for false positives — calls where the agent thinks it resolved the issue but actually didn't. These are the most damaging because they're invisible in standard metrics.

Return ONLY the JSON object, no other text."""


def analyze_call(call_id: str, db: Session) -> None:
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        logger.error(f"Call {call_id} not found")
        return

    # Skip very short transcripts
    if not call.transcript or len(call.transcript.strip()) < 50:
        logger.info(f"Call {call_id}: transcript too short, marking as too_short")
        analysis = Analysis(
            call_id=call.id,
            user_id=call.user_id,
            intent="unknown",
            resolved=False,
            resolution_type="too_short",
            failure_pattern=None,
            failure_reason="Transcript too short to analyze",
            sentiment="neutral",
            turns=0,
            analyzed_at=datetime.utcnow(),
        )
        db.add(analysis)
        db.commit()
        return

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_PROMPT.format(transcript=call.transcript),
                }
            ],
        )

        raw_text = response.content[0].text.strip()
        # Handle potential markdown code fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            raw_text = raw_text.strip()

        result = json.loads(raw_text)

        analysis = Analysis(
            call_id=call.id,
            user_id=call.user_id,
            intent=result.get("intent", "unknown"),
            resolved=result.get("resolved", False),
            resolution_type=result.get("resolution_type", "abandoned"),
            failure_pattern=result.get("failure_pattern"),
            failure_reason=result.get("failure_reason"),
            sentiment=result.get("sentiment", "neutral"),
            turns=result.get("turns", 0),
            analyzed_at=datetime.utcnow(),
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)

        logger.info(
            f"Call {call_id} analyzed: intent={analysis.intent}, "
            f"resolved={analysis.resolved}, type={analysis.resolution_type}"
        )

        # Push to PostHog if configured
        user = db.query(User).filter(User.id == call.user_id).first()
        if user and user.posthog_api_key:
            from integrations import push_to_posthog

            push_to_posthog(analysis, call, user, db)

    except json.JSONDecodeError as e:
        logger.error(f"Call {call_id}: failed to parse Claude response: {e}")
    except anthropic.APIError as e:
        logger.error(f"Call {call_id}: Claude API error: {e}")
    except Exception as e:
        logger.error(f"Call {call_id}: unexpected analysis error: {e}")
