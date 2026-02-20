"""
One-shot worker that clusters free-form intent labels into 10-20 topic groups.

Reads all distinct intent values from the conversations table, sends them to
GPT-4o-mini for grouping, then upserts clusters into topic_clusters and updates
conversations.cluster_id accordingly.

Usage:
    python -m workers.topic_clusterer

Requires SUPABASE_URL, SUPABASE_KEY, and OPENAI_API_KEY in .env.
Re-runnable: replaces stale clusters and re-assigns all conversations.
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
logger = logging.getLogger("topic_clusterer")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]

MIN_LABEL_COUNT = 2   # minimum conversations to include a label
MAX_RETRIES = 3

CLUSTER_PROMPT = """\
You are a conversation topic analyst. Group these topic labels into 10-20 high-level categories.
Return ONLY JSON: {"categories": {"Category Name": ["label1", "label2"]}}
Requirements:
- Specific names only (e.g. "Software Development", "Creative Writing", "Health & Fitness")
- No vague names: "Other", "Miscellaneous", "General" are forbidden
- Every label in exactly one category
- Merge near-duplicates
- 10-20 categories total
"""


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_openai():
    return OpenAI(api_key=OPENAI_API_KEY)


def fetch_label_counts(sb) -> dict[str, int]:
    """Fetch all non-null intent values paginated (small pages to avoid timeouts)."""
    counts: dict[str, int] = {}
    page_size = 1000
    offset = 0

    while True:
        result = (
            sb.table("conversations")
            .select("intent")
            .not_.is_("intent", "null")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            label = row.get("intent")
            # Filter sentinels in Python to keep the query simple
            if label and label != "__unclassifiable__":
                counts[label] = counts.get(label, 0) + 1
        if len(rows) < page_size:
            break
        offset += page_size
        logger.info("Fetched %d intent rows so far...", offset)

    return {label: count for label, count in counts.items() if count >= MIN_LABEL_COUNT}


def call_llm_with_retry(client: OpenAI, labels: dict[str, int]) -> dict[str, list[str]]:
    """Send labels to GPT-4o-mini and parse cluster JSON. Retries on rate limit."""
    label_list = "\n".join(f"{label} ({count})" for label, count in sorted(labels.items(), key=lambda x: -x[1]))
    prompt = f"{CLUSTER_PROMPT}\n\nTopic labels (label + conversation count):\n{label_list}"

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=4000,
            )
            raw = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            parsed = json.loads(raw)
            if not isinstance(parsed, dict) or "categories" not in parsed:
                raise ValueError(f"Unexpected JSON shape: {list(parsed.keys())}")
            categories = parsed["categories"]
            if not isinstance(categories, dict):
                raise ValueError("categories must be an object")
            return categories

        except RateLimitError:
            wait = 60 * (attempt + 1)
            logger.warning("Rate limit hit, waiting %ds (attempt %d/%d)", wait, attempt + 1, MAX_RETRIES)
            time.sleep(wait)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error("Failed to parse LLM response (attempt %d): %s", attempt + 1, e)
            if attempt == MAX_RETRIES - 1:
                raise

    raise RuntimeError("All LLM retry attempts exhausted")


def clear_cluster_assignments(sb, all_labels: list[str]) -> None:
    """Remove cluster_id from conversations in batches by intent label."""
    chunk_size = 200
    for i in range(0, len(all_labels), chunk_size):
        chunk = all_labels[i:i + chunk_size]
        sb.table("conversations").update({"cluster_id": None}).in_("intent", chunk).execute()
    logger.info("Cleared cluster assignments for %d intent labels", len(all_labels))


def upsert_clusters(sb, categories: dict[str, list[str]]) -> dict[str, str]:
    """Upsert clusters into topic_clusters table. Returns {cluster_name: uuid}."""
    cluster_ids: dict[str, str] = {}
    for cluster_name, topic_labels in categories.items():
        result = (
            sb.table("topic_clusters")
            .upsert(
                {
                    "cluster_name": cluster_name,
                    "topic_labels": topic_labels,
                    "conversation_count": 0,
                    "updated_at": "now()",
                },
                on_conflict="cluster_name",
            )
            .execute()
        )
        if result.data:
            cluster_ids[cluster_name] = result.data[0]["id"]
            logger.info("Upserted cluster: %s (%d labels)", cluster_name, len(topic_labels))
    return cluster_ids


def delete_stale_clusters(sb, current_names: list[str]) -> None:
    """Remove clusters that are no longer in the new grouping."""
    if not current_names:
        return
    sb.table("topic_clusters").delete().not_.in_("cluster_name", current_names).execute()
    logger.info("Deleted stale clusters not in: %s", current_names)


def assign_conversations(sb, categories: dict[str, list[str]], cluster_ids: dict[str, str]) -> None:
    """Update conversations.cluster_id based on their intent label."""
    for cluster_name, topic_labels in categories.items():
        cluster_id = cluster_ids.get(cluster_name)
        if not cluster_id:
            logger.warning("No ID found for cluster %s, skipping assignment", cluster_name)
            continue

        # Update in chunks to avoid query size limits
        chunk_size = 200
        for i in range(0, len(topic_labels), chunk_size):
            chunk = topic_labels[i:i + chunk_size]
            sb.table("conversations").update({"cluster_id": cluster_id}).in_("intent", chunk).execute()

        # Update denormalized count
        count_result = (
            sb.table("conversations")
            .select("id", count="exact", head=True)
            .eq("cluster_id", cluster_id)
            .execute()
        )
        count = count_result.count or 0
        sb.table("topic_clusters").update({"conversation_count": count}).eq("id", cluster_id).execute()
        logger.info("Assigned %d conversations to cluster: %s", count, cluster_name)


def run():
    sb = get_supabase()
    client = get_openai()

    logger.info("Fetching intent label counts...")
    label_counts = fetch_label_counts(sb)

    if not label_counts:
        logger.warning("No intent labels found (minimum %d conversations per label). "
                       "Run intent_classifier first.", MIN_LABEL_COUNT)
        return

    logger.info("Found %d unique labels across qualifying conversations", len(label_counts))

    logger.info("Sending labels to GPT-4o-mini for clustering...")
    categories = call_llm_with_retry(client, label_counts)
    logger.info("Got %d clusters from LLM", len(categories))

    # Log any labels dropped by the LLM
    all_assigned = {label for labels in categories.values() for label in labels}
    dropped = set(label_counts.keys()) - all_assigned
    if dropped:
        logger.warning("%d labels not assigned to any cluster: %s", len(dropped), list(dropped)[:10])

    clear_cluster_assignments(sb, list(label_counts.keys()))
    delete_stale_clusters(sb, list(categories.keys()))

    cluster_ids = upsert_clusters(sb, categories)
    assign_conversations(sb, categories, cluster_ids)

    total_assigned = sum(
        sb.table("conversations").select("id", count="exact", head=True)
        .not_.is_("cluster_id", "null").execute().count or 0
        for _ in [1]
    )
    logger.info("Done. %d conversations now have a cluster assignment.", total_assigned)


if __name__ == "__main__":
    run()
