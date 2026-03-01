"""
End-to-end test for the upload → process → poll → results flow.

Mocks S3 and OpenAI so the test runs locally without external services.
Requires Redis running on localhost:6379.
"""

import io
import json
import time
import threading

import redis
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# ── Mock S3 (in-memory store) ────────────────────────────────────────────────

_s3_store: dict[str, bytes] = {}


def mock_upload_fileobj(fileobj, key: str) -> str:
    _s3_store[key] = fileobj.read()
    return key


def mock_upload_file(data: bytes, key: str) -> str:
    _s3_store[key] = data
    return key


def mock_download_file(key: str) -> bytes:
    if key not in _s3_store:
        raise Exception(f"S3 key not found: {key}")
    return _s3_store[key]


# ── Mock LLM ─────────────────────────────────────────────────────────────────

def mock_analyze_conversation(conversation_id: str, messages_text: str):
    from utils.llm import ConversationResult
    return ConversationResult(
        id=conversation_id,
        intent="billing_inquiry",
        outcome="success",
        sentiment="positive",
        is_polite_churner=False,
        is_exhaustion_loop=False,
        is_frustration_transfer=False,
        is_confident_wrong_answer=False,
        message_count=4,
        summary="User asked about billing and got a clear answer.",
        root_cause=None,
    )


def mock_aggregate_dashboard(conversation_results):
    from utils.llm import Dashboard, DashboardSummary, SentimentCounts, ConversationSummary
    return Dashboard(
        summary=DashboardSummary(
            total_conversations=len(conversation_results),
            total_messages=sum(r.message_count for r in conversation_results),
            reported_resolution_rate=100.0,
            actual_resolution_rate=85.0,
            gap_explanation="Some conversations ended politely but unresolved.",
        ),
        intent_breakdown=[],
        sentiment_breakdown=SentimentCounts(positive=2, neutral=1, negative=0),
        resolution_rate=0.85,
        polite_churner_rate=0.1,
        handoff_rate=0.05,
        top_issues=[],
        conversations=[
            ConversationSummary(id=r.id, intent=r.intent, outcome=r.outcome, summary=r.summary)
            for r in conversation_results
        ],
    )


# ── Test CSV ─────────────────────────────────────────────────────────────────

TEST_CSV = """\
conversation_id,role,message,timestamp
conv_001,user,I have a billing question,2024-01-15T10:00:00
conv_001,assistant,Sure! What would you like to know?,2024-01-15T10:00:05
conv_001,user,Why was I charged twice?,2024-01-15T10:00:30
conv_001,assistant,I can see a duplicate charge. Let me refund that for you.,2024-01-15T10:00:45
conv_002,user,How do I upgrade my plan?,2024-01-15T11:00:00
conv_002,assistant,You can upgrade in Settings > Billing.,2024-01-15T11:00:10
conv_002,user,Thanks!,2024-01-15T11:00:20
conv_003,user,My account is locked,2024-01-15T12:00:00
conv_003,assistant,I can help with that. Can you verify your email?,2024-01-15T12:00:05
conv_003,user,test@example.com,2024-01-15T12:00:15
conv_003,assistant,I've unlocked your account.,2024-01-15T12:00:25
conv_003,user,Great thanks,2024-01-15T12:00:30
"""


# ── Run the worker inline (simulates Celery task) ────────────────────────────

def run_worker_inline(job_id: str):
    """Run the analyze_csv task logic directly in a thread."""
    time.sleep(1)  # simulate processing delay
    with patch("workers.analyze.download_file", side_effect=mock_download_file), \
         patch("workers.analyze.upload_file", side_effect=mock_upload_file), \
         patch("workers.analyze.analyze_conversation", side_effect=mock_analyze_conversation), \
         patch("workers.analyze.aggregate_dashboard", side_effect=mock_aggregate_dashboard):
        from workers.analyze import _set_status, _parse_csv, _group_conversations

        _set_status(job_id, "processing")

        raw = mock_download_file(f"uploads/{job_id}/data.csv")
        df = _parse_csv(raw)
        conversations = _group_conversations(df)

        results = [
            mock_analyze_conversation(cid, text)
            for cid, text in conversations.items()
        ]

        dashboard = mock_aggregate_dashboard(results)

        mock_upload_file(
            json.dumps(dashboard.model_dump()).encode(),
            f"results/{job_id}/dashboard.json",
        )

        _set_status(job_id, "complete")


# ── Tests ────────────────────────────────────────────────────────────────────

def main():
    r = redis.from_url("redis://localhost:6379/0")
    r.ping()
    print("[OK] Redis connection")

    # Patch S3 and Celery task dispatch at the router level
    with patch("routers.upload.upload_fileobj", side_effect=mock_upload_fileobj), \
         patch("routers.upload.analyze_csv") as mock_task, \
         patch("routers.jobs.download_file", side_effect=mock_download_file):

        from main import app
        client = TestClient(app)

        # ── 1. Health check ──────────────────────────────────────────────
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
        print("[OK] GET /health → 200")

        # ── 2. Upload rejects non-CSV ────────────────────────────────────
        resp = client.post(
            "/api/upload/",
            files={"file": ("data.txt", b"not a csv", "text/plain")},
        )
        assert resp.status_code == 400
        print("[OK] POST /upload (bad ext) → 400")

        # ── 3. Upload valid CSV ──────────────────────────────────────────
        # Capture the job_id from the Celery delay call so we can run the worker
        captured_job_id = None

        def capture_delay(job_id):
            nonlocal captured_job_id
            captured_job_id = job_id

        mock_task.delay = capture_delay

        resp = client.post(
            "/api/upload/",
            files={"file": ("conversations.csv", TEST_CSV.encode(), "text/csv")},
        )
        assert resp.status_code == 202
        body = resp.json()
        job_id = body["job_id"]
        assert body["status"] == "pending"
        assert captured_job_id == job_id
        print(f"[OK] POST /upload → 202, job_id={job_id}")

        # ── 4. Check status is pending ───────────────────────────────────
        resp = client.get(f"/api/jobs/{job_id}/status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"
        print("[OK] GET /status → pending")

        # ── 5. Check results while pending → 202 ────────────────────────
        resp = client.get(f"/api/jobs/{job_id}/results")
        assert resp.status_code == 202
        print("[OK] GET /results (pending) → 202")

        # ── 6. Run the worker (simulate Celery processing) ──────────────
        worker = threading.Thread(target=run_worker_inline, args=(job_id,))
        worker.start()
        worker.join(timeout=10)
        print("[OK] Worker completed")

        # ── 7. Check status is complete ──────────────────────────────────
        resp = client.get(f"/api/jobs/{job_id}/status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "complete"
        print("[OK] GET /status → complete")

        # ── 8. Fetch results ─────────────────────────────────────────────
        resp = client.get(f"/api/jobs/{job_id}/results")
        assert resp.status_code == 200
        dashboard = resp.json()

        assert "summary" in dashboard
        assert "conversations" in dashboard
        assert dashboard["summary"]["total_conversations"] == 3
        assert len(dashboard["conversations"]) == 3
        assert dashboard["resolution_rate"] == 0.85
        assert dashboard["sentiment_breakdown"]["positive"] == 2
        print(f"[OK] GET /results → dashboard with {len(dashboard['conversations'])} conversations")

        # ── 9. Unknown job → 404 ─────────────────────────────────────────
        resp = client.get("/api/jobs/nonexistent-id/status")
        assert resp.status_code == 404
        print("[OK] GET /status (unknown) → 404")

        resp = client.get("/api/jobs/nonexistent-id/results")
        assert resp.status_code == 404
        print("[OK] GET /results (unknown) → 404")

        # ── 10. Test failed job status ───────────────────────────────────
        r.set(f"job:fail-test:status", "failed")
        r.set(f"job:fail-test:error", "Something broke")
        resp = client.get("/api/jobs/fail-test/results")
        assert resp.status_code == 500
        assert "Something broke" in resp.json()["detail"]
        print("[OK] GET /results (failed) → 500 with error message")

    # Cleanup test keys
    for key in r.keys("job:*"):
        r.delete(key)

    print("\n=== ALL 10 TESTS PASSED ===")


if __name__ == "__main__":
    main()
