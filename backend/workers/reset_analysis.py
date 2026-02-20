"""
One-shot script to reset all analysis fields so the pipeline can re-run cleanly.

Clears intent, quality_score, completion_status, cluster_id on all conversations
that have been previously analyzed, and deletes all topic_clusters rows.

Batches updates by intent label (chunks of 200) to avoid Supabase statement timeouts.

Usage:
    python -m workers.reset_analysis

Requires SUPABASE_URL, SUPABASE_KEY in .env.
"""

import logging
import os

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("reset_analysis")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

CHUNK_SIZE = 50


def run():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Fetch all distinct intent labels (including __unclassifiable__)
    logger.info("Fetching all analyzed intent labels...")
    result = (
        sb.table("conversations")
        .select("intent")
        .not_.is_("intent", "null")
        .limit(500000)
        .execute()
    )
    labels = list({row["intent"] for row in result.data if row.get("intent")})
    logger.info("Found %d distinct intent labels across analyzed conversations", len(labels))

    if not labels:
        logger.info("Nothing to reset.")
        return

    # 2. Batch-reset all analysis fields by intent label
    cleared = 0
    for i in range(0, len(labels), CHUNK_SIZE):
        chunk = labels[i:i + CHUNK_SIZE]
        sb.table("conversations").update({
            "intent": None,
            "quality_score": None,
            "completion_status": None,
            "cluster_id": None,
        }).in_("intent", chunk).execute()
        cleared += len(chunk)
        logger.info("Reset %d/%d label batches", cleared, len(labels))

    logger.info("Cleared analysis fields for all conversations with those labels")

    # 3. Delete all topic_clusters rows
    result = sb.table("topic_clusters").select("id").execute()
    cluster_ids = [row["id"] for row in (result.data or [])]
    if cluster_ids:
        sb.table("topic_clusters").delete().in_("id", cluster_ids).execute()
        logger.info("Deleted %d topic cluster rows", len(cluster_ids))
    else:
        logger.info("No topic clusters to delete")

    logger.info("Reset complete — ready for a fresh pipeline run")


if __name__ == "__main__":
    run()
