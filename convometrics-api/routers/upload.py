import os
from uuid import uuid4

import redis
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from utils.s3 import upload_fileobj
from workers.analyze import analyze_csv

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"text/csv", "application/vnd.ms-excel"}

_redis_client = None


def _redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    return _redis_client


@router.post("/", status_code=202)
async def upload_file(file: UploadFile = File(...)):
    """Accept a CSV upload, store in S3, and dispatch analysis."""

    # Validate extension
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid content type: {file.content_type}")

    job_id = str(uuid4())
    s3_key = f"uploads/{job_id}/data.csv"

    # Stream upload to S3
    upload_fileobj(file.file, s3_key)

    # Record job status in Redis
    _redis().set(f"job:{job_id}:status", "pending")

    # Dispatch Celery task
    analyze_csv.delay(job_id)

    return JSONResponse(
        status_code=202,
        content={"job_id": job_id, "status": "pending"},
    )
