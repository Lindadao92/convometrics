"""
Background worker that classifies conversation intent using GPT-4o-mini.

Polls the conversations table for rows where intent IS NULL, sends the
messages to OpenAI for classification, and updates the intent column.

Usage:
    python -m workers.intent_classifier

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

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
POLL_INTERVAL = 5  # seconds between polls when idle
RATE_LIMIT_BACKOFF = 60  # seconds to wait on OpenAI rate limit

TOPIC_PROMPT = (
    "Read this conversation and answer: What is the user trying to accomplish? "
    "Respond with ONLY a short topic label (2-5 words, lowercase). "
    "Examples: 'python web scraping', 'college essay writing', 'recipe suggestion', "
    "'relationship advice', 'resume formatting'. "
    "Be specific, not generic — say 'python web scraping' not 'coding help'."
)


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)


def fetch_unclassified(sb, limit: int) -> list[dict]:
    """Fetch conversations where intent is NULL."""
    result = (
        sb.table("conversations")
        .select("id, messages")
        .is_("intent", "null")
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
    if not raw or len(raw) > 100:
        return None
    return raw


def process_batch(sb, openai_client: OpenAI, conversations: list[dict]) -> int:
    """Classify and update a batch of conversations. Returns count of updated rows."""
    updated = 0

    for conv in conversations:
        conv_id = conv["id"]
        messages = conv["messages"]

        try:
            intent = classify_intent(openai_client, messages)
        except RateLimitError:
            logger.warning("OpenAI rate limit hit, backing off %ds", RATE_LIMIT_BACKOFF)
            time.sleep(RATE_LIMIT_BACKOFF)
            try:
                intent = classify_intent(openai_client, messages)
            except Exception:
                logger.error("Retry failed for conversation %s, skipping", conv_id)
                continue
        except Exception:
            logger.exception("Failed to classify conversation %s", conv_id)
            continue

        if intent:
            sb.table("conversations").update({"intent": intent}).eq("id", conv_id).execute()
            updated += 1
            logger.info("Classified %s → %s", conv_id, intent)
        else:
            logger.warning("No intent returned for conversation %s", conv_id)

    return updated


def run():
    """Main polling loop."""
    sb = get_supabase()
    openai_client = get_openai()

    logger.info("Intent classifier worker started (batch_size=%d, poll=%ds)", BATCH_SIZE, POLL_INTERVAL)

    while True:
        try:
            conversations = fetch_unclassified(sb, BATCH_SIZE)

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
