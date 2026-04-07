import json
import logging
from datetime import datetime, timedelta

import anthropic
import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Analysis, Call, User

logger = logging.getLogger("convometrics.integrations")

client = anthropic.Anthropic()


def push_to_posthog(analysis: Analysis, call: Call, user: User, db: Session) -> None:
    if not user.posthog_api_key:
        return

    host = (user.posthog_host or "https://app.posthog.com").rstrip("/")
    url = f"{host}/capture/"

    payload = {
        "api_key": user.posthog_api_key,
        "event": "voice_agent_call_analyzed",
        "distinct_id": "convometrics_agent",
        "timestamp": call.started_at.isoformat() if call.started_at else datetime.utcnow().isoformat(),
        "properties": {
            "call_id": call.call_id,
            "platform": call.platform,
            "intent": analysis.intent,
            "resolved": analysis.resolved,
            "resolution_type": analysis.resolution_type,
            "failure_pattern": analysis.failure_pattern,
            "sentiment": analysis.sentiment,
            "turns": analysis.turns,
            "duration_seconds": call.duration_seconds,
            "$lib": "convometrics",
        },
    }

    try:
        with httpx.Client(timeout=10) as http:
            resp = http.post(url, json=payload)
            resp.raise_for_status()

        analysis.posthog_sent = True
        db.commit()
        logger.info(f"PostHog event sent for call {call.call_id}")
    except httpx.HTTPError as e:
        logger.error(f"PostHog push failed for call {call.call_id}: {e}")


BRIEFING_PROMPT = """You are ConvoMetrics, a voice agent analytics tool. Generate a concise weekly briefing in terminal/monospace style.

Here are the stats for this week:

Period: {period}
Total calls analyzed: {total_calls}
Reported completion rate: {reported_rate}%
Actual resolution rate: {actual_rate}%
Gap: {gap}pt

Top failing intents:
{intents_text}

Failure patterns detected:
{patterns_text}

Generate a briefing in this exact format (plain text, monospace-friendly):

⚡ WEEKLY BRIEFING — Voice Agent
period: {period}
calls analyzed: {total_calls}

reported completion: {reported_rate}%
actual resolution: {actual_rate}% ← {gap}pt gap
Your dashboard counts silence as success.

top failing intents:
[list each intent with calls count and FCR%]

hidden patterns:
[list each pattern with count and one-line explanation]

recommended this sprint:
[pick the single highest-impact fix and explain why in 2 sentences]

Keep it under 30 lines. Be direct. No fluff. Use the actual numbers provided."""


def generate_briefing_text(user: User, db: Session) -> str:
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    analyses = (
        db.query(Analysis)
        .filter(Analysis.user_id == user.id, Analysis.analyzed_at >= week_ago)
        .all()
    )

    if not analyses:
        return "No calls analyzed in the last 7 days."

    total = len(analyses)
    resolved = sum(1 for a in analyses if a.resolved)
    actual_rate = round(resolved / total * 100) if total else 0
    # Reported rate: assume all non-"abandoned" calls are counted as "completed" by the platform
    completed = sum(1 for a in analyses if a.resolution_type != "abandoned")
    reported_rate = round(completed / total * 100) if total else 0
    gap = reported_rate - actual_rate

    # Intents breakdown
    intent_counts: dict[str, dict] = {}
    for a in analyses:
        if a.intent not in intent_counts:
            intent_counts[a.intent] = {"calls": 0, "resolved": 0}
        intent_counts[a.intent]["calls"] += 1
        if a.resolved:
            intent_counts[a.intent]["resolved"] += 1

    intents_sorted = sorted(
        intent_counts.items(),
        key=lambda x: (x[1]["resolved"] / x[1]["calls"]) if x[1]["calls"] > 0 else 1,
    )
    intents_text = "\n".join(
        f"  - {name}: {d['calls']} calls, {round(d['resolved']/d['calls']*100)}% FCR"
        for name, d in intents_sorted[:5]
    )

    # Patterns
    pattern_counts: dict[str, int] = {}
    for a in analyses:
        if a.failure_pattern:
            pattern_counts[a.failure_pattern] = pattern_counts.get(a.failure_pattern, 0) + 1
    patterns_text = "\n".join(
        f"  - {p}: {c} occurrences" for p, c in sorted(pattern_counts.items(), key=lambda x: -x[1])
    )
    if not patterns_text:
        patterns_text = "  None detected"

    period = f"{week_ago.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": BRIEFING_PROMPT.format(
                        period=period,
                        total_calls=total,
                        reported_rate=reported_rate,
                        actual_rate=actual_rate,
                        gap=gap,
                        intents_text=intents_text,
                        patterns_text=patterns_text,
                    ),
                }
            ],
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Briefing generation failed: {e}")
        # Fallback to basic stats
        return (
            f"⚡ WEEKLY BRIEFING — Voice Agent\n"
            f"period: {period}\n"
            f"calls analyzed: {total}\n\n"
            f"reported completion: {reported_rate}%\n"
            f"actual resolution: {actual_rate}% ← {gap}pt gap\n"
        )


def send_slack_briefing(user: User, db: Session) -> None:
    if not user.slack_webhook_url:
        logger.info(f"User {user.email}: no Slack webhook configured, skipping")
        return

    briefing_text = generate_briefing_text(user, db)

    payload = {
        "text": "ConvoMetrics Weekly Briefing",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"```{briefing_text}```",
                },
            }
        ],
    }

    try:
        with httpx.Client(timeout=15) as http:
            resp = http.post(user.slack_webhook_url, json=payload)
            resp.raise_for_status()
        logger.info(f"Slack briefing sent for user {user.email}")
    except httpx.HTTPError as e:
        logger.error(f"Slack briefing failed for user {user.email}: {e}")
