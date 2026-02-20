"""
Background worker that infers task completion status using GPT-4o-mini.

Polls the conversations table for rows where completion_status IS NULL,
sends the messages to OpenAI for analysis, and updates the completion_status column.

Only processes conversations with 3+ messages (substantive exchanges).

Usage:
    python -m workers.task_completion
    python -m workers.task_completion --limit 1000

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

import argparse
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
MIN_MESSAGES = 3          # skip conversations that are too short to analyze
FETCH_MULTIPLIER = 5      # fetch extra rows to compensate for filtering
POLL_INTERVAL = 5         # seconds between polls when idle
RATE_LIMIT_BACKOFF = 60   # seconds to wait on OpenAI rate limit

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


def fetch_unanalyzed(sb, limit: int, skip_ids: set[str]) -> list[dict]:
    """Fetch conversations with 3+ messages where completion_status is NULL."""
    result = (
        sb.table("conversations")
        .select("id, messages")
        .is_("completion_status", "null")
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


def process_batch(sb, openai_client: OpenAI, conversations: list[dict], skip_ids: set[str]) -> int:
    """Analyze and update a batch of conversations. Returns count of updated rows."""
    updated = 0

    for conv in conversations:
        conv_id = conv["id"]
        messages = conv["messages"]
        skip_ids.add(conv_id)  # mark as attempted so we don't retry in this run

        try:
            status = analyze_completion(openai_client, messages)
        except RateLimitError:
            logger.warning("OpenAI rate limit hit, backing off %ds", RATE_LIMIT_BACKOFF)
            time.sleep(RATE_LIMIT_BACKOFF)
            try:
                status = analyze_completion(openai_client, messages)
            except Exception:
                logger.error("Retry failed for %s, skipping", conv_id)
                continue
        except Exception:
            logger.exception("Failed to analyze %s", conv_id)
            continue

        if status:
            sb.table("conversations").update({"completion_status": status}).eq("id", conv_id).execute()
            updated += 1
            logger.info("Analyzed %s → %s", conv_id, status)
        else:
            logger.warning("No status returned for %s — skipping", conv_id)

    return updated


def run(limit: int | None = None):
    """Main polling loop. Stops after `limit` rows processed if given."""
    sb = get_supabase()
    openai_client = get_openai()

    logger.info(
        "Task completion started (batch_size=%d, min_messages=%d, limit=%s)",
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
            conversations = fetch_unanalyzed(sb, batch_size, skip_ids)

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
    parser = argparse.ArgumentParser(description="Infer task completion status using GPT-4o-mini")
    parser.add_argument("--limit", type=int, default=None, help="Stop after processing this many rows")
    args = parser.parse_args()
    run(limit=args.limit)
