from fastapi import Depends, Header, HTTPException

from app.db import get_supabase


async def get_customer(authorization: str = Header(...)):
    """Validate Bearer token against the customers table and return the customer row."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    api_key = authorization.removeprefix("Bearer ").strip()
    if not api_key:
        raise HTTPException(status_code=401, detail="Missing API key")

    sb = get_supabase()
    result = sb.table("customers").select("id, name").eq("api_key", api_key).execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return result.data[0]
