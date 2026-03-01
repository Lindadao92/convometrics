import json
import os

import redis
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from utils.s3 import download_file

router = APIRouter()

_redis_client = None


def _redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    return _redis_client


@router.get("/{job_id}/status")
async def get_job_status(job_id: str):
    """Return the current status of an analysis job."""
    status = _redis().get(f"job:{job_id}:status")
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {"job_id": job_id, "status": status.decode()}


@router.get("/{job_id}/results")
async def get_job_results(job_id: str):
    """Return results if complete, or an appropriate status code otherwise."""
    status = _redis().get(f"job:{job_id}:status")
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    status = status.decode()

    if status in ("pending", "processing"):
        return JSONResponse(
            status_code=202,
            content={"job_id": job_id, "status": status},
        )

    if status == "failed":
        error = _redis().get(f"job:{job_id}:error")
        message = error.decode() if error else "Unknown error"
        raise HTTPException(status_code=500, detail=message)

    # status == "complete"
    s3_key = f"results/{job_id}/dashboard.json"
    data = download_file(s3_key)
    return json.loads(data)
