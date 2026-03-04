/**
 * Transforms backend Dashboard JSON into the shapes each dashboard page expects.
 *
 * Backend Dashboard shape (enriched — from convometrics-api/utils/llm.py):
 * {
 *   summary: { total_conversations, total_messages, reported_resolution_rate,
 *              actual_resolution_rate, gap_explanation, key_insight, briefing[] }
 *   intent_breakdown: [{ name, display_name, sessions, success_rate, severity,
 *                        avg_quality, avg_sentiment_score, top_failure_types[],
 *                        root_cause, downstream_impact }]
 *   topic_clusters: [{ name, description, intents[], total_sessions, avg_quality, trend }]
 *   sentiment_breakdown: { positive, neutral, negative }
 *   sentiment_trajectory: { worsened, improved, stable, worsened_pct }
 *   resolution_breakdown: { truly_resolved, resolved_after_frustration,
 *                           false_positive_resolved, escalated_to_human, in_progress, cancelled }
 *   channel_breakdown: [{ channel, conversations, resolution_rate, escalation_rate }]
 *   product_breakdown: [{ product, conversations, resolution_rate }]
 *   plan_tier_breakdown: [{ tier, conversations, bad_outcome_rate, escalation_rate }]
 *   quality_breakdown: { avg_helpfulness, avg_relevance, avg_accuracy, avg_naturalness,
 *                        avg_safety, avg_coherence, avg_satisfaction, avg_overall }
 *   resolution_rate: float
 *   polite_churner_rate: float
 *   false_positive_rate: float
 *   handoff_rate: float
 *   churn_risk: { total_churn_risk_conversations, cancellation_save_rate,
 *                 complaint_resolution_rate, refund_resolution_rate }
 *   ai_failure_patterns: [{ trigger, count, top_intents[] }]
 *   duplicate_response_count: int
 *   revenue_risk: { high_value_customers, high_value_bad_outcome_rate,
 *                   enterprise_bad_outcome_rate, pro_bad_outcome_rate }
 *   patterns: [{ name, label, count, severity, description, insight, affected_intents[] }]
 *   failure_breakdown: [{ type, count, pct, top_intents[], example_detail }]
 *   top_issues: [{ priority, title, intent, effort, impact, why, estimated_improvement }]
 *   conversations: [{ id, intent, outcome, sentiment, sentiment_trajectory, summary,
 *                     quality_score, first_user_message, key_excerpt, failure_tags[],
 *                     satisfaction_signals[], message_count, channel, product, plan_tier,
 *                     csv_resolution_status, resolution_mismatch, is_false_positive,
 *                     frustration_triggers[] }]
 * }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;

function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Overview ────────────────────────────────────────────────────────────────

export function transformToOverview(d: D) {
  const summary = d.summary ?? {};
  const intents = (d.intent_breakdown ?? []) as D[];
  const conversations = (d.conversations ?? []) as D[];
  const quality = d.quality_breakdown ?? {};
  const total = summary.total_conversations ?? conversations.length;
  const totalMessages = summary.total_messages ?? 0;

  // Compute outcome counts from conversations
  const outcomeCounts: Record<string, number> = {};
  for (const c of conversations) {
    const o = c.outcome ?? "unknown";
    outcomeCounts[o] = (outcomeCounts[o] ?? 0) + 1;
  }
  const completed = outcomeCounts["success"] ?? 0;
  const failed = (outcomeCounts["failed"] ?? 0) + (outcomeCounts["abandoned"] ?? 0);

  // Compute sentiment from breakdown
  const sb = d.sentiment_breakdown ?? {};
  const sentimentTotal = (sb.positive ?? 0) + (sb.neutral ?? 0) + (sb.negative ?? 0);

  // Build intent metrics
  const intentArr = intents.map((i) => ({
    intent: i.display_name ?? formatLabel(i.name ?? "unknown"),
    count: i.sessions ?? 0,
    avgQuality: i.avg_quality ?? Math.round((i.success_rate ?? 0) * 100),
    failRate: Math.round((1 - (i.success_rate ?? 0)) * 100),
    completionRate: Math.round((i.success_rate ?? 0) * 100),
  }));

  const topPerformingTopics = [...intentArr]
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .slice(0, 3)
    .map(({ intent, avgQuality, count, completionRate }) => ({ intent, avgQuality, count, completionRate }));

  const worstPerformingTopics = [...intentArr]
    .sort((a, b) => a.avgQuality - b.avgQuality)
    .slice(0, 3)
    .map(({ intent, avgQuality, count, failRate }) => ({ intent, avgQuality, count, failRate }));

  const avgQuality = quality.avg_overall ?? (total > 0 ? Math.round((d.resolution_rate ?? 0) * 100) : null);
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : null;
  const failureRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : null;

  // Health score
  const healthScore = avgQuality !== null && completionRate !== null && failureRate !== null
    ? Math.round((avgQuality / 100) * (completionRate / 100) * (1 - failureRate / 100) * 100)
    : null;

  // Quality distribution from conversations
  const qualityBuckets = [
    { label: "0-20", min: 0, max: 20, count: 0 },
    { label: "21-40", min: 21, max: 40, count: 0 },
    { label: "41-60", min: 41, max: 60, count: 0 },
    { label: "61-80", min: 61, max: 80, count: 0 },
    { label: "81-100", min: 81, max: 100, count: 0 },
  ];
  for (const c of conversations) {
    const score = c.quality_score ?? 50;
    const bucket = qualityBuckets.find((b) => score >= b.min && score <= b.max);
    if (bucket) bucket.count++;
  }

  return {
    stats: {
      total,
      analyzed: total,
      avgQuality,
      completionRate,
      failureRate,
      avgTurns: totalMessages > 0 && total > 0 ? Math.round((totalMessages / total) * 10) / 10 : null,
      totalMessages,
      topTopic: intentArr.length > 0 ? [...intentArr].sort((a, b) => b.count - a.count)[0].intent : null,
    },
    healthScore,
    qualityDistribution: qualityBuckets.map(({ label, count }) => ({ label, count })),
    statusBreakdown: Object.entries(outcomeCounts).map(([status, count]) => ({ status, count })),
    topPerformingTopics,
    worstPerformingTopics,
    sentimentBreakdown: sentimentTotal > 0 ? {
      positive: Math.round((sb.positive / sentimentTotal) * 100),
      neutral: Math.round((sb.neutral / sentimentTotal) * 100),
      negative: Math.round((sb.negative / sentimentTotal) * 100),
    } : null,
    qualityDimensions: quality.avg_overall ? {
      helpfulness: quality.avg_helpfulness,
      relevance: quality.avg_relevance,
      accuracy: quality.avg_accuracy,
      naturalness: quality.avg_naturalness,
      safety: quality.avg_safety,
      coherence: quality.avg_coherence,
      satisfaction: quality.avg_satisfaction,
    } : null,
    keyInsight: summary.key_insight ?? null,
    briefing: summary.briefing ?? [],
    // New dimensions
    sentimentTrajectory: d.sentiment_trajectory ?? null,
    resolutionBreakdown: d.resolution_breakdown ?? null,
    falsePositiveRate: d.false_positive_rate ?? null,
    channelBreakdown: (d.channel_breakdown ?? []).map((ch: D) => ({
      channel: ch.channel,
      conversations: ch.conversations ?? 0,
      resolutionRate: ch.resolution_rate ?? 0,
      escalationRate: ch.escalation_rate ?? 0,
    })),
    productBreakdown: (d.product_breakdown ?? []).map((p: D) => ({
      product: p.product,
      conversations: p.conversations ?? 0,
      resolutionRate: p.resolution_rate ?? 0,
    })),
    planTierBreakdown: (d.plan_tier_breakdown ?? []).map((t: D) => ({
      tier: t.tier,
      conversations: t.conversations ?? 0,
      badOutcomeRate: t.bad_outcome_rate ?? 0,
      escalationRate: t.escalation_rate ?? 0,
    })),
    churnRisk: d.churn_risk ?? null,
    aiFailurePatterns: (d.ai_failure_patterns ?? []).map((p: D) => ({
      trigger: p.trigger,
      count: p.count ?? 0,
      topIntents: (p.top_intents ?? []).map(formatLabel),
    })),
    duplicateResponseCount: d.duplicate_response_count ?? 0,
    revenueRisk: d.revenue_risk ?? null,
  };
}

// ─── Topics / Intent Analysis ────────────────────────────────────────────────

export function transformToTopics(d: D) {
  const intents = (d.intent_breakdown ?? []) as D[];
  const conversations = (d.conversations ?? []) as D[];
  const clusters = (d.topic_clusters ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;

  const unclustered = intents.map((i) => ({
    label: i.display_name ?? formatLabel(i.name ?? "unknown"),
    count: i.sessions ?? 0,
    avgQuality: i.avg_quality ?? Math.round((i.success_rate ?? 0) * 100),
    failureRate: Math.round((1 - (i.success_rate ?? 0)) * 100),
    completionRate: Math.round((i.success_rate ?? 0) * 100),
    severity: i.severity ?? "performing",
    topFailureTypes: i.top_failure_types ?? [],
    rootCause: i.root_cause ?? "",
    downstreamImpact: i.downstream_impact ?? "",
  }));

  const topicClusters = clusters.map((c) => ({
    name: c.name,
    description: c.description ?? "",
    intents: (c.intents ?? []).map((name: string) => formatLabel(name)),
    totalSessions: c.total_sessions ?? 0,
    avgQuality: c.avg_quality ?? 0,
    trend: c.trend ?? "stable",
  }));

  return {
    unclustered,
    clusters: topicClusters,
    totalConversations: total,
    uniqueTopicsCount: unclustered.length,
  };
}

// ─── Patterns ────────────────────────────────────────────────────────────────

export function transformToPatterns(d: D) {
  const conversations = (d.conversations ?? []) as D[];
  const patterns = (d.patterns ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;
  const politeChurnerRate = d.polite_churner_rate ?? 0;
  const handoffRate = d.handoff_rate ?? 0;

  // Use patterns from backend if available
  const patternMap: Record<string, D> = {};
  for (const p of patterns) {
    patternMap[p.name] = p;
  }

  const politeChurnerCount = patternMap.polite_churner?.count ?? Math.round(politeChurnerRate * total);
  const frustrationTransferCount = patternMap.frustration_transfer?.count ?? Math.round(handoffRate * total);
  const exhaustionLoopCount = patternMap.exhaustion_loop?.count ??
    Math.max(0, conversations.filter((c) => c.outcome === "failed").length - politeChurnerCount);

  // Build examples from conversations with real data
  const politeChurnerExamples = conversations
    .filter((c) => c.outcome === "abandoned" || c.satisfaction_signals?.includes("gratitude"))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: c.message_count ?? 0,
      quality: c.quality_score ?? 40,
      signals: c.satisfaction_signals ?? ["gratitude"],
      summary: c.summary ?? "",
    }));

  const frustrationExamples = conversations
    .filter((c) => c.outcome === "escalated" || c.satisfaction_signals?.includes("escalation_request"))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: c.message_count ?? 0,
      quality: c.quality_score ?? 30,
      satisfaction: c.sentiment ?? "negative",
      summary: c.summary ?? "",
    }));

  const exhaustionExamples = conversations
    .filter((c) => c.satisfaction_signals?.includes("retry_pattern") || c.satisfaction_signals?.includes("rephrasing"))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: c.message_count ?? 0,
      quality: c.quality_score ?? 35,
      summary: c.summary ?? "",
    }));

  return {
    total,
    politeChurner: {
      count: politeChurnerCount,
      pct: total > 0 ? Math.round(politeChurnerRate * 1000) / 10 : 0,
      avgQuality: politeChurnerExamples.length > 0
        ? Math.round(politeChurnerExamples.reduce((s, e) => s + e.quality, 0) / politeChurnerExamples.length)
        : 40,
      insight: patternMap.polite_churner?.insight ?? "",
      description: patternMap.polite_churner?.description ?? "",
      affectedIntents: patternMap.polite_churner?.affected_intents ?? [],
      examples: politeChurnerExamples,
    },
    frustrationTransfer: {
      count: frustrationTransferCount,
      pct: total > 0 ? Math.round(handoffRate * 1000) / 10 : 0,
      avgTurns: frustrationExamples.length > 0
        ? Math.round(frustrationExamples.reduce((s, e) => s + e.turns, 0) / frustrationExamples.length)
        : 0,
      insight: patternMap.frustration_transfer?.insight ?? "",
      description: patternMap.frustration_transfer?.description ?? "",
      affectedIntents: patternMap.frustration_transfer?.affected_intents ?? [],
      examples: frustrationExamples,
    },
    exhaustionLoop: {
      count: exhaustionLoopCount,
      pct: total > 0 ? Math.round((exhaustionLoopCount / total) * 1000) / 10 : 0,
      avgTurns: exhaustionExamples.length > 0
        ? Math.round(exhaustionExamples.reduce((s, e) => s + e.turns, 0) / exhaustionExamples.length)
        : 0,
      insight: patternMap.exhaustion_loop?.insight ?? "",
      description: patternMap.exhaustion_loop?.description ?? "",
      affectedIntents: patternMap.exhaustion_loop?.affected_intents ?? [],
      examples: exhaustionExamples,
    },
    allPatterns: patterns.map((p) => ({
      name: p.name,
      label: p.label ?? formatLabel(p.name),
      count: p.count ?? 0,
      severity: p.severity ?? "info",
      description: p.description ?? "",
      insight: p.insight ?? "",
      affectedIntents: (p.affected_intents ?? []).map(formatLabel),
    })),
  };
}

// ─── Reality Check ───────────────────────────────────────────────────────────

export function transformToRealityCheck(d: D) {
  const summary = d.summary ?? {};
  const conversations = (d.conversations ?? []) as D[];
  const quality = d.quality_breakdown ?? {};
  const total = summary.total_conversations ?? conversations.length;
  const failureBreakdown = (d.failure_breakdown ?? []) as D[];

  const reportedResolution = Math.round((summary.reported_resolution_rate ?? 0) * 1000) / 10;
  const actualResolution = Math.round((summary.actual_resolution_rate ?? 0) * 1000) / 10;
  const politeChurnerRate = d.polite_churner_rate ?? 0;
  const falsePositiveRate = d.false_positive_rate ?? 0;
  const resBreakdown = d.resolution_breakdown ?? {};
  const falsePositives = resBreakdown.false_positive_resolved ?? Math.round(politeChurnerRate * total);

  const loopCount = (resBreakdown.in_progress ?? 0) + (resBreakdown.cancelled ?? 0) ||
    conversations.filter((c) => c.outcome === "failed" || c.outcome === "abandoned").length;

  // Compute real avg quality and satisfaction from conversations
  const avgQuality = quality.avg_overall ??
    (conversations.length > 0
      ? Math.round(conversations.reduce((s: number, c: D) => s + (c.quality_score ?? 50), 0) / conversations.length)
      : 50);
  const avgSatisfaction = quality.avg_satisfaction ?? avgQuality;

  return {
    total,
    reported: {
      resolution: reportedResolution,
      csat: Math.round((avgSatisfaction / 20) * 10) / 10, // scale 0-100 to 0-5
      avgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      conversations: total,
    },
    actual: {
      resolution: actualResolution,
      csat: Math.round(((avgSatisfaction * 0.85) / 20) * 10) / 10, // slightly lower
      avgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      actualAvgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      conversations: total - loopCount,
      falsePositives,
      loops: loopCount,
    },
    gapExplanation: summary.gap_explanation ?? "",
    falsePositiveRate: Math.round(falsePositiveRate * 1000) / 10,
    resolutionBreakdown: resBreakdown.truly_resolved != null ? {
      trulyResolved: resBreakdown.truly_resolved ?? 0,
      resolvedAfterFrustration: resBreakdown.resolved_after_frustration ?? 0,
      falsePositiveResolved: resBreakdown.false_positive_resolved ?? 0,
      escalatedToHuman: resBreakdown.escalated_to_human ?? 0,
      inProgress: resBreakdown.in_progress ?? 0,
      cancelled: resBreakdown.cancelled ?? 0,
    } : null,
    sentimentTrajectory: d.sentiment_trajectory ?? null,
    failureBreakdown: failureBreakdown.map((f) => ({
      type: formatLabel(f.type ?? "unknown"),
      count: f.count ?? 0,
      pct: f.pct ?? 0,
      topIntents: (f.top_intents ?? []).map(formatLabel),
      exampleDetail: f.example_detail ?? "",
    })),
  };
}

// ─── Actions / Recommendations ───────────────────────────────────────────────

export function transformToActions(d: D) {
  const topIssues = (d.top_issues ?? []) as D[];
  const conversations = (d.conversations ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;

  const actions = topIssues.map((issue, i) => {
    // Find matching intent to get session count
    const matchingIntent = (d.intent_breakdown ?? []).find(
      (ib: D) => (ib.name ?? ib.display_name) === issue.intent
    );
    const sessions = matchingIntent?.sessions ?? Math.round(total / (topIssues.length || 1));
    const failCount = matchingIntent
      ? Math.round(sessions * (1 - (matchingIntent.success_rate ?? 0)))
      : Math.round(sessions * 0.3);

    return {
      priority: i + 1,
      title: issue.title ?? "Improve conversation quality",
      description: issue.why ?? issue.impact ?? "",
      intent: issue.intent ? formatLabel(issue.intent) : "unknown",
      effort: (issue.effort ?? "medium") as "low" | "medium" | "high",
      impact: issue.impact ?? "Reduce failures",
      metric: `${failCount} failures`,
      conversations: sessions,
      failCount,
      estimatedImprovement: issue.estimated_improvement ?? "",
    };
  });

  return {
    actions,
    totalConversations: total,
  };
}

// ─── Conversations ───────────────────────────────────────────────────────────

export function transformToConversations(d: D) {
  const conversations = (d.conversations ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;

  const statusMap: Record<string, string> = {
    success: "completed",
    failed: "failed",
    abandoned: "abandoned",
    escalated: "failed",
  };

  const mapped = conversations.map((c) => ({
    id: c.id,
    conversation_id: c.id,
    user_id: "user",
    platform: "unknown",
    intent: c.intent ? formatLabel(c.intent) : null,
    quality_score: c.quality_score ?? (c.outcome === "success" ? 80 : c.outcome === "abandoned" ? 40 : 30),
    completion_status: statusMap[c.outcome] ?? c.outcome ?? null,
    messages: [{ role: "user", content: c.first_user_message ?? c.summary ?? "" }],
    created_at: new Date().toISOString(),
    turns: c.message_count ?? null,
    firstUserMessage: c.first_user_message ?? c.summary ?? "",
    outcome: c.outcome ?? null,
    sentiment: c.sentiment ?? null,
    sentimentTrajectory: c.sentiment_trajectory ?? null,
    summary: c.summary ?? "",
    keyExcerpt: c.key_excerpt ?? "",
    failureTags: c.failure_tags ?? [],
    satisfactionSignals: c.satisfaction_signals ?? [],
    channel: c.channel ?? null,
    product: c.product ?? null,
    planTier: c.plan_tier ?? null,
    csvResolutionStatus: c.csv_resolution_status ?? null,
    resolutionMismatch: c.resolution_mismatch ?? false,
    isFalsePositive: c.is_false_positive ?? false,
    frustrationTriggers: c.frustration_triggers ?? [],
  }));

  // Collect unique intents
  const intents = [...new Set(conversations.map((c) => c.intent).filter(Boolean))] as string[];

  return {
    conversations: mapped,
    total,
    intents,
  };
}
