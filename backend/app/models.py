from pydantic import BaseModel


class Message(BaseModel):
    role: str
    content: str


class ConversationEvent(BaseModel):
    type: str = "track_conversation"
    event_id: str | None = None
    timestamp: str | None = None
    conversation_id: str
    messages: list[Message]
    user_id: str | None = None
    metadata: dict | None = None


class IngestRequest(BaseModel):
    batch: list[ConversationEvent]


class IngestResponse(BaseModel):
    status: str = "ok"
    inserted: int


class HealthResponse(BaseModel):
    status: str = "ok"
