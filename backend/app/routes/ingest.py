import logging

from fastapi import APIRouter, Depends

from app.db import get_supabase
from app.dependencies import get_customer
from app.models import IngestRequest, IngestResponse

logger = logging.getLogger("convometrics.ingest")

router = APIRouter()


@router.post("/v1/ingest", response_model=IngestResponse)
async def ingest(body: IngestRequest, customer: dict = Depends(get_customer)):
    sb = get_supabase()
    customer_id = customer["id"]

    rows = [
        {
            "customer_id": customer_id,
            "conversation_id": event.conversation_id,
            "user_id": event.user_id,
            "messages": [m.model_dump() for m in event.messages],
            "metadata": event.metadata,
        }
        for event in body.batch
    ]

    if rows:
        sb.table("conversations").insert(rows).execute()

    logger.info("Inserted %d conversations for customer %s", len(rows), customer_id)
    return IngestResponse(inserted=len(rows))
