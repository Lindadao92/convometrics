"""
Test that deterministic aggregation produces identical results on the same data.

Run with: python -m pytest test_determinism.py -v

Note: The LLM-based per-conversation analysis (analyze_conversation) may still
have minor non-determinism even with temperature=0. The caching layer in
workers/analyze.py is the ultimate safety net for that. This test validates
that the aggregation layer is fully deterministic.
"""
import json

from utils.llm import (
    ConversationResult,
    QualityScores,
    FailureTag,
    aggregate_dashboard_deterministic,
)


def _make_conversation(
    id: str,
    intent: str,
    outcome: str,
    sentiment: str = "neutral",
    sentiment_trajectory: str = "stable",
    is_polite_churner: bool = False,
    is_exhaustion_loop: bool = False,
    is_frustration_transfer: bool = False,
    is_confident_wrong_answer: bool = False,
    is_false_positive_resolution: bool = False,
    message_count: int = 6,
    user_message_count: int = 3,
    channel: str | None = None,
    product: str | None = None,
    plan_tier: str | None = None,
    frustration_triggers: list[str] | None = None,
    failure_tags: list[FailureTag] | None = None,
    quality_overall: int = 60,
) -> ConversationResult:
    """Helper to create a ConversationResult for testing."""
    return ConversationResult(
        id=id,
        intent=intent,
        outcome=outcome,
        sentiment=sentiment,
        sentiment_trajectory=sentiment_trajectory,
        is_polite_churner=is_polite_churner,
        is_exhaustion_loop=is_exhaustion_loop,
        is_frustration_transfer=is_frustration_transfer,
        is_confident_wrong_answer=is_confident_wrong_answer,
        is_false_positive_resolution=is_false_positive_resolution,
        message_count=message_count,
        user_message_count=user_message_count,
        channel=channel,
        product=product,
        plan_tier=plan_tier,
        summary=f"Test conversation {id}",
        root_cause=None if outcome == "success" else "Test failure cause",
        frustration_triggers=frustration_triggers or [],
        csv_resolution_status=None,
        csv_intent=None,
        resolution_mismatch=False,
        quality_scores=QualityScores(
            helpfulness=quality_overall,
            relevance=quality_overall,
            accuracy=quality_overall,
            naturalness=quality_overall,
            safety=quality_overall + 10,
            coherence=quality_overall,
            satisfaction=quality_overall - 5,
            overall=quality_overall,
        ),
        failure_tags=failure_tags or [],
        satisfaction_signals=["gratitude"] if outcome == "success" else ["abandonment"],
        first_user_message="Test user message",
        key_excerpt="User: test\nAI: test response",
    )


def _build_test_data() -> list[ConversationResult]:
    """Build a representative set of test conversations."""
    return [
        _make_conversation("c001", "billing_inquiry", "success", "positive", "improved", quality_overall=80, channel="chat", plan_tier="pro"),
        _make_conversation("c002", "billing_inquiry", "failed", "negative", "worsened", quality_overall=30, channel="chat", plan_tier="enterprise",
                           frustration_triggers=["that's not what I asked"], failure_tags=[FailureTag(type="misunderstanding", turn=2, detail="Misunderstood billing question")]),
        _make_conversation("c003", "billing_inquiry", "abandoned", "neutral", "stable", is_polite_churner=True, quality_overall=40, channel="email"),
        _make_conversation("c004", "account_recovery", "success", "positive", quality_overall=75, channel="chat", plan_tier="pro"),
        _make_conversation("c005", "account_recovery", "failed", "negative", "worsened", quality_overall=25, channel="chat",
                           failure_tags=[FailureTag(type="context_loss", turn=4, detail="Forgot user context")]),
        _make_conversation("c006", "account_recovery", "escalated", "negative", "worsened", is_frustration_transfer=True, quality_overall=20, channel="chat", plan_tier="enterprise"),
        _make_conversation("c007", "cancellation_request", "success", "neutral", quality_overall=65, plan_tier="pro"),
        _make_conversation("c008", "cancellation_request", "abandoned", "negative", "worsened", is_polite_churner=True, quality_overall=35),
        _make_conversation("c009", "refund_request", "success", "positive", quality_overall=70, product="widget-pro"),
        _make_conversation("c010", "refund_request", "failed", "negative", "worsened", quality_overall=28, product="widget-pro",
                           is_confident_wrong_answer=True, frustration_triggers=["you already said that"],
                           failure_tags=[FailureTag(type="confident_wrong_answer", turn=3, detail="Answered different question")]),
        _make_conversation("c011", "password_reset", "success", "positive", quality_overall=85),
        _make_conversation("c012", "password_reset", "success", "positive", quality_overall=82),
        _make_conversation("c013", "order_status", "success", "neutral", quality_overall=78, channel="chat"),
        _make_conversation("c014", "order_status", "failed", "negative", quality_overall=32, channel="email",
                           is_exhaustion_loop=True, frustration_triggers=["I already told you"]),
        _make_conversation("c015", "feature_request", "abandoned", "neutral", quality_overall=50, is_false_positive_resolution=True),
    ]


def test_deterministic_aggregation_identical():
    """Run deterministic aggregation twice on the same data and assert identical results."""
    data = _build_test_data()

    dashboard_1 = aggregate_dashboard_deterministic(data)
    dashboard_2 = aggregate_dashboard_deterministic(data)

    d1 = json.loads(dashboard_1.model_dump_json())
    d2 = json.loads(dashboard_2.model_dump_json())

    assert d1 == d2, "Deterministic aggregation produced different results on identical data"


def test_deterministic_aggregation_order_independent():
    """Aggregation should produce the same result regardless of input order."""
    data = _build_test_data()
    reversed_data = list(reversed(data))

    dashboard_1 = aggregate_dashboard_deterministic(data)
    dashboard_2 = aggregate_dashboard_deterministic(reversed_data)

    d1 = json.loads(dashboard_1.model_dump_json())
    d2 = json.loads(dashboard_2.model_dump_json())

    assert d1 == d2, "Aggregation results differ when input order changes"


def test_counts_are_correct():
    """Verify the basic counts match expected values."""
    data = _build_test_data()
    dashboard = aggregate_dashboard_deterministic(data)

    assert dashboard.summary.total_conversations == 15
    assert dashboard.summary.total_messages == 90  # 15 * 6

    assert dashboard.sentiment_breakdown.positive == 5
    assert dashboard.sentiment_breakdown.neutral == 5
    assert dashboard.sentiment_breakdown.negative == 5

    # Outcomes: 7 success, 4 failed, 3 abandoned, 1 escalated
    assert dashboard.resolution_rate == round(7 / 15, 3)
    assert dashboard.handoff_rate == round(1 / 15, 3)
    assert dashboard.polite_churner_rate == round(2 / 15, 3)
    assert dashboard.false_positive_rate == round(1 / 15, 3)

    # Resolution breakdown
    rb = dashboard.resolution_breakdown
    assert rb.escalated_to_human == 1
    assert rb.false_positive_resolved == 1
    # All categories should sum to total
    total_rb = rb.truly_resolved + rb.resolved_after_frustration + rb.false_positive_resolved + rb.escalated_to_human + rb.in_progress + rb.cancelled
    assert total_rb == 15, f"Resolution breakdown sums to {total_rb}, expected 15"

    # Sentiment trajectory
    assert dashboard.sentiment_trajectory.worsened == 5
    assert dashboard.sentiment_trajectory.improved == 1
    assert dashboard.sentiment_trajectory.stable == 9

    # Duplicate response count
    assert dashboard.duplicate_response_count == 1  # c014


def test_channel_breakdown():
    """Verify channel breakdown is computed correctly."""
    data = _build_test_data()
    dashboard = aggregate_dashboard_deterministic(data)

    channels = {ch.channel: ch for ch in dashboard.channel_breakdown}
    assert "chat" in channels
    assert "email" in channels


def test_patterns_detected():
    """Verify behavioral patterns are detected."""
    data = _build_test_data()
    dashboard = aggregate_dashboard_deterministic(data)

    pattern_names = {p.name for p in dashboard.patterns}
    assert "polite_churner" in pattern_names
    assert "frustration_transfer" in pattern_names
    assert "confident_wrong_answer" in pattern_names

    polite = next(p for p in dashboard.patterns if p.name == "polite_churner")
    assert polite.count == 2


def test_failure_breakdown():
    """Verify failure types are aggregated."""
    data = _build_test_data()
    dashboard = aggregate_dashboard_deterministic(data)

    failure_types = {f.type for f in dashboard.failure_breakdown}
    assert "misunderstanding" in failure_types
    assert "context_loss" in failure_types
    assert "confident_wrong_answer" in failure_types
