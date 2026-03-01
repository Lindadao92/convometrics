/**
 * Transforms backend Dashboard JSON into the shapes each dashboard page expects.
 *
 * Backend Dashboard shape (from convometrics-api/utils/llm.py):
 * {
 *   summary: { total_conversations, total_messages, reported_resolution_rate, actual_resolution_rate, gap_explanation }
 *   intent_breakdown: [{ name, display_name, sessions, success_rate, severity, root_cause, downstream_impact }]
 *   sentiment_breakdown: { positive, neutral, negative }
 *   resolution_rate: float
 *   polite_churner_rate: float
 *   handoff_rate: float
 *   top_issues: [{ priority, title, intent, effort, impact, why }]
 *   conversations: [{ id, intent, outcome, summary }]
 * }
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>;

// ─── Overview ────────────────────────────────────────────────────────────────

export function transformToOverview(d: D) {
  const summary = d.summary ?? {};
  const intents = (d.intent_breakdown ?? []) as D[];
  const conversations = (d.conversations ?? []) as D[];
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
    intent: i.display_name ?? i.name ?? "unknown",
    count: i.sessions ?? 0,
    avgQuality: Math.round((i.success_rate ?? 0) * 100),
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

  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : null;
  const failureRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : null;
  const avgQuality = total > 0 ? Math.round((d.resolution_rate ?? 0) * 100) : null;

  // Health score: quality * completion * (1 - failure)
  const healthScore = avgQuality !== null && completionRate !== null && failureRate !== null
    ? Math.round((avgQuality / 100) * (completionRate / 100) * (1 - failureRate / 100) * 100)
    : null;

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
    qualityDistribution: [] as { label: string; count: number }[],
    statusBreakdown: Object.entries(outcomeCounts).map(([status, count]) => ({ status, count })),
    topPerformingTopics,
    worstPerformingTopics,
  };
}

// ─── Topics / Intent Analysis ────────────────────────────────────────────────

export function transformToTopics(d: D) {
  const intents = (d.intent_breakdown ?? []) as D[];
  const conversations = (d.conversations ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;

  const unclustered = intents.map((i) => ({
    label: i.display_name ?? i.name ?? "unknown",
    count: i.sessions ?? 0,
    avgQuality: Math.round((i.success_rate ?? 0) * 100),
    failureRate: Math.round((1 - (i.success_rate ?? 0)) * 100),
    completionRate: Math.round((i.success_rate ?? 0) * 100),
  }));

  return {
    unclustered,
    totalConversations: total,
    uniqueTopicsCount: unclustered.length,
  };
}

// ─── Patterns ────────────────────────────────────────────────────────────────

export function transformToPatterns(d: D) {
  const conversations = (d.conversations ?? []) as D[];
  const total = d.summary?.total_conversations ?? conversations.length;
  const politeChurnerRate = d.polite_churner_rate ?? 0;
  const handoffRate = d.handoff_rate ?? 0;

  // Estimate pattern counts from rates
  const politeChurnerCount = Math.round(politeChurnerRate * total);
  const frustrationTransferCount = Math.round(handoffRate * total);
  // Estimate exhaustion loops from conversations with "failed" or "abandoned" outcomes minus polite churners
  const failedConvos = conversations.filter((c) => c.outcome === "failed" || c.outcome === "abandoned");
  const exhaustionLoopCount = Math.max(0, failedConvos.length - politeChurnerCount - frustrationTransferCount);

  // Build examples from conversations
  const politeChurnerExamples = conversations
    .filter((c) => c.outcome === "abandoned")
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: 0,
      quality: 40,
      signals: ["gratitude"],
    }));

  const frustrationExamples = conversations
    .filter((c) => c.outcome === "escalated")
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: 0,
      quality: 30,
      satisfaction: "frustrated",
    }));

  const exhaustionExamples = conversations
    .filter((c) => c.outcome === "failed")
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      intent: c.intent ?? "unknown",
      turns: 0,
      quality: 35,
    }));

  return {
    total,
    politeChurner: {
      count: politeChurnerCount,
      pct: total > 0 ? Math.round(politeChurnerRate * 1000) / 10 : 0,
      avgQuality: 40,
      examples: politeChurnerExamples,
    },
    frustrationTransfer: {
      count: frustrationTransferCount,
      pct: total > 0 ? Math.round(handoffRate * 1000) / 10 : 0,
      avgTurns: 0,
      examples: frustrationExamples,
    },
    exhaustionLoop: {
      count: exhaustionLoopCount,
      pct: total > 0 ? Math.round((exhaustionLoopCount / total) * 1000) / 10 : 0,
      avgTurns: 0,
      examples: exhaustionExamples,
    },
  };
}

// ─── Reality Check ───────────────────────────────────────────────────────────

export function transformToRealityCheck(d: D) {
  const summary = d.summary ?? {};
  const conversations = (d.conversations ?? []) as D[];
  const total = summary.total_conversations ?? conversations.length;

  const reportedResolution = Math.round((summary.reported_resolution_rate ?? 0) * 1000) / 10;
  const actualResolution = Math.round((summary.actual_resolution_rate ?? 0) * 1000) / 10;
  const politeChurnerRate = d.polite_churner_rate ?? 0;
  const falsePositives = Math.round(politeChurnerRate * total);

  // Estimate loop count from failed/abandoned conversations
  const loopCount = conversations.filter((c) => c.outcome === "failed" || c.outcome === "abandoned").length;

  return {
    total,
    reported: {
      resolution: reportedResolution,
      csat: 4.2,
      avgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      conversations: total,
    },
    actual: {
      resolution: actualResolution,
      csat: 3.6,
      avgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      actualAvgMessages: summary.total_messages && total > 0 ? Math.round((summary.total_messages / total) * 10) / 10 : 5,
      conversations: total - loopCount,
      falsePositives,
      loops: loopCount,
    },
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
      intent: issue.intent ?? "unknown",
      effort: (issue.effort ?? "medium") as "low" | "medium" | "high",
      impact: issue.impact ?? "Reduce failures",
      metric: `${failCount} failures`,
      conversations: sessions,
      failCount,
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
    intent: c.intent ?? null,
    quality_score: c.outcome === "success" ? 80 : c.outcome === "abandoned" ? 40 : 30,
    completion_status: statusMap[c.outcome] ?? c.outcome ?? null,
    messages: [{ role: "user", content: c.summary ?? "" }],
    created_at: new Date().toISOString(),
    turns: null,
    firstUserMessage: c.summary ?? "",
    outcome: c.outcome ?? null,
  }));

  // Collect unique intents
  const intents = [...new Set(conversations.map((c) => c.intent).filter(Boolean))] as string[];

  return {
    conversations: mapped,
    total,
    intents,
  };
}
