"""
Background worker that scores AI response quality using GPT-4o-mini.

Polls the conversations table for rows where quality_score IS NULL, sends
the messages to OpenAI for scoring (0-100), and updates the quality_score column.

Usage:
    python -m workers.quality_scorer

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

import json
import logging
import os
import time

from dotenv import load_dotenv
from openai import OpenAI, RateLimitError
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("quality_scorer")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

BATCH_SIZE = 10
POLL_INTERVAL = 5  # seconds between polls when idle
RATE_LIMIT_BACKOFF = 60  # seconds to wait on OpenAI rate limit

SYSTEM_PROMPT = """\
You are an AI response quality evaluator. Given a conversation between a user \
and an assistant, score the quality of the assistant's responses on a scale \
from 0 to 100.

Evaluate based on these criteria (each worth up to 25 points):

1. **Relevance** (0-25): Does the response directly address the user's question \
or request? Does it stay on topic?

2. **Accuracy** (0-25): Is the information provided correct? Are code examples \
syntactically and logically valid?

3. **Completeness** (0-25): Does the response fully answer the question? Are \
edge cases or important details covered?

4. **Helpfulness** (0-25): Is the response clear and well-structured? Would it \
actually help the user accomplish their goal?

Reply with ONLY a JSON object in this exact format:
{"quality_score": <integer 0-100>, "breakdown": {"relevance": <0-25>, "accuracy": <0-25>, "completeness": <0-25>, "helpfulness": <0-25>}}

Be fair but critical. A perfect score should be rare.\
"""


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)


def fetch_unscored(sb, limit: int) -> list[dict]:
    """Fetch conversations where quality_score is NULL."""
    result = (
        sb.table("conversations")
        .select("id, messages")
        .is_("quality_score", "null")
        .limit(limit)
        .execute()
    )
    return result.data


def format_messages_for_prompt(messages: list[dict]) -> str:
    """Format conversation messages into a readable string for the LLM."""
    lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def score_quality(client: OpenAI, messages: list[dict]) -> int | None:
    """Send messages to GPT-4o-mini and extract the quality score."""
    conversation_text = format_messages_for_prompt(messages)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": conversation_text},
        ],
        temperature=0,
        max_tokens=150,
    )

    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
        score = parsed.get("quality_score")
        if isinstance(score, (int, float)) and 0 <= score <= 100:
            return int(score)
        logger.warning("Score out of range: %s", score)
        return None
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM response: %s", raw)
        return None


def process_batch(sb, openai_client: OpenAI, conversations: list[dict]) -> int:
    """Score and update a batch of conversations. Returns count of updated rows."""
    updated = 0

    for conv in conversations:
        conv_id = conv["id"]
        messages = conv["messages"]

        try:
            score = score_quality(openai_client, messages)
        except RateLimitError:
            logger.warning("OpenAI rate limit hit, backing off %ds", RATE_LIMIT_BACKOFF)
            time.sleep(RATE_LIMIT_BACKOFF)
            try:
                score = score_quality(openai_client, messages)
            except Exception:
                logger.error("Retry failed for conversation %s, skipping", conv_id)
                continue
        except Exception:
            logger.exception("Failed to score conversation %s", conv_id)
            continue

        if score is not None:
            sb.table("conversations").update({"quality_score": score}).eq("id", conv_id).execute()
            updated += 1
            logger.info("Scored %s → %d/100", conv_id, score)
        else:
            logger.warning("No score returned for conversation %s", conv_id)

    return updated


def run():
    """Main polling loop."""
    sb = get_supabase()
    openai_client = get_openai()

    logger.info("Quality scorer worker started (batch_size=%d, poll=%ds)", BATCH_SIZE, POLL_INTERVAL)

    while True:
        try:
            conversations = fetch_unscored(sb, BATCH_SIZE)

            if not conversations:
                time.sleep(POLL_INTERVAL)
                continue

            logger.info("Processing batch of %d conversations", len(conversations))
            updated = process_batch(sb, openai_client, conversations)
            logger.info("Updated %d/%d conversations", updated, len(conversations))

        except KeyboardInterrupt:
            logger.info("Shutting down")
            break
        except Exception:
            logger.exception("Error in poll loop, retrying in %ds", POLL_INTERVAL)
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
