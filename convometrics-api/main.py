import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import upload, jobs

load_dotenv()

app = FastAPI(title="ConvoMetrics API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Support comma-separated origins for multiple Vercel domains
_origins = [u.strip() for u in FRONTEND_URL.split(",") if u.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])


@app.get("/health")
def health():
    return {"status": "ok"}
