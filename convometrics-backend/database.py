import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./convometrics.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    vapi_api_key = Column(String, nullable=True)
    retell_api_key = Column(String, nullable=True)
    posthog_api_key = Column(String, nullable=True)
    posthog_host = Column(String, default="https://app.posthog.com")
    slack_webhook_url = Column(String, nullable=True)
    webhook_secret = Column(String, nullable=False, unique=True, index=True)

    calls = relationship("Call", back_populates="user")
    analyses = relationship("Analysis", back_populates="user")


class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    platform = Column(String, nullable=False)  # "vapi", "retell", "custom"
    call_id = Column(String, nullable=True)  # ID from the external platform
    transcript = Column(Text, nullable=False)
    duration_seconds = Column(Integer, nullable=True)
    started_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    raw_payload = Column(Text, nullable=True)

    user = relationship("User", back_populates="calls")
    analysis = relationship("Analysis", back_populates="call", uselist=False)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=generate_uuid)
    call_id = Column(String, ForeignKey("calls.id"), nullable=False, unique=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    intent = Column(String, nullable=False)
    resolved = Column(Boolean, nullable=False)
    resolution_type = Column(String, nullable=False)  # resolved, abandoned, false_positive, escalated
    failure_pattern = Column(String, nullable=True)  # polite_churner, frustration_transfer, etc.
    failure_reason = Column(Text, nullable=True)
    sentiment = Column(String, nullable=False)  # positive, neutral, negative, frustrated
    turns = Column(Integer, nullable=False)
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    posthog_sent = Column(Boolean, default=False)

    call = relationship("Call", back_populates="analysis")
    user = relationship("User", back_populates="analyses")


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
