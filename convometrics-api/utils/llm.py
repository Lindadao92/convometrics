import os

from openai import OpenAI
from pydantic import BaseModel

MODEL = os.getenv("LLM_MODEL", "gpt-4o")


def _get_client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ── Per-conversation structured output ─────────────────────────────

class ConversationResult(BaseModel):
    id: str
    intent: str
    outcome: str  # "success" | "failed" | "abandoned" | "escalated"
    sentiment: str  # "positive" | "neutral" | "negative"
    is_polite_churner: bool
    is_exhaustion_loop: bool
    is_frustration_transfer: bool
    is_confident_wrong_answer: bool
    message_count: int
    summary: str
    root_cause: str | None = None


CONVERSATION_PROMPT = """\
You are ConvoMetrics' analysis engine — a brutally honest analyst who finds the gap \
between what dashboards report and what's actually happening.

Analyse this single conversation. Classify it accurately:

INTENT: What the user was actually trying to accomplish. Use descriptive snake_case \
(e.g. plan_upgrade_with_conditions, account_access_recovery, billing_inquiry).

OUTCOME:
- "success" — user's actual question was answered and they got what they needed
- "failed" — question NOT answered, AI gave wrong/irrelevant info, or user gave up
- "abandoned" — user disengaged politely ("ok thanks") but question was NOT resolved. \
  These LOOK like successes but are failures.
- "escalated" — user asked to speak to a human

SENTIMENT: "positive", "neutral", or "negative" based on user's actual emotional state.

PATTERN FLAGS — set each to true only if the pattern genuinely applies:
- is_polite_churner: User ended a failed conversation with polite language ("ok thanks") \
  but their question was never answered.
- is_exhaustion_loop: User rephrased their question 3+ times because the AI kept giving \
  the same unhelpful response.
- is_frustration_transfer: AI failure led to escalation; user will likely rate the human \
  agent poorly even though the human resolves it.
- is_confident_wrong_answer: AI responded confidently to a DIFFERENT question than what \
  the user asked.

SUMMARY: 1 sentence describing what happened.
ROOT_CAUSE: If the outcome is not "success", explain specifically why the AI failed. \
Be actionable — not "the AI needs improvement" but "the AI lacks access to billing \
proration rules, so it deflects conditional upgrade questions to email."
"""


def analyze_conversation(conversation_id: str, messages_text: str) -> ConversationResult:
    """Analyse a single conversation and return structured result."""
    response = _get_client().responses.parse(
        model=MODEL,
        instructions=CONVERSATION_PROMPT,
        input=[{"role": "user", "content": messages_text}],
        text_format=ConversationResult,
    )
    result = response.output_parsed
    # Ensure the id matches the input conversation
    result.id = conversation_id
    return result


# ── Dashboard aggregation structured output ────────────────────────

class IntentSummary(BaseModel):
    name: str
    display_name: str
    sessions: int
    success_rate: float
    severity: str  # "critical" | "warning" | "performing"
    root_cause: str
    downstream_impact: str


class PatternSummary(BaseModel):
    name: str
    label: str
    count: int
    severity: str  # "critical" | "warning" | "info"
    description: str
    insight: str


class Action(BaseModel):
    priority: str  # "high" | "medium" | "low"
    title: str
    intent: str
    effort: str  # "low" | "medium" | "high"
    impact: str
    why: str


class DashboardSummary(BaseModel):
    total_conversations: int
    total_messages: int
    reported_resolution_rate: float
    actual_resolution_rate: float
    gap_explanation: str


class Dashboard(BaseModel):
    summary: DashboardSummary
    intent_breakdown: list[IntentSummary]
    sentiment_breakdown: dict[str, int]
    resolution_rate: float
    polite_churner_rate: float
    handoff_rate: float
    top_issues: list[Action]
    conversations: list[dict]


AGGREGATION_PROMPT = """\
You are ConvoMetrics' analysis engine. You are given a list of per-conversation \
analysis results. Aggregate them into a single dashboard.

RULES:
- Sort intents by severity (critical first), then by session count (highest first).
- resolution_rate = actual successes / total conversations (0.0-1.0).
- polite_churner_rate = polite churners / total conversations (0.0-1.0).
- handoff_rate = escalated / total conversations (0.0-1.0).
- sentiment_breakdown = counts of positive, neutral, negative.
- top_issues: the 3 highest-impact actions, ordered by impact.
- Be specific and actionable in root causes and recommendations.
"""


def aggregate_dashboard(conversation_results: list[ConversationResult]) -> Dashboard:
    """Merge per-conversation results into a final dashboard."""
    serialized = "\n---\n".join(r.model_dump_json() for r in conversation_results)

    response = _get_client().responses.parse(
        model=MODEL,
        instructions=AGGREGATION_PROMPT,
        input=[{"role": "user", "content": serialized}],
        text_format=Dashboard,
    )
    return response.output_parsed
