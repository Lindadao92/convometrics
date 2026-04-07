import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from analysis import analyze_call
from database import Analysis, Call, User, create_tables, get_db
from integrations import generate_briefing_text
from scheduler import shutdown_scheduler, start_scheduler

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("convometrics")

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-to-random-string")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Lifespan ---


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    logger.info("Database tables ready")
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="ConvoMetrics API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helpers ---


def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = auth[7:]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def mask_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 4:
        return "****"
    return "****" + key[-4:]


def user_response(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "webhook_url": f"https://api.convometrics.com/webhook/{user.webhook_secret}",
        "vapi_api_key": mask_key(user.vapi_api_key),
        "retell_api_key": mask_key(user.retell_api_key),
        "posthog_api_key": mask_key(user.posthog_api_key),
        "posthog_host": user.posthog_host,
        "slack_webhook_url": mask_key(user.slack_webhook_url),
    }


# --- Request/Response Models ---


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateSettingsRequest(BaseModel):
    vapi_api_key: str | None = None
    retell_api_key: str | None = None
    posthog_api_key: str | None = None
    posthog_host: str | None = None
    slack_webhook_url: str | None = None


class CustomWebhookRequest(BaseModel):
    transcript: str
    call_id: str | None = None
    duration_seconds: int | None = None


# --- Health ---


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


# --- Auth ---


@app.post("/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        password_hash=pwd_context.hash(req.password),
        webhook_secret=str(uuid.uuid4()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"New user signed up: {user.email}")
    return {
        "user_id": user.id,
        "email": user.email,
        "webhook_url": f"https://api.convometrics.com/webhook/{user.webhook_secret}",
    }


@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)
    logger.info(f"User logged in: {user.email}")
    return {"access_token": token}


# --- User Settings ---


@app.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return user_response(user)


@app.patch("/me")
def update_me(
    req: UpdateSettingsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.vapi_api_key is not None:
        user.vapi_api_key = req.vapi_api_key
    if req.retell_api_key is not None:
        user.retell_api_key = req.retell_api_key
    if req.posthog_api_key is not None:
        user.posthog_api_key = req.posthog_api_key
    if req.posthog_host is not None:
        user.posthog_host = req.posthog_host
    if req.slack_webhook_url is not None:
        user.slack_webhook_url = req.slack_webhook_url

    db.commit()
    db.refresh(user)
    logger.info(f"User {user.email} updated settings")
    return user_response(user)


# --- Webhooks ---


def get_user_by_webhook_secret(webhook_secret: str, db: Session) -> User:
    user = db.query(User).filter(User.webhook_secret == webhook_secret).first()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid webhook URL")
    return user


@app.post("/webhook/{webhook_secret}/vapi")
async def webhook_vapi(
    webhook_secret: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = get_user_by_webhook_secret(webhook_secret, db)
    body = await request.json()
    raw = json.dumps(body)

    message = body.get("message", {})
    if message.get("type") != "end-of-call-report":
        return {"received": True, "note": "not an end-of-call-report, skipped"}

    call_data = message.get("call", {})
    transcript = call_data.get("transcript", "")
    call_ext_id = call_data.get("id")
    duration = call_data.get("durationSeconds")
    started_at_str = call_data.get("startedAt")
    started_at = None
    if started_at_str:
        try:
            started_at = datetime.fromisoformat(started_at_str.replace("Z", "+00:00"))
        except ValueError:
            pass

    call = Call(
        user_id=user.id,
        platform="vapi",
        call_id=call_ext_id,
        transcript=transcript,
        duration_seconds=duration,
        started_at=started_at,
        raw_payload=raw,
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    logger.info(f"Vapi webhook received: call_id={call_ext_id}, user={user.email}")

    if transcript:
        background_tasks.add_task(analyze_call_background, call.id)

    return {"received": True}


@app.post("/webhook/{webhook_secret}/retell")
async def webhook_retell(
    webhook_secret: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = get_user_by_webhook_secret(webhook_secret, db)
    body = await request.json()
    raw = json.dumps(body)

    event = body.get("event")
    if event != "call_ended":
        return {"received": True, "note": "not a call_ended event, skipped"}

    call_data = body.get("call", {})
    transcript = call_data.get("transcript", "")
    call_ext_id = call_data.get("call_id")
    duration_ms = call_data.get("duration_ms")
    duration = round(duration_ms / 1000) if duration_ms else None
    start_ts = call_data.get("start_timestamp")
    started_at = datetime.utcfromtimestamp(start_ts) if start_ts else None

    call = Call(
        user_id=user.id,
        platform="retell",
        call_id=call_ext_id,
        transcript=transcript,
        duration_seconds=duration,
        started_at=started_at,
        raw_payload=raw,
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    logger.info(f"Retell webhook received: call_id={call_ext_id}, user={user.email}")

    if transcript:
        background_tasks.add_task(analyze_call_background, call.id)

    return {"received": True}


@app.post("/webhook/{webhook_secret}/custom")
async def webhook_custom(
    webhook_secret: str,
    req: CustomWebhookRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    user = get_user_by_webhook_secret(webhook_secret, db)

    call = Call(
        user_id=user.id,
        platform="custom",
        call_id=req.call_id,
        transcript=req.transcript,
        duration_seconds=req.duration_seconds,
        raw_payload=json.dumps(req.model_dump()),
    )
    db.add(call)
    db.commit()
    db.refresh(call)

    logger.info(f"Custom webhook received: user={user.email}")

    if req.transcript:
        background_tasks.add_task(analyze_call_background, call.id)

    return {"received": True}


def analyze_call_background(call_id: str):
    """Run analysis in a background task with its own DB session."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        analyze_call(call_id, db)
    finally:
        db.close()


# --- Analytics ---


@app.get("/analytics/summary")
def analytics_summary(
    days: int = Query(default=7, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    analyses = (
        db.query(Analysis)
        .filter(Analysis.user_id == user.id, Analysis.analyzed_at >= since)
        .all()
    )

    total = len(analyses)
    if total == 0:
        return {
            "total_calls": 0,
            "resolved": 0,
            "resolution_rate": 0,
            "reported_rate": 0,
            "gap": 0,
            "by_intent": [],
            "failure_patterns": [],
        }

    resolved_count = sum(1 for a in analyses if a.resolved)
    completed_count = sum(1 for a in analyses if a.resolution_type != "abandoned")
    resolution_rate = round(resolved_count / total * 100)
    reported_rate = round(completed_count / total * 100)

    # By intent
    intent_map: dict[str, dict] = {}
    for a in analyses:
        if a.intent not in intent_map:
            intent_map[a.intent] = {"calls": 0, "resolved": 0}
        intent_map[a.intent]["calls"] += 1
        if a.resolved:
            intent_map[a.intent]["resolved"] += 1

    by_intent = sorted(
        [
            {
                "intent": name,
                "calls": d["calls"],
                "resolved": d["resolved"],
                "fcr": round(d["resolved"] / d["calls"] * 100) if d["calls"] else 0,
            }
            for name, d in intent_map.items()
        ],
        key=lambda x: x["fcr"],
    )

    # Patterns
    pattern_map: dict[str, int] = {}
    for a in analyses:
        if a.failure_pattern:
            pattern_map[a.failure_pattern] = pattern_map.get(a.failure_pattern, 0) + 1

    failure_patterns = sorted(
        [{"pattern": p, "count": c} for p, c in pattern_map.items()],
        key=lambda x: -x["count"],
    )

    return {
        "total_calls": total,
        "resolved": resolved_count,
        "resolution_rate": resolution_rate,
        "reported_rate": reported_rate,
        "gap": reported_rate - resolution_rate,
        "by_intent": by_intent,
        "failure_patterns": failure_patterns,
    }


@app.get("/analytics/calls")
def analytics_calls(
    days: int = Query(default=7, ge=1, le=90),
    intent: str | None = Query(default=None),
    resolved: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    query = (
        db.query(Call, Analysis)
        .outerjoin(Analysis, Analysis.call_id == Call.id)
        .filter(Call.user_id == user.id, Call.received_at >= since)
    )

    if intent:
        query = query.filter(Analysis.intent == intent)
    if resolved is not None:
        query = query.filter(Analysis.resolved == resolved)

    total = query.count()
    results = (
        query.order_by(Call.received_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    calls = []
    for call, analysis in results:
        entry = {
            "id": call.id,
            "call_id": call.call_id,
            "platform": call.platform,
            "transcript": call.transcript,
            "duration_seconds": call.duration_seconds,
            "started_at": call.started_at.isoformat() if call.started_at else None,
            "received_at": call.received_at.isoformat() if call.received_at else None,
        }
        if analysis:
            entry["analysis"] = {
                "intent": analysis.intent,
                "resolved": analysis.resolved,
                "resolution_type": analysis.resolution_type,
                "failure_pattern": analysis.failure_pattern,
                "failure_reason": analysis.failure_reason,
                "sentiment": analysis.sentiment,
                "turns": analysis.turns,
            }
        else:
            entry["analysis"] = None
        calls.append(entry)

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "calls": calls,
    }


@app.get("/analytics/briefing")
def analytics_briefing(
    days: int = Query(default=7, ge=1, le=90),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    text = generate_briefing_text(user, db)
    return {"briefing": text}
