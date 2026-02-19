"""
Background worker that clusters failure patterns for struggling intents.

For each intent whose overall completion rate is below 50%, pulls all
failed/abandoned conversations and uses GPT-4o-mini to identify the top 3
common failure patterns. Results are upserted into the failure_patterns table.

Each intent is re-analyzed at most once every RERUN_HOURS hours. The worker
splits conversations into batches of CONV_BATCH_SIZE; if an intent has more
than one batch, a second synthesis call merges the results.

Usage:
    python -m workers.failure_cluster

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from openai import OpenAI, RateLimitError
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("failure_cluster")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

CONV_BATCH_SIZE  = 20   # conversations per LLM analysis call
RERUN_HOURS      = 24   # hours before re-analyzing an intent
POLL_INTERVAL    = 300  # seconds to sleep when nothing needs processing
RATE_LIMIT_BACKOFF = 60 # seconds to wait after a rate-limit error

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

CLUSTER_SYSTEM_PROMPT = """\
You are analyzing failed AI assistant conversations to identify common failure patterns.
All conversations share the same user intent. Your job is to diagnose what went wrong.

Reply with ONLY a JSON array of exactly 3 objects (or fewer if there are not enough
distinct patterns):
[
  {
    "label":   "<short label, 4-6 words>",
    "pct":     <integer 0-100, estimated % of these conversations showing this pattern>,
    "example": "<one short verbatim quote from a user message in these conversations>"
  }
]

Focus on how the AI's responses or the conversation flow broke down — not just the
user's topic. Be specific and actionable.\
"""

SYNTHESIZE_SYSTEM_PROMPT = """\
You are merging failure-pattern analyses extracted from multiple conversation batches.
Deduplicate and combine similar patterns, then return the top 3 overall patterns.

Reply with ONLY a JSON array of exactly 3 objects (or fewer if there are not enough
distinct patterns):
[
  {
    "label":   "<short label, 4-6 words>",
    "pct":     <integer 0-100, estimated % of ALL conversations showing this pattern>,
    "example": "<one short verbatim quote>"
  }
]\
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def chunk(lst: list, size: int) -> list[list]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def format_conversations(conversations: list[dict], intent: str) -> str:
    """Pack a batch of conversations into a compact text block for the LLM."""
    lines = [
        f"Intent: {intent}",
        f"Conversations in this batch: {len(conversations)}",
        "",
    ]
    for i, conv in enumerate(conversations, 1):
        lines.append(f"--- Conversation {i} ---")
        for msg in conv.get("messages", []):
            role    = msg.get("role", "?")
            content = msg.get("content", "")[:150].replace("\n", " ")
            lines.append(f"{role}: {content}")
        lines.append("")
    return "\n".join(lines)


def call_llm(client: OpenAI, system: str, user: str) -> str:
    """Single LLM call with one rate-limit retry. Returns raw content string."""
    kwargs = dict(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        temperature=0,
        max_tokens=600,
    )
    try:
        return client.chat.completions.create(**kwargs).choices[0].message.content.strip()
    except RateLimitError:
        logger.warning("Rate limit hit — backing off %ds", RATE_LIMIT_BACKOFF)
        time.sleep(RATE_LIMIT_BACKOFF)
        return client.chat.completions.create(**kwargs).choices[0].message.content.strip()


def parse_patterns(raw: str) -> list[dict] | None:
    """Parse and validate the LLM's JSON pattern list."""
    text = raw.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    try:
        parsed = json.loads(text)
        if not isinstance(parsed, list):
            return None
        valid = []
        for item in parsed:
            if all(k in item for k in ("label", "pct", "example")):
                valid.append({
                    "label":   str(item["label"])[:80],
                    "pct":     max(0, min(100, int(item["pct"]))),
                    "example": str(item["example"])[:300],
                })
        return valid if valid else None
    except Exception:
        logger.warning("Failed to parse pattern JSON: %.200s", raw)
        return None


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------

def fetch_struggling_intents(sb) -> dict[str, list[dict]]:
    """
    Return intent → [failed/abandoned conversations] for every intent whose
    overall completion rate is below 50%.
    """
    result = (
        sb.table("conversations")
        .select("intent, completion_status, messages")
        .not_.is_("intent", "null")
        .not_.is_("completion_status", "null")
        .execute()
    )

    totals:      dict[str, int]       = {}
    n_completed: dict[str, int]       = {}
    failed_convs: dict[str, list[dict]] = {}

    for row in result.data:
        intent = row.get("intent")
        status = row.get("completion_status")
        if not intent or not status:
            continue
        totals[intent]      = totals.get(intent, 0) + 1
        if status == "completed":
            n_completed[intent] = n_completed.get(intent, 0) + 1
        if status in {"failed", "abandoned"}:
            failed_convs.setdefault(intent, []).append(row)

    struggling: dict[str, list[dict]] = {}
    for intent, total in totals.items():
        rate = n_completed.get(intent, 0) / total
        if rate < 0.5 and intent in failed_convs:
            struggling[intent] = failed_convs[intent]

    return struggling


def fetch_stale_intents(sb, intents: list[str]) -> list[str]:
    """Return the subset of intents whose failure_patterns record is missing or stale."""
    if not intents:
        return []

    result = (
        sb.table("failure_patterns")
        .select("intent, updated_at")
        .in_("intent", intents)
        .execute()
    )

    cutoff = datetime.now(timezone.utc) - timedelta(hours=RERUN_HOURS)
    fresh: set[str] = set()
    for row in result.data:
        try:
            updated = datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
            if updated >= cutoff:
                fresh.add(row["intent"])
        except Exception:
            pass

    return [i for i in intents if i not in fresh]


# ---------------------------------------------------------------------------
# Clustering logic
# ---------------------------------------------------------------------------

def analyze_batch(
    client: OpenAI, intent: str, conversations: list[dict]
) -> list[dict] | None:
    """Send one batch of conversations to the LLM and return parsed patterns."""
    user_text = format_conversations(conversations, intent)
    try:
        raw = call_llm(client, CLUSTER_SYSTEM_PROMPT, user_text)
        return parse_patterns(raw)
    except Exception:
        logger.exception("LLM call failed for intent '%s' batch", intent)
        return None


def synthesize(
    client: OpenAI, intent: str, batch_results: list[list[dict]]
) -> list[dict] | None:
    """Merge patterns from multiple batches into a final top-3."""
    combined  = json.dumps(batch_results, indent=2)
    user_text = f"Intent: {intent}\n\nBatch pattern results:\n{combined}"
    try:
        raw = call_llm(client, SYNTHESIZE_SYSTEM_PROMPT, user_text)
        return parse_patterns(raw)
    except Exception:
        logger.exception("Synthesis call failed for intent '%s'", intent)
        return None


def cluster_intent(
    sb, client: OpenAI, intent: str, conversations: list[dict]
) -> bool:
    """
    Cluster failure patterns for one intent and upsert into failure_patterns.
    Returns True on success.
    """
    logger.info(
        "Clustering intent '%s' with %d failed conversations", intent, len(conversations)
    )
    batches = chunk(conversations, CONV_BATCH_SIZE)
    batch_results: list[list[dict]] = []

    for i, batch in enumerate(batches):
        logger.info("  Batch %d/%d (%d convs)", i + 1, len(batches), len(batch))
        patterns = analyze_batch(client, intent, batch)
        if patterns:
            batch_results.append(patterns)

    if not batch_results:
        logger.warning("No patterns extracted for intent '%s', skipping", intent)
        return False

    if len(batch_results) == 1:
        final_patterns = batch_results[0][:3]
    else:
        logger.info("Synthesizing %d batch results for '%s'", len(batch_results), intent)
        final_patterns = synthesize(client, intent, batch_results)
        if not final_patterns:
            logger.warning("Synthesis failed — falling back to first batch for '%s'", intent)
            final_patterns = batch_results[0][:3]

    sb.table("failure_patterns").upsert({
        "intent":     intent,
        "patterns":   final_patterns,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    logger.info("Saved %d patterns for intent '%s'", len(final_patterns), intent)
    return True


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def run():
    """Main polling loop."""
    sb     = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = OpenAI(api_key=OPENAI_API_KEY)

    logger.info(
        "Failure cluster worker started (conv_batch=%d, rerun=%dh, poll=%ds)",
        CONV_BATCH_SIZE, RERUN_HOURS, POLL_INTERVAL,
    )

    while True:
        try:
            struggling = fetch_struggling_intents(sb)
            if not struggling:
                logger.info("No struggling intents found — sleeping %ds", POLL_INTERVAL)
                time.sleep(POLL_INTERVAL)
                continue

            stale = fetch_stale_intents(sb, list(struggling.keys()))
            if not stale:
                logger.info(
                    "All %d struggling intents have fresh patterns — sleeping %ds",
                    len(struggling), POLL_INTERVAL,
                )
                time.sleep(POLL_INTERVAL)
                continue

            logger.info("%d intent(s) need cluster analysis", len(stale))
            for intent in stale:
                try:
                    cluster_intent(sb, client, intent, struggling[intent])
                except Exception:
                    logger.exception("Failed to cluster intent '%s'", intent)

        except KeyboardInterrupt:
            logger.info("Shutting down")
            break
        except Exception:
            logger.exception("Error in poll loop — retrying in %ds", POLL_INTERVAL)
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
