import io
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import redis
from celery import Celery

from utils.s3 import download_file, upload_file
from utils.llm import analyze_conversation, aggregate_dashboard

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MAX_WORKERS = int(os.getenv("ANALYSIS_MAX_WORKERS", "10"))

celery_app = Celery("convometrics", broker=REDIS_URL, backend=REDIS_URL)
_redis = redis.from_url(REDIS_URL)


# ── Helpers ────────────────────────────────────────────────────────

def _set_status(job_id: str, status: str):
    _redis.set(f"job:{job_id}:status", status)


def _set_error(job_id: str, message: str):
    _redis.set(f"job:{job_id}:status", "failed")
    _redis.set(f"job:{job_id}:error", message)


def _parse_csv(raw: bytes) -> pd.DataFrame:
    """Parse CSV with proper handling of multi-line quoted fields."""
    df = pd.read_csv(io.BytesIO(raw), quoting=1, escapechar='\\', on_bad_lines='warn')
    logger.info(
        "Parsed CSV: %d rows, %d unique conversations, columns: %s",
        len(df),
        df['conversation_id'].nunique() if 'conversation_id' in df.columns else 0,
        list(df.columns),
    )
    return df


def _parse_metadata_json(val: str | float) -> dict:
    """Safely parse a metadata JSON string from a CSV cell."""
    if not isinstance(val, str):
        return {}
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return {}


def _group_conversations(df: pd.DataFrame) -> dict[str, dict]:
    """Group messages by conversation_id, extract all metadata columns.

    Returns dict[convo_id] = {
        "messages_text": str,      # formatted [role]: text lines
        "metadata": dict,          # conversation-level metadata
        "csv_columns": list[str],  # which extra columns are available
    }
    """
    df = df.sort_values("timestamp")

    # Identify which extra columns exist
    all_cols = set(df.columns)
    extra_cols = all_cols - {"conversation_id", "timestamp", "role", "text", "message"}
    csv_columns = sorted(extra_cols)

    grouped = {}
    for convo_id, group in df.groupby("conversation_id"):
        lines = []
        # Collect per-message metadata
        sentiments = []
        intents = []
        resolution_statuses = []
        timestamps = []
        user_ids = set()
        session_ids = set()
        channels = set()
        products = set()
        plan_tiers = set()

        for _, row in group.iterrows():
            role = row.get("role", "unknown")
            text = row.get("text", row.get("message", ""))
            lines.append(f"[{role}]: {text}")

            # Collect timestamps
            ts = row.get("timestamp")
            if pd.notna(ts):
                timestamps.append(str(ts))

            # Collect CSV labels if present
            if "sentiment" in all_cols and pd.notna(row.get("sentiment")):
                sentiments.append(str(row["sentiment"]))
            if "intent" in all_cols and pd.notna(row.get("intent")):
                intents.append(str(row["intent"]))
            if "resolution_status" in all_cols and pd.notna(row.get("resolution_status")):
                resolution_statuses.append(str(row["resolution_status"]))
            if "user_id" in all_cols and pd.notna(row.get("user_id")):
                user_ids.add(str(row["user_id"]))
            if "session_id" in all_cols and pd.notna(row.get("session_id")):
                session_ids.add(str(row["session_id"]))

            # Parse metadata JSON column
            if "metadata" in all_cols and pd.notna(row.get("metadata")):
                meta = _parse_metadata_json(row["metadata"])
                if "channel" in meta:
                    channels.add(meta["channel"])
                if "product" in meta:
                    products.add(meta["product"])
                if "plan_tier" in meta:
                    plan_tiers.add(meta["plan_tier"])

        # Determine the most common / last values for conversation-level fields
        metadata: dict = {
            "csv_columns": csv_columns,
        }

        if intents:
            # Use the most common intent label from the CSV
            metadata["csv_intent"] = max(set(intents), key=intents.count)
        if sentiments:
            metadata["sentiments"] = sentiments  # per-message for trajectory
        if resolution_statuses:
            # Use the last resolution status (most final)
            metadata["csv_resolution_status"] = resolution_statuses[-1]
        if timestamps:
            metadata["first_timestamp"] = timestamps[0]
            metadata["last_timestamp"] = timestamps[-1]
        if user_ids:
            metadata["user_id"] = next(iter(user_ids))
        if session_ids:
            metadata["session_id"] = next(iter(session_ids))
        if channels:
            metadata["channel"] = next(iter(channels))
        if products:
            metadata["product"] = next(iter(products))
        if plan_tiers:
            metadata["plan_tier"] = next(iter(plan_tiers))

        grouped[str(convo_id)] = {
            "messages_text": "\n".join(lines),
            "metadata": metadata,
            "csv_columns": csv_columns,
        }
    return grouped


def _analyze_one(convo_id: str, convo_data: dict):
    """Wrapper for thread pool — analyses a single conversation with metadata."""
    return analyze_conversation(convo_id, convo_data["messages_text"], convo_data["metadata"])


# ── Celery task ────────────────────────────────────────────────────

@celery_app.task(name="analyze_csv", bind=True)
def analyze_csv(self, job_id: str):
    """Download CSV from S3, analyse each conversation via LLM, build dashboard."""

    # 1. Update status to processing
    _set_status(job_id, "processing")

    try:
        # 2. Download CSV and parse into DataFrame
        raw = download_file(f"uploads/{job_id}/data.csv")
        df = _parse_csv(raw)

        if df.empty:
            _set_error(job_id, "Uploaded CSV is empty.")
            return

        # 3. Group by conversation_id and sort by timestamp
        conversations = _group_conversations(df)

        if not conversations:
            _set_error(job_id, "No conversations found. Ensure the CSV has a 'conversation_id' column.")
            return

        logger.info(
            "Job %s: %d conversations to analyze, csv_columns: %s",
            job_id,
            len(conversations),
            next(iter(conversations.values()))["csv_columns"] if conversations else [],
        )

        # 4. Analyse each conversation in parallel (up to MAX_WORKERS threads)
        results = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {
                pool.submit(_analyze_one, cid, data): cid
                for cid, data in conversations.items()
            }
            for future in as_completed(futures):
                results.append(future.result())

        # 5. Aggregate into dashboard
        dashboard = aggregate_dashboard(results)
        dashboard_json = dashboard.model_dump()

        # 6. Upload results to S3
        upload_file(
            json.dumps(dashboard_json).encode(),
            f"results/{job_id}/dashboard.json",
        )

        # 7. Mark complete
        _set_status(job_id, "complete")

    except Exception as exc:
        _set_error(job_id, str(exc))
        raise self.retry(exc=exc, max_retries=2, countdown=30)
