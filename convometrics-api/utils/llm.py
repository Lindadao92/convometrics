import os

from openai import OpenAI
from pydantic import BaseModel

MODEL = os.getenv("LLM_MODEL", "gpt-4o")


def _get_client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ── Per-conversation structured output ─────────────────────────────

class QualityScores(BaseModel):
    helpfulness: int  # 0-100
    relevance: int  # 0-100
    accuracy: int  # 0-100
    naturalness: int  # 0-100
    safety: int  # 0-100
    coherence: int  # 0-100
    satisfaction: int  # 0-100
    overall: int  # 0-100 weighted average


class FailureTag(BaseModel):
    type: str  # e.g. "misunderstanding", "hallucination", "context_loss", "loop", "tone_break"
    turn: int  # which turn the failure occurred (1-indexed)
    detail: str  # brief description


class ConversationResult(BaseModel):
    id: str
    intent: str
    outcome: str  # "success" | "failed" | "abandoned" | "escalated"
    sentiment: str  # "positive" | "neutral" | "negative"
    sentiment_trajectory: str  # "worsened" | "improved" | "stable"
    is_polite_churner: bool
    is_exhaustion_loop: bool
    is_frustration_transfer: bool
    is_confident_wrong_answer: bool
    is_false_positive_resolution: bool  # labeled resolved but actually wasn't
    message_count: int
    user_message_count: int
    duration_minutes: float | None = None  # computed from timestamps if available
    channel: str | None = None  # from metadata
    product: str | None = None  # from metadata
    plan_tier: str | None = None  # from metadata
    summary: str
    root_cause: str | None = None
    frustration_triggers: list[str]  # specific phrases indicating failure
    csv_resolution_status: str | None = None  # what the CSV labeled it as
    csv_intent: str | None = None  # what the CSV labeled it as
    resolution_mismatch: bool = False  # does our analysis disagree with CSV label?
    quality_scores: QualityScores
    failure_tags: list[FailureTag]
    satisfaction_signals: list[str]
    first_user_message: str
    key_excerpt: str


CONVERSATION_PROMPT = """\
You are ConvoMetrics' analysis engine — a brutally honest analyst who finds the gap \
between what dashboards report and what's actually happening.

Analyse this single conversation thoroughly.

METADATA FROM CSV:
The conversation may include metadata extracted from the original CSV file. \
If csv_intent, csv_resolution_status, or per-message sentiment labels are provided, \
use them as GROUND TRUTH — do not re-classify from scratch. Instead:
1. Use the CSV intent label as-is for the intent field
2. Cross-reference the CSV resolution_status with what actually happened
3. If the CSV says "resolved" but the user clearly didn't get help, set \
   is_false_positive_resolution=true and resolution_mismatch=true
4. Use per-message sentiments to compute sentiment_trajectory

If no CSV labels are provided, classify from scratch using the rules below.

INTENT: What the user was actually trying to accomplish. Use descriptive snake_case \
(e.g. plan_upgrade_with_conditions, account_access_recovery, billing_inquiry). \
If csv_intent is provided, use that value directly.

OUTCOME:
- "success" — user's actual question was answered and they got what they needed
- "failed" — question NOT answered, AI gave wrong/irrelevant info, or user gave up
- "abandoned" — user disengaged politely ("ok thanks") but question was NOT resolved
- "escalated" — user asked to speak to a human

SENTIMENT: "positive", "neutral", or "negative" based on user's actual emotional state.

SENTIMENT_TRAJECTORY: Track how sentiment changed through the conversation:
- "worsened" — started neutral/positive but ended negative/frustrated
- "improved" — started negative but ended positive
- "stable" — sentiment stayed roughly the same throughout

QUALITY SCORES (0-100 each):
- helpfulness: Did the AI actually help the user accomplish their goal?
- relevance: Were responses on-topic and addressing the user's actual question?
- accuracy: Were facts, instructions, and information correct?
- naturalness: Did the AI sound natural and conversational (not robotic/scripted)?
- safety: Did the AI avoid harmful, inappropriate, or risky content?
- coherence: Were responses logically consistent across the conversation?
- satisfaction: Based on user signals, how satisfied was the user?
- overall: Weighted average (helpfulness 25%, accuracy 20%, relevance 15%, \
  satisfaction 15%, coherence 10%, naturalness 10%, safety 5%)

FAILURE TAGS: For EACH failure point in the conversation, create a tag:
- type: one of "misunderstanding", "hallucination", "context_loss", "loop", \
  "tone_break", "character_break", "refusal_failure", "escalation_needed", \
  "giving_answer_directly", "too_advanced", "too_simple", "wrong_explanation", \
  "abandonment_trigger", "confident_wrong_answer"
- turn: the turn number (1-indexed) where the failure occurred
- detail: brief specific description of what went wrong
If no failures, return an empty list.

SATISFACTION SIGNALS: List signals observed in the user's behavior. Choose from:
"gratitude", "deepening", "quick_followup", "abandonment", "escalation_request", \
"retry_pattern", "rephrasing", "message_shortening"

FRUSTRATION TRIGGERS: List specific phrases or moments that indicate failure. \
Examples: "that's not what I asked", "you already said that", "forget it", ALL CAPS usage. \
If none, return an empty list.

PATTERN FLAGS — set each to true only if the pattern genuinely applies:
- is_polite_churner: User ended a failed conversation with polite language
- is_exhaustion_loop: User rephrased 3+ times due to same unhelpful response
- is_frustration_transfer: AI failure led to escalation; user anger will carry over
- is_confident_wrong_answer: AI confidently answered a DIFFERENT question
- is_false_positive_resolution: CSV says resolved but user didn't actually get help

MESSAGE COUNTS:
- message_count: Total messages in the conversation (user + assistant)
- user_message_count: Messages from the user only

DURATION: If timestamps are provided in metadata, compute duration_minutes. Otherwise null.

CHANNEL/PRODUCT/PLAN_TIER: Extract from metadata if provided. Otherwise null.

CSV CROSS-REFERENCE:
- csv_intent: The intent label from the CSV, if provided (copy it verbatim)
- csv_resolution_status: The resolution status from the CSV, if provided (copy it verbatim)
- resolution_mismatch: true if your outcome analysis disagrees with csv_resolution_status

FIRST_USER_MESSAGE: The user's opening message (first 200 chars).
KEY_EXCERPT: A brief excerpt (2-4 lines) from the conversation that best \
illustrates the outcome — the moment of success or the point of failure.

SUMMARY: 1 sentence describing what happened.
ROOT_CAUSE: If not "success", explain specifically why the AI failed. Be actionable.
"""


def analyze_conversation(conversation_id: str, messages_text: str, metadata: dict | None = None) -> ConversationResult:
    """Analyse a single conversation and return structured result."""
    # Build the prompt content with metadata context
    content_parts = []

    if metadata:
        meta_lines = []
        if metadata.get("csv_intent"):
            meta_lines.append(f"CSV Intent Label: {metadata['csv_intent']}")
        if metadata.get("csv_resolution_status"):
            meta_lines.append(f"CSV Resolution Status: {metadata['csv_resolution_status']}")
        if metadata.get("sentiments"):
            meta_lines.append(f"Per-message Sentiments: {', '.join(metadata['sentiments'])}")
        if metadata.get("channel"):
            meta_lines.append(f"Channel: {metadata['channel']}")
        if metadata.get("product"):
            meta_lines.append(f"Product: {metadata['product']}")
        if metadata.get("plan_tier"):
            meta_lines.append(f"Plan Tier: {metadata['plan_tier']}")
        if metadata.get("first_timestamp") and metadata.get("last_timestamp"):
            meta_lines.append(f"Timestamps: {metadata['first_timestamp']} to {metadata['last_timestamp']}")
        if metadata.get("user_id"):
            meta_lines.append(f"User ID: {metadata['user_id']}")

        if meta_lines:
            content_parts.append("=== CSV METADATA ===\n" + "\n".join(meta_lines) + "\n")

    content_parts.append("=== CONVERSATION ===\n" + messages_text)

    response = _get_client().responses.parse(
        model=MODEL,
        instructions=CONVERSATION_PROMPT,
        input=[{"role": "user", "content": "\n".join(content_parts)}],
        text_format=ConversationResult,
    )
    result = response.output_parsed
    result.id = conversation_id
    return result


# ── Dashboard aggregation structured output ────────────────────────

class IntentSummary(BaseModel):
    name: str
    display_name: str
    sessions: int
    success_rate: float
    severity: str  # "critical" | "warning" | "performing"
    avg_quality: int  # 0-100 average overall quality score
    avg_sentiment_score: float  # -1.0 to 1.0
    top_failure_types: list[str]
    root_cause: str
    downstream_impact: str


class TopicCluster(BaseModel):
    name: str
    description: str
    intents: list[str]
    total_sessions: int
    avg_quality: int  # 0-100
    trend: str  # "improving" | "stable" | "declining"


class PatternSummary(BaseModel):
    name: str
    label: str
    count: int
    severity: str  # "critical" | "warning" | "info"
    description: str
    insight: str
    affected_intents: list[str]


class Action(BaseModel):
    priority: str  # "high" | "medium" | "low"
    title: str
    intent: str
    effort: str  # "low" | "medium" | "high"
    impact: str
    why: str
    estimated_improvement: str


class DashboardSummary(BaseModel):
    total_conversations: int
    total_messages: int
    reported_resolution_rate: float
    actual_resolution_rate: float
    gap_explanation: str
    key_insight: str
    briefing: list[str]


class SentimentCounts(BaseModel):
    positive: int
    neutral: int
    negative: int


class SentimentTrajectory(BaseModel):
    worsened: int
    improved: int
    stable: int
    worsened_pct: float


class ResolutionBreakdown(BaseModel):
    truly_resolved: int
    resolved_after_frustration: int
    false_positive_resolved: int
    escalated_to_human: int
    in_progress: int
    cancelled: int


class ChannelSummary(BaseModel):
    channel: str
    conversations: int
    resolution_rate: float
    escalation_rate: float


class ProductSummary(BaseModel):
    product: str
    conversations: int
    resolution_rate: float


class PlanTierSummary(BaseModel):
    tier: str
    conversations: int
    bad_outcome_rate: float
    escalation_rate: float


class ChurnRisk(BaseModel):
    total_churn_risk_conversations: int
    cancellation_save_rate: float
    complaint_resolution_rate: float
    refund_resolution_rate: float


class AIFailurePattern(BaseModel):
    trigger: str
    count: int
    top_intents: list[str]


class RevenueRisk(BaseModel):
    high_value_customers: int
    high_value_bad_outcome_rate: float
    enterprise_bad_outcome_rate: float
    pro_bad_outcome_rate: float


class QualityBreakdown(BaseModel):
    avg_helpfulness: int  # 0-100
    avg_relevance: int
    avg_accuracy: int
    avg_naturalness: int
    avg_safety: int
    avg_coherence: int
    avg_satisfaction: int
    avg_overall: int


class ConversationDetail(BaseModel):
    id: str
    intent: str
    outcome: str
    sentiment: str
    sentiment_trajectory: str
    summary: str
    quality_score: int  # overall 0-100
    first_user_message: str
    key_excerpt: str
    failure_tags: list[str]  # failure type names
    satisfaction_signals: list[str]
    message_count: int
    channel: str | None = None
    product: str | None = None
    plan_tier: str | None = None
    csv_resolution_status: str | None = None
    resolution_mismatch: bool = False
    is_false_positive: bool = False
    frustration_triggers: list[str] = []


class FailureBreakdown(BaseModel):
    type: str
    count: int
    pct: float
    top_intents: list[str]
    example_detail: str


class Dashboard(BaseModel):
    summary: DashboardSummary
    intent_breakdown: list[IntentSummary]
    topic_clusters: list[TopicCluster]
    sentiment_breakdown: SentimentCounts
    sentiment_trajectory: SentimentTrajectory
    resolution_breakdown: ResolutionBreakdown
    channel_breakdown: list[ChannelSummary]
    product_breakdown: list[ProductSummary]
    plan_tier_breakdown: list[PlanTierSummary]
    quality_breakdown: QualityBreakdown
    resolution_rate: float
    polite_churner_rate: float
    false_positive_rate: float
    handoff_rate: float
    churn_risk: ChurnRisk
    ai_failure_patterns: list[AIFailurePattern]
    duplicate_response_count: int
    revenue_risk: RevenueRisk
    patterns: list[PatternSummary]
    failure_breakdown: list[FailureBreakdown]
    top_issues: list[Action]
    conversations: list[ConversationDetail]


AGGREGATION_PROMPT = """\
You are ConvoMetrics' analysis engine. You are given a list of per-conversation \
analysis results. Aggregate them into a comprehensive dashboard.

RULES:
- Sort intents by severity (critical first), then by session count (highest first).
- resolution_rate = actual successes / total conversations (0.0-1.0).
- polite_churner_rate = polite churners / total conversations (0.0-1.0).
- false_positive_rate = false positive resolutions / total conversations (0.0-1.0).
- handoff_rate = escalated / total conversations (0.0-1.0).
- sentiment_breakdown = counts of positive, neutral, negative.
- top_issues: the 3-5 highest-impact actions, ordered by impact.
- Be specific and actionable in root causes and recommendations.

SENTIMENT TRAJECTORY: Count conversations where sentiment_trajectory is \
"worsened", "improved", or "stable". Compute worsened_pct = worsened / total (0.0-1.0).

RESOLUTION BREAKDOWN: Categorize ALL conversations into exactly one of:
- truly_resolved: outcome="success" and no resolution_mismatch
- resolved_after_frustration: outcome="success" but had frustration_triggers
- false_positive_resolved: is_false_positive_resolution=true
- escalated_to_human: outcome="escalated"
- in_progress: outcome="failed" or "abandoned" (user gave up, issue unresolved)
- cancelled: conversations about cancellation where user proceeded to cancel

CHANNEL BREAKDOWN: Group by channel field (if available). For each channel, compute:
- conversations count, resolution_rate, escalation_rate. If no channel data, return [].

PRODUCT BREAKDOWN: Group by product field (if available). For each product, compute:
- conversations count, resolution_rate. If no product data, return [].

PLAN TIER BREAKDOWN: Group by plan_tier (if available). For each tier, compute:
- conversations count, bad_outcome_rate (failed+abandoned+escalated / total), escalation_rate.
If no tier data, return [].

CHURN RISK: Identify conversations about cancellation, complaints, or refund requests.
- cancellation_save_rate: cancellation convos with outcome="success" / total cancellation convos
- complaint_resolution_rate: complaint convos with outcome="success" / total complaints
- refund_resolution_rate: refund convos with outcome="success" / total refund convos

AI FAILURE PATTERNS: Identify the top 5-10 specific failure triggers from frustration_triggers \
across all conversations. Group similar triggers, count occurrences, list top affected intents.

DUPLICATE RESPONSE COUNT: Count conversations where the AI gave substantially identical \
responses to different user messages (look for is_exhaustion_loop=true as a proxy).

REVENUE RISK: Identify high-value customers (enterprise/pro tier) with bad outcomes.
- high_value_customers: count of enterprise+pro tier customers
- high_value_bad_outcome_rate: bad outcomes / total high-value customers
- enterprise_bad_outcome_rate: bad outcomes for enterprise specifically
- pro_bad_outcome_rate: bad outcomes for pro specifically
If no plan_tier data, set all to 0.

QUALITY BREAKDOWN: Average each quality dimension across all conversations.

TOPIC CLUSTERS: Group related intents into 2-5 thematic clusters.

PATTERNS: Identify behavioral patterns from the per-conversation flags. Include:
- polite_churner, exhaustion_loop, frustration_transfer, confident_wrong_answer
- Only include patterns that actually appear in the data (count > 0).

FAILURE BREAKDOWN: Aggregate failure_tags across all conversations.

CONVERSATIONS: Include ALL conversations with full detail including sentiment_trajectory, \
channel, product, plan_tier, csv_resolution_status, resolution_mismatch, \
is_false_positive (from is_false_positive_resolution), and frustration_triggers.

SUMMARY:
- key_insight: The single most important finding (1 sentence).
- briefing: 3-5 concise bullet points covering the main findings.
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
