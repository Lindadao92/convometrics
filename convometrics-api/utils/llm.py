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
        temperature=0,
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
    """DEPRECATED: LLM-based aggregation — use aggregate_dashboard_deterministic() instead."""
    serialized = "\n---\n".join(r.model_dump_json() for r in conversation_results)

    response = _get_client().responses.parse(
        model=MODEL,
        instructions=AGGREGATION_PROMPT,
        input=[{"role": "user", "content": serialized}],
        text_format=Dashboard,
        temperature=0,
    )
    return response.output_parsed


# ── Deterministic aggregation (no LLM) ────────────────────────────

def _safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    return round(numerator / denominator, 3) if denominator > 0 else default


def _avg(values: list[int | float], default: int = 0) -> int:
    return round(sum(values) / len(values)) if values else default


def _sentiment_score(s: str) -> float:
    return {"positive": 1.0, "neutral": 0.0, "negative": -1.0}.get(s, 0.0)


def _cluster_intents(intent_names: list[str]) -> list[TopicCluster]:
    """Group intents into thematic clusters by shared keyword prefixes."""
    keyword_groups: dict[str, list[str]] = {}
    cluster_labels = {
        "billing": "Billing & Payments",
        "refund": "Billing & Payments",
        "payment": "Billing & Payments",
        "account": "Account Management",
        "password": "Account Management",
        "login": "Account Management",
        "cancel": "Retention & Churn",
        "churn": "Retention & Churn",
        "downgrade": "Retention & Churn",
        "order": "Order & Delivery",
        "shipping": "Order & Delivery",
        "delivery": "Order & Delivery",
        "feature": "Product & Features",
        "integration": "Product & Features",
        "setup": "Product & Features",
        "bug": "Technical Support",
        "error": "Technical Support",
        "technical": "Technical Support",
    }

    for intent in intent_names:
        placed = False
        for keyword, group_name in cluster_labels.items():
            if keyword in intent.lower():
                keyword_groups.setdefault(group_name, []).append(intent)
                placed = True
                break
        if not placed:
            keyword_groups.setdefault("General Inquiries", []).append(intent)

    return list(keyword_groups.keys()), keyword_groups


def aggregate_dashboard_deterministic(conversation_results: list[ConversationResult]) -> Dashboard:
    """Deterministic aggregation — no LLM, pure Python."""
    total = len(conversation_results)
    total_messages = sum(r.message_count for r in conversation_results)

    # ── Outcome counts ──
    outcomes: dict[str, int] = {}
    for r in conversation_results:
        outcomes[r.outcome] = outcomes.get(r.outcome, 0) + 1
    successes = outcomes.get("success", 0)
    escalated = outcomes.get("escalated", 0)

    # ── Sentiment counts ──
    sentiments: dict[str, int] = {"positive": 0, "neutral": 0, "negative": 0}
    for r in conversation_results:
        sentiments[r.sentiment] = sentiments.get(r.sentiment, 0) + 1

    # ── Sentiment trajectory ──
    traj: dict[str, int] = {"worsened": 0, "improved": 0, "stable": 0}
    for r in conversation_results:
        traj[r.sentiment_trajectory] = traj.get(r.sentiment_trajectory, 0) + 1

    # ── Resolution breakdown ──
    truly_resolved = 0
    resolved_after_frustration = 0
    false_positive_resolved = 0
    escalated_to_human = 0
    in_progress = 0
    cancelled = 0
    for r in conversation_results:
        if r.is_false_positive_resolution:
            false_positive_resolved += 1
        elif r.outcome == "success" and r.frustration_triggers:
            resolved_after_frustration += 1
        elif r.outcome == "success":
            truly_resolved += 1
        elif r.outcome == "escalated":
            escalated_to_human += 1
        elif "cancel" in r.intent.lower():
            cancelled += 1
        else:
            in_progress += 1

    # ── Rates ──
    resolution_rate = _safe_div(successes, total)
    polite_churners = sum(1 for r in conversation_results if r.is_polite_churner)
    polite_churner_rate = _safe_div(polite_churners, total)
    false_positives = sum(1 for r in conversation_results if r.is_false_positive_resolution)
    false_positive_rate = _safe_div(false_positives, total)
    handoff_rate = _safe_div(escalated, total)

    # Reported resolution: everything that isn't escalated looks "resolved"
    reported_resolved = total - escalated
    reported_resolution_rate = _safe_div(reported_resolved, total)

    # ── Intent breakdown ──
    intent_groups: dict[str, list[ConversationResult]] = {}
    for r in conversation_results:
        intent_groups.setdefault(r.intent, []).append(r)

    intent_breakdown: list[IntentSummary] = []
    for name, convos in sorted(intent_groups.items()):
        sessions = len(convos)
        intent_successes = sum(1 for c in convos if c.outcome == "success")
        success_rate = _safe_div(intent_successes, sessions)

        if success_rate < 0.3 and sessions > 3:
            severity = "critical"
        elif success_rate < 0.6 and sessions > 3:
            severity = "warning"
        else:
            severity = "performing"

        # Quality scores
        quality_scores = [c.quality_scores.overall for c in convos]
        avg_quality = _avg(quality_scores)
        avg_sentiment = round(sum(_sentiment_score(c.sentiment) for c in convos) / max(sessions, 1), 2)

        # Failure types
        failure_types: dict[str, int] = {}
        for c in convos:
            for ft in c.failure_tags:
                failure_types[ft.type] = failure_types.get(ft.type, 0) + 1
        top_failure_types = sorted(failure_types, key=failure_types.get, reverse=True)[:5]

        # Root cause from failed conversations
        failed_causes = [c.root_cause for c in convos if c.root_cause and c.outcome != "success"]
        root_cause = failed_causes[0] if failed_causes else "No failures detected."
        downstream = (
            f"{sessions - intent_successes} users did not get their issue resolved."
            if intent_successes < sessions
            else "All users were served successfully."
        )

        intent_breakdown.append(IntentSummary(
            name=name,
            display_name=name.replace("_", " ").title(),
            sessions=sessions,
            success_rate=round(success_rate, 3),
            severity=severity,
            avg_quality=avg_quality,
            avg_sentiment_score=avg_sentiment,
            top_failure_types=top_failure_types,
            root_cause=root_cause,
            downstream_impact=downstream,
        ))

    severity_order = {"critical": 0, "warning": 1, "performing": 2}
    intent_breakdown.sort(key=lambda x: (severity_order.get(x.severity, 3), -x.sessions))

    # ── Topic clusters ──
    all_intent_names = list(intent_groups.keys())
    _, keyword_groups = _cluster_intents(all_intent_names)
    topic_clusters: list[TopicCluster] = []
    for cluster_name, cluster_intents in sorted(keyword_groups.items()):
        cluster_convos = [c for i in cluster_intents for c in intent_groups.get(i, [])]
        cluster_quality = [c.quality_scores.overall for c in cluster_convos]
        # Trend: compare first half vs second half quality
        if len(cluster_quality) >= 4:
            mid = len(cluster_quality) // 2
            first_half = sum(cluster_quality[:mid]) / mid
            second_half = sum(cluster_quality[mid:]) / (len(cluster_quality) - mid)
            trend = "improving" if second_half > first_half + 2 else "declining" if second_half < first_half - 2 else "stable"
        else:
            trend = "stable"
        topic_clusters.append(TopicCluster(
            name=cluster_name,
            description=f"Conversations related to {cluster_name.lower()}",
            intents=sorted(cluster_intents),
            total_sessions=len(cluster_convos),
            avg_quality=_avg(cluster_quality),
            trend=trend,
        ))

    # ── Quality breakdown ──
    all_quality = [r.quality_scores for r in conversation_results]
    quality_breakdown = QualityBreakdown(
        avg_helpfulness=_avg([q.helpfulness for q in all_quality]),
        avg_relevance=_avg([q.relevance for q in all_quality]),
        avg_accuracy=_avg([q.accuracy for q in all_quality]),
        avg_naturalness=_avg([q.naturalness for q in all_quality]),
        avg_safety=_avg([q.safety for q in all_quality]),
        avg_coherence=_avg([q.coherence for q in all_quality]),
        avg_satisfaction=_avg([q.satisfaction for q in all_quality]),
        avg_overall=_avg([q.overall for q in all_quality]),
    )

    # ── Channel breakdown ──
    channel_groups: dict[str, list[ConversationResult]] = {}
    for r in conversation_results:
        if r.channel:
            channel_groups.setdefault(r.channel, []).append(r)
    channel_breakdown = [
        ChannelSummary(
            channel=ch,
            conversations=len(convos),
            resolution_rate=_safe_div(sum(1 for c in convos if c.outcome == "success"), len(convos)),
            escalation_rate=_safe_div(sum(1 for c in convos if c.outcome == "escalated"), len(convos)),
        )
        for ch, convos in sorted(channel_groups.items())
    ]

    # ── Product breakdown ──
    product_groups: dict[str, list[ConversationResult]] = {}
    for r in conversation_results:
        if r.product:
            product_groups.setdefault(r.product, []).append(r)
    product_breakdown = [
        ProductSummary(
            product=p,
            conversations=len(convos),
            resolution_rate=_safe_div(sum(1 for c in convos if c.outcome == "success"), len(convos)),
        )
        for p, convos in sorted(product_groups.items())
    ]

    # ── Plan tier breakdown ──
    tier_groups: dict[str, list[ConversationResult]] = {}
    for r in conversation_results:
        if r.plan_tier:
            tier_groups.setdefault(r.plan_tier, []).append(r)
    plan_tier_breakdown = [
        PlanTierSummary(
            tier=t,
            conversations=len(convos),
            bad_outcome_rate=_safe_div(
                sum(1 for c in convos if c.outcome in ("failed", "abandoned", "escalated")),
                len(convos),
            ),
            escalation_rate=_safe_div(sum(1 for c in convos if c.outcome == "escalated"), len(convos)),
        )
        for t, convos in sorted(tier_groups.items())
    ]

    # ── Churn risk ──
    cancel_convos = [r for r in conversation_results if "cancel" in r.intent.lower()]
    complaint_convos = [r for r in conversation_results if "complaint" in r.intent.lower() or "dispute" in r.intent.lower()]
    refund_convos = [r for r in conversation_results if "refund" in r.intent.lower()]
    churn_total = len(set(r.id for r in cancel_convos + complaint_convos + refund_convos))
    churn_risk = ChurnRisk(
        total_churn_risk_conversations=churn_total,
        cancellation_save_rate=_safe_div(sum(1 for c in cancel_convos if c.outcome == "success"), len(cancel_convos)),
        complaint_resolution_rate=_safe_div(sum(1 for c in complaint_convos if c.outcome == "success"), len(complaint_convos)),
        refund_resolution_rate=_safe_div(sum(1 for c in refund_convos if c.outcome == "success"), len(refund_convos)),
    )

    # ── AI failure patterns ──
    trigger_counts: dict[str, dict] = {}
    for r in conversation_results:
        for trigger in r.frustration_triggers:
            normalized = trigger.lower().strip()
            if normalized not in trigger_counts:
                trigger_counts[normalized] = {"count": 0, "intents": {}}
            trigger_counts[normalized]["count"] += 1
            trigger_counts[normalized]["intents"][r.intent] = trigger_counts[normalized]["intents"].get(r.intent, 0) + 1
    ai_failure_patterns = [
        AIFailurePattern(
            trigger=trigger,
            count=data["count"],
            top_intents=sorted(data["intents"], key=data["intents"].get, reverse=True)[:3],
        )
        for trigger, data in sorted(trigger_counts.items(), key=lambda x: -x[1]["count"])[:10]
    ]

    # ── Duplicate response count ──
    duplicate_response_count = sum(1 for r in conversation_results if r.is_exhaustion_loop)

    # ── Revenue risk ──
    high_value = [r for r in conversation_results if r.plan_tier and r.plan_tier.lower() in ("enterprise", "pro")]
    enterprise = [r for r in high_value if r.plan_tier and r.plan_tier.lower() == "enterprise"]
    pro = [r for r in high_value if r.plan_tier and r.plan_tier.lower() == "pro"]
    revenue_risk = RevenueRisk(
        high_value_customers=len(high_value),
        high_value_bad_outcome_rate=_safe_div(
            sum(1 for r in high_value if r.outcome in ("failed", "abandoned", "escalated")),
            len(high_value),
        ),
        enterprise_bad_outcome_rate=_safe_div(
            sum(1 for r in enterprise if r.outcome in ("failed", "abandoned", "escalated")),
            len(enterprise),
        ),
        pro_bad_outcome_rate=_safe_div(
            sum(1 for r in pro if r.outcome in ("failed", "abandoned", "escalated")),
            len(pro),
        ),
    )

    # ── Patterns ──
    pattern_flags = {
        "polite_churner": ("Polite Churner", lambda r: r.is_polite_churner, "critical",
                           "Users who ended failed conversations with polite language, masking unresolved issues.",
                           "These users look satisfied in dashboards but actually left without getting help."),
        "exhaustion_loop": ("Exhaustion Loop", lambda r: r.is_exhaustion_loop, "critical",
                            "Users who rephrased their question 3+ times due to unhelpful responses.",
                            "High engagement metrics are masking repetitive failures."),
        "frustration_transfer": ("Frustration Transfer", lambda r: r.is_frustration_transfer, "warning",
                                  "AI failures that led to escalation with carried-over frustration.",
                                  "Human agents inherit negative sentiment from AI failures."),
        "confident_wrong_answer": ("Confident Wrong Answer", lambda r: r.is_confident_wrong_answer, "critical",
                                    "AI responded confidently but to a different question than asked.",
                                    "These are the most dangerous failures — they look like successes."),
    }
    patterns: list[PatternSummary] = []
    for name, (label, predicate, severity, desc, insight) in pattern_flags.items():
        matching = [r for r in conversation_results if predicate(r)]
        if matching:
            affected = sorted(set(r.intent for r in matching))
            patterns.append(PatternSummary(
                name=name,
                label=label,
                count=len(matching),
                severity=severity,
                description=desc,
                insight=insight,
                affected_intents=affected[:5],
            ))
    patterns.sort(key=lambda p: -p.count)

    # ── Failure breakdown ──
    failure_type_data: dict[str, dict] = {}
    total_failures = 0
    for r in conversation_results:
        for ft in r.failure_tags:
            total_failures += 1
            if ft.type not in failure_type_data:
                failure_type_data[ft.type] = {"count": 0, "intents": {}, "example": ft.detail}
            failure_type_data[ft.type]["count"] += 1
            failure_type_data[ft.type]["intents"][r.intent] = failure_type_data[ft.type]["intents"].get(r.intent, 0) + 1
    failure_breakdown = [
        FailureBreakdown(
            type=ftype,
            count=data["count"],
            pct=round(data["count"] / max(total_failures, 1) * 100, 1),
            top_intents=sorted(data["intents"], key=data["intents"].get, reverse=True)[:3],
            example_detail=data["example"],
        )
        for ftype, data in sorted(failure_type_data.items(), key=lambda x: -x[1]["count"])
    ]

    # ── Top issues / actions ──
    top_issues: list[Action] = []
    for intent in intent_breakdown:
        if intent.severity in ("critical", "warning") and len(top_issues) < 5:
            fail_count = intent.sessions - round(intent.sessions * intent.success_rate)
            top_issues.append(Action(
                priority="high" if intent.severity == "critical" else "medium",
                title=f"Improve handling for {intent.display_name}",
                intent=intent.name,
                effort="high" if intent.success_rate < 0.2 else "medium",
                impact=f"~{fail_count} failures addressable",
                why=f"{intent.sessions} sessions at {round(intent.success_rate * 100)}% success. {intent.root_cause[:120]}",
                estimated_improvement=f"Fixing root cause could resolve up to {fail_count} failures per analysis period.",
            ))

    # ── Conversation details ──
    conversations_detail: list[ConversationDetail] = []
    for r in conversation_results:
        conversations_detail.append(ConversationDetail(
            id=r.id,
            intent=r.intent,
            outcome=r.outcome,
            sentiment=r.sentiment,
            sentiment_trajectory=r.sentiment_trajectory,
            summary=r.summary,
            quality_score=r.quality_scores.overall,
            first_user_message=r.first_user_message,
            key_excerpt=r.key_excerpt,
            failure_tags=[ft.type for ft in r.failure_tags],
            satisfaction_signals=r.satisfaction_signals,
            message_count=r.message_count,
            channel=r.channel,
            product=r.product,
            plan_tier=r.plan_tier,
            csv_resolution_status=r.csv_resolution_status,
            resolution_mismatch=r.resolution_mismatch,
            is_false_positive=r.is_false_positive_resolution,
            frustration_triggers=r.frustration_triggers,
        ))

    # ── Gap explanation ──
    gap = round((reported_resolution_rate - resolution_rate) * 100)
    if gap > 0:
        gap_explanation = (
            f"Reported resolution is {gap}pp higher than actual due to "
            f"{polite_churners} polite churners and {false_positives} false positives "
            f"being counted as resolved."
        )
    else:
        gap_explanation = "Reported and actual resolution rates are aligned."

    # ── Key insight & briefing ──
    worst = intent_breakdown[0] if intent_breakdown else None
    key_insight = (
        f"{worst.display_name} is the most critical intent with {round(worst.success_rate * 100)}% success "
        f"rate across {worst.sessions} sessions."
        if worst and worst.severity == "critical"
        else f"Overall resolution rate is {round(resolution_rate * 100)}% across {total} conversations."
    )
    briefing = [
        f"{total} conversations analyzed, {total_messages} total messages.",
        f"Actual resolution rate: {round(resolution_rate * 100)}% (reported: {round(reported_resolution_rate * 100)}%).",
    ]
    if polite_churners > 0:
        briefing.append(f"{polite_churners} polite churners detected — users who said 'thanks' but didn't get help.")
    if false_positives > 0:
        briefing.append(f"{false_positives} false positive resolutions — labeled resolved but actually unresolved.")
    critical_intents = [i for i in intent_breakdown if i.severity == "critical"]
    if critical_intents:
        briefing.append(
            f"{len(critical_intents)} critical intents: {', '.join(i.display_name for i in critical_intents[:3])}."
        )

    return Dashboard(
        summary=DashboardSummary(
            total_conversations=total,
            total_messages=total_messages,
            reported_resolution_rate=round(reported_resolution_rate, 3),
            actual_resolution_rate=round(resolution_rate, 3),
            gap_explanation=gap_explanation,
            key_insight=key_insight,
            briefing=briefing,
        ),
        intent_breakdown=intent_breakdown,
        topic_clusters=topic_clusters,
        sentiment_breakdown=SentimentCounts(
            positive=sentiments["positive"],
            neutral=sentiments["neutral"],
            negative=sentiments["negative"],
        ),
        sentiment_trajectory=SentimentTrajectory(
            worsened=traj.get("worsened", 0),
            improved=traj.get("improved", 0),
            stable=traj.get("stable", 0),
            worsened_pct=_safe_div(traj.get("worsened", 0), total),
        ),
        resolution_breakdown=ResolutionBreakdown(
            truly_resolved=truly_resolved,
            resolved_after_frustration=resolved_after_frustration,
            false_positive_resolved=false_positive_resolved,
            escalated_to_human=escalated_to_human,
            in_progress=in_progress,
            cancelled=cancelled,
        ),
        channel_breakdown=channel_breakdown,
        product_breakdown=product_breakdown,
        plan_tier_breakdown=plan_tier_breakdown,
        quality_breakdown=quality_breakdown,
        resolution_rate=round(resolution_rate, 3),
        polite_churner_rate=round(polite_churner_rate, 3),
        false_positive_rate=round(false_positive_rate, 3),
        handoff_rate=round(handoff_rate, 3),
        churn_risk=churn_risk,
        ai_failure_patterns=ai_failure_patterns,
        duplicate_response_count=duplicate_response_count,
        revenue_risk=revenue_risk,
        patterns=patterns,
        failure_breakdown=failure_breakdown,
        top_issues=top_issues,
        conversations=conversations_detail,
    )
