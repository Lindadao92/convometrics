"""
Background worker that infers task completion status using GPT-4o-mini.

Polls the conversations table for rows where completion_status IS NULL,
sends the messages to OpenAI for analysis, and updates the completion_status column.

Usage:
    python -m workers.task_completion

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
logger = logging.getLogger("task_completion")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

BATCH_SIZE = 10
POLL_INTERVAL = 5  # seconds between polls when idle
RATE_LIMIT_BACKOFF = 60  # seconds to wait on OpenAI rate limit

VALID_STATUSES = {"completed", "partial", "abandoned", "failed"}

SYSTEM_PROMPT = """\
You are a conversation outcome analyst. Given a conversation between a user \
and an assistant, determine whether the user successfully completed their task.

Classify the outcome as exactly one of:

- **completed**: The user's task was resolved. Look for signals like: user said \
"thanks", "that worked", "perfect", confirmed the solution, or expressed satisfaction.

- **partial**: The user made some progress but pivoted. Look for signals like: \
user asked to try a different approach, changed requirements mid-conversation, \
or got a partial answer but needed more help on a different aspect.

- **abandoned**: The user left without resolution. Look for signals like: \
conversation ended abruptly mid-problem, user stopped responding after receiving \
an answer, no confirmation of success, or the conversation is very short with no \
follow-up.

- **failed**: The user's task was not resolved and they were dissatisfied. Look \
for signals like: user expressed frustration ("this doesn't work", "never mind"), \
repeated failed attempts, user explicitly said the answer was wrong, or the \
assistant couldn't help.

Reply with ONLY a JSON object in this exact format:
{"completion_status": "<status>", "reason": "<brief 1-sentence explanation>"}

When uncertain, prefer "abandoned" over "completed" — don't assume success \
without evidence.\
"""


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)


def find_abandon_point(messages: list[dict]) -> int | None:
    """Return the index of the last user message in the conversation."""
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].get("role") == "user":
            return i
    return None


def fetch_unanalyzed(sb, limit: int) -> list[dict]:
    """Fetch conversations where completion_status is NULL."""
    result = (
        sb.table("conversations")
        .select("id, messages")
        .is_("completion_status", "null")
        .limit(limit)
        .execute()
    )
    return result.data


def fetch_missing_abandon_point(sb, limit: int) -> list[dict]:
    """Fetch already-classified abandoned/failed rows that still need abandon_point set."""
    result = (
        sb.table("conversations")
        .select("id, messages, completion_status")
        .in_("completion_status", ["abandoned", "failed"])
        .is_("abandon_point", "null")
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


def analyze_completion(client: OpenAI, messages: list[dict]) -> str | None:
    """Send messages to GPT-4o-mini and extract the completion status."""
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
        status = parsed.get("completion_status")
        if status in VALID_STATUSES:
            return status
        logger.warning("Invalid status returned: %s", status)
        return None
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM response: %s", raw)
        return None


def process_batch(sb, openai_client: OpenAI, conversations: list[dict]) -> int:
    """Analyze and update a batch of conversations. Returns count of updated rows."""
    updated = 0

    for conv in conversations:
        conv_id = conv["id"]
        messages = conv["messages"]

        try:
            status = analyze_completion(openai_client, messages)
        except RateLimitError:
            logger.warning("OpenAI rate limit hit, backing off %ds", RATE_LIMIT_BACKOFF)
            time.sleep(RATE_LIMIT_BACKOFF)
            try:
                status = analyze_completion(openai_client, messages)
            except Exception:
                logger.error("Retry failed for conversation %s, skipping", conv_id)
                continue
        except Exception:
            logger.exception("Failed to analyze conversation %s", conv_id)
            continue

        if status:
            update: dict = {"completion_status": status}
            if status in {"abandoned", "failed"}:
                ap = find_abandon_point(messages)
                if ap is not None:
                    update["abandon_point"] = ap
            sb.table("conversations").update(update).eq("id", conv_id).execute()
            updated += 1
            logger.info("Analyzed %s → %s (abandon_point=%s)", conv_id, status, update.get("abandon_point"))
        else:
            logger.warning("No status returned for conversation %s", conv_id)

    return updated


def backfill_abandon_points(sb, conversations: list[dict]) -> int:
    """Set abandon_point for already-classified conversations that are missing it."""
    updated = 0
    for conv in conversations:
        ap = find_abandon_point(conv["messages"])
        if ap is not None:
            sb.table("conversations").update({"abandon_point": ap}).eq("id", conv["id"]).execute()
            updated += 1
            logger.info("Backfilled abandon_point=%d for %s", ap, conv["id"])
    return updated


def run():
    """Main polling loop."""
    sb = get_supabase()
    openai_client = get_openai()

    logger.info("Task completion worker started (batch_size=%d, poll=%ds)", BATCH_SIZE, POLL_INTERVAL)

    while True:
        try:
            conversations = fetch_unanalyzed(sb, BATCH_SIZE)
            needs_ap = fetch_missing_abandon_point(sb, BATCH_SIZE)

            if not conversations and not needs_ap:
                time.sleep(POLL_INTERVAL)
                continue

            if conversations:
                logger.info("Processing batch of %d conversations", len(conversations))
                updated = process_batch(sb, openai_client, conversations)
                logger.info("Updated %d/%d conversations", updated, len(conversations))

            if needs_ap:
                logger.info("Backfilling abandon_point for %d conversations", len(needs_ap))
                filled = backfill_abandon_points(sb, needs_ap)
                logger.info("Backfilled %d/%d abandon_points", filled, len(needs_ap))

        except KeyboardInterrupt:
            logger.info("Shutting down")
            break
        except Exception:
            logger.exception("Error in poll loop, retrying in %ds", POLL_INTERVAL)
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
