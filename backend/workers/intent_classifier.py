"""
Background worker that classifies conversation intent using GPT-4o-mini.

Polls the conversations table for rows where intent IS NULL, sends the
messages to OpenAI for classification, and updates the intent column.

Only processes conversations with 3+ messages (substantive exchanges).

Usage:
    python -m workers.intent_classifier            # run until all rows classified
    python -m workers.intent_classifier --limit 1000  # stop after processing N rows

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

import argparse
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
logger = logging.getLogger("intent_classifier")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

BATCH_SIZE = 10
MIN_MESSAGES = 3          # skip conversations that are too short to analyze
FETCH_MULTIPLIER = 5      # fetch this many extra rows to compensate for filtering
POLL_INTERVAL = 5         # seconds between polls when idle
RATE_LIMIT_BACKOFF = 60   # seconds to wait on OpenAI rate limit
UNCLASSIFIABLE = "__unclassifiable__"  # sentinel written when GPT returns nothing useful

TOPIC_PROMPT = (
    "Read this conversation and answer: What is the user trying to accomplish? "
    "Respond with ONLY a short topic label (2-5 words, lowercase). "
    "Be specific — say 'python web scraping' not 'coding help'. "
    "Say 'resume writing' not 'writing'. "
    "If the conversation is too short or unclear to classify, respond with 'unclear'."
)


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)


def fetch_unclassified(sb, limit: int, skip_ids: set[str]) -> list[dict]:
    """Fetch conversations with 3+ messages where intent is NULL."""
    result = (
        sb.table("conversations")
        .select("id, messages")
        .is_("intent", "null")
        .limit(limit * FETCH_MULTIPLIER)
        .execute()
    )
    qualifying = []
    for row in result.data:
        if row["id"] in skip_ids:
            continue
        msgs = row.get("messages") or []
        if len(msgs) >= MIN_MESSAGES:
            qualifying.append(row)
        if len(qualifying) >= limit:
            break
    return qualifying


def format_messages_for_prompt(messages: list[dict]) -> str:
    """Format conversation messages into a readable string for the LLM."""
    lines = []
    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def classify_intent(client: OpenAI, messages: list[dict]) -> str | None:
    """Send messages to GPT-4o-mini and return a short free-form topic label."""
    conversation_text = format_messages_for_prompt(messages)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"{TOPIC_PROMPT}\n\nConversation:\n{conversation_text}"}],
        temperature=0,
        max_tokens=20,
    )

    raw = response.choices[0].message.content.strip().lower()
    # Treat "unclear" response or empty/overlong responses as unclassifiable
    if not raw or raw == "unclear" or len(raw) > 100:
        return None
    return raw


def process_batch(sb, openai_client: OpenAI, conversations: list[dict], skip_ids: set[str]) -> int:
    """Classify and update a batch of conversations. Returns count of updated rows."""
    updated = 0

    for conv in conversations:
        conv_id = conv["id"]
        messages = conv["messages"]
        skip_ids.add(conv_id)  # always mark as attempted so we don't retry in this run

        try:
            intent = classify_intent(openai_client, messages)
        except RateLimitError:
            logger.warning("OpenAI rate limit hit, backing off %ds", RATE_LIMIT_BACKOFF)
            time.sleep(RATE_LIMIT_BACKOFF)
            try:
                intent = classify_intent(openai_client, messages)
            except Exception:
                logger.error("Retry failed for %s, skipping", conv_id)
                continue
        except Exception:
            logger.exception("Failed to classify %s", conv_id)
            continue

        if intent:
            sb.table("conversations").update({"intent": intent}).eq("id", conv_id).execute()
            updated += 1
            logger.info("Classified %s → %s", conv_id, intent)
        else:
            # Write sentinel so this row is never re-fetched in future runs
            sb.table("conversations").update({"intent": UNCLASSIFIABLE}).eq("id", conv_id).execute()
            logger.warning("Unclear/empty response for %s — marked unclassifiable", conv_id)

    return updated


def run(limit: int | None = None):
    """Main polling loop. Stops after `limit` rows processed if given."""
    sb = get_supabase()
    openai_client = get_openai()

    logger.info(
        "Intent classifier started (batch_size=%d, min_messages=%d, limit=%s)",
        BATCH_SIZE, MIN_MESSAGES, limit if limit is not None else "unlimited",
    )

    total_processed = 0
    skip_ids: set[str] = set()

    while True:
        try:
            remaining = (limit - total_processed) if limit is not None else BATCH_SIZE
            if remaining <= 0:
                logger.info("Reached limit of %d rows — done.", limit)
                break

            batch_size = min(BATCH_SIZE, remaining)
            conversations = fetch_unclassified(sb, batch_size, skip_ids)

            if not conversations:
                if limit is not None:
                    logger.info("No more qualifying conversations — done.")
                    break
                time.sleep(POLL_INTERVAL)
                continue

            logger.info("Processing batch of %d conversations", len(conversations))
            updated = process_batch(sb, openai_client, conversations, skip_ids)
            total_processed += len(conversations)
            logger.info(
                "Classified %d/%d | total processed: %d%s",
                updated, len(conversations), total_processed,
                f"/{limit}" if limit is not None else "",
            )

        except KeyboardInterrupt:
            logger.info("Shutting down (processed %d rows)", total_processed)
            break
        except Exception:
            logger.exception("Error in poll loop, retrying in %ds", POLL_INTERVAL)
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify conversation intents using GPT-4o-mini")
    parser.add_argument("--limit", type=int, default=None, help="Stop after processing this many rows")
    args = parser.parse_args()
    run(limit=args.limit)
