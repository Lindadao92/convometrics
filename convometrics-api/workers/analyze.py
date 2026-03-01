import io
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import redis
from celery import Celery

from utils.s3 import download_file, upload_file
from utils.llm import analyze_conversation, aggregate_dashboard

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
    return pd.read_csv(io.BytesIO(raw))


def _group_conversations(df: pd.DataFrame) -> dict[str, str]:
    """Group messages by conversation_id, sort by timestamp, return formatted text per convo."""
    df = df.sort_values("timestamp")
    grouped = {}
    for convo_id, group in df.groupby("conversation_id"):
        lines = []
        for _, row in group.iterrows():
            role = row.get("role", "unknown")
            text = row.get("text", row.get("message", ""))
            lines.append(f"[{role}]: {text}")
        grouped[str(convo_id)] = "\n".join(lines)
    return grouped


def _analyze_one(convo_id: str, text: str):
    """Wrapper for thread pool — analyses a single conversation."""
    return analyze_conversation(convo_id, text)


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

        # 4. Analyse each conversation in parallel (up to MAX_WORKERS threads)
        results = []
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {
                pool.submit(_analyze_one, cid, text): cid
                for cid, text in conversations.items()
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
