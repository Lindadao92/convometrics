/**
 * Transforms Claude's AnalysisResponse (from CSV upload) into the shapes
 * each dashboard page expects from its API route.
 *
 * This bridges the gap between the upload flow (which stores AnalysisResponse
 * in AnalysisContext) and the dashboard pages (which expect API-shaped data).
 */

import type { AnalysisResponse, ClaudeIntentResult, ClaudeConversationResult } from "./analyzer";

function formatLabel(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Overview ────────────────────────────────────────────────────────────────

export function transformUploadToOverview(data: AnalysisResponse) {
  const { summary, intents, conversations } = data;

  // Status breakdown from conversations
  const outcomeCounts: Record<string, number> = {};
  for (const c of conversations) {
    const outcome = c.outcome ?? "unknown";
    outcomeCounts[outcome] = (outcomeCounts[outcome] ?? 0) + 1;
  }

  const total = summary.totalConversations;
  const successCount = outcomeCounts["success"] ?? 0;
  const failedCount = (outcomeCounts["failed"] ?? 0) + (outcomeCounts["abandoned"] ?? 0);

  const completionRate = total > 0 ? Math.round((successCount / total) * 1000) / 10 : null;
  const failureRate = total > 0 ? Math.round((failedCount / total) * 1000) / 10 : null;
  const avgTurns = total > 0 ? Math.round((summary.totalMessages / total) * 10) / 10 : null;

  // Approximate quality from success rate (0-100 scale)
  const avgQuality = total > 0
    ? Math.round(summary.actualResolutionRate)
    : null;

  // Health score
  const healthScore =
    avgQuality !== null && completionRate !== null && failureRate !== null
      ? Math.round((avgQuality / 100) * (completionRate / 100) * (1 - failureRate / 100) * 100)
      : null;

  // Build intent arrays for top/worst performing
  const intentArr = intents.map((i: ClaudeIntentResult) => ({
    intent: i.displayName,
    count: i.sessions,
    avgQuality: Math.round(i.successRate * 100),
    failRate: Math.round((1 - i.successRate) * 100),
    completionRate: Math.round(i.successRate * 100),
  }));

  const topPerformingTopics = [...intentArr]
    .sort((a, b) => b.avgQuality - a.avgQuality)
    .slice(0, 3)
    .map(({ intent, avgQuality, count, completionRate }) => ({ intent, avgQuality, count, completionRate }));

  const worstPerformingTopics = [...intentArr]
    .sort((a, b) => a.avgQuality - b.avgQuality)
    .slice(0, 3)
    .map(({ intent, avgQuality, count, failRate }) => ({ intent, avgQuality, count, failRate }));

  const topTopic = intentArr.length > 0
    ? [...intentArr].sort((a, b) => b.count - a.count)[0].intent
    : null;

  // Quality distribution buckets
  const qualityBuckets = [
    { label: "0–20", min: 0, max: 20, count: 0 },
    { label: "21–40", min: 21, max: 40, count: 0 },
    { label: "41–60", min: 41, max: 60, count: 0 },
    { label: "61–80", min: 61, max: 80, count: 0 },
    { label: "81–100", min: 81, max: 100, count: 0 },
  ];
  for (const c of conversations) {
    const score = c.outcome === "success" ? 80 : c.outcome === "abandoned" ? 40 : 25;
    const bucket = qualityBuckets.find((b) => score >= b.min && score <= b.max);
    if (bucket) bucket.count++;
  }

  const statusBreakdown = Object.entries(outcomeCounts).map(([status, count]) => ({ status, count }));

  return {
    stats: {
      total,
      analyzed: total,
      avgQuality,
      completionRate,
      failureRate,
      avgTurns,
      totalMessages: summary.totalMessages,
      topTopic,
    },
    healthScore,
    qualityDistribution: qualityBuckets.map(({ label, count }) => ({ label, count })),
    statusBreakdown,
    topPerformingTopics,
    worstPerformingTopics,
  };
}

// ─── Intents / Topics ────────────────────────────────────────────────────────

export function transformUploadToTopics(data: AnalysisResponse) {
  const { intents, summary } = data;

  const unclustered = intents.map((i: ClaudeIntentResult) => ({
    label: i.displayName,
    count: i.sessions,
    avgQuality: Math.round(i.successRate * 100),
    failureRate: Math.round((1 - i.successRate) * 100),
    completionRate: Math.round(i.successRate * 100),
  }));

  return {
    unclustered,
    totalConversations: summary.totalConversations,
    uniqueTopicsCount: unclustered.length,
  };
}

// ─── Patterns ────────────────────────────────────────────────────────────────

export function transformUploadToPatterns(data: AnalysisResponse) {
  const { patterns, conversations, summary } = data;
  const total = summary.totalConversations;

  // Match patterns by name
  const patternMap: Record<string, typeof patterns[0]> = {};
  for (const p of patterns) {
    patternMap[p.name] = p;
  }

  // Find pattern by common names
  const politeChurner = patternMap["polite_churner"] || patternMap["the_polite_churner"]
    || patterns.find((p) => p.label.toLowerCase().includes("polite"));
  const frustrationTransfer = patternMap["frustration_transfer"]
    || patterns.find((p) => p.label.toLowerCase().includes("frustration"));
  const exhaustionLoop = patternMap["exhaustion_loop"] || patternMap["the_exhaustion_loop"]
    || patterns.find((p) => p.label.toLowerCase().includes("exhaustion"));

  const politeCount = politeChurner?.count ?? 0;
  const frustrationCount = frustrationTransfer?.count ?? 0;
  const exhaustionCount = exhaustionLoop?.count ?? 0;

  // Build examples from conversations
  const abandonedConvos = conversations.filter((c: ClaudeConversationResult) => c.outcome === "abandoned");
  const failedConvos = conversations.filter((c: ClaudeConversationResult) => c.outcome === "failed");
  const escalatedConvos = conversations.filter((c: ClaudeConversationResult) => c.outcome === "escalated");

  const politeExamples = abandonedConvos.slice(0, 3).map((c: ClaudeConversationResult) => ({
    id: c.id,
    intent: formatLabel(c.intent),
    turns: c.messageCount,
    quality: 40,
    signals: ["gratitude"],
  }));

  const frustrationExamples = (escalatedConvos.length > 0 ? escalatedConvos : failedConvos).slice(0, 3).map((c: ClaudeConversationResult) => ({
    id: c.id,
    intent: formatLabel(c.intent),
    turns: c.messageCount,
    quality: 30,
    satisfaction: "negative",
  }));

  const exhaustionExamples = failedConvos
    .filter((c: ClaudeConversationResult) => c.messageCount > 6)
    .slice(0, 3)
    .map((c: ClaudeConversationResult) => ({
      id: c.id,
      intent: formatLabel(c.intent),
      turns: c.messageCount,
      quality: 35,
    }));

  return {
    total,
    politeChurner: {
      count: politeCount,
      pct: total > 0 ? Math.round((politeCount / total) * 1000) / 10 : 0,
      avgQuality: 40,
      examples: politeExamples,
    },
    frustrationTransfer: {
      count: frustrationCount,
      pct: total > 0 ? Math.round((frustrationCount / total) * 1000) / 10 : 0,
      avgTurns: frustrationExamples.length > 0
        ? Math.round(frustrationExamples.reduce((s, e) => s + e.turns, 0) / frustrationExamples.length)
        : 0,
      examples: frustrationExamples,
    },
    exhaustionLoop: {
      count: exhaustionCount,
      pct: total > 0 ? Math.round((exhaustionCount / total) * 1000) / 10 : 0,
      avgTurns: exhaustionExamples.length > 0
        ? Math.round(exhaustionExamples.reduce((s, e) => s + e.turns, 0) / exhaustionExamples.length)
        : 0,
      examples: exhaustionExamples,
    },
  };
}

// ─── Reality Check ───────────────────────────────────────────────────────────

export function transformUploadToRealityCheck(data: AnalysisResponse) {
  const { summary, realityCheck, conversations } = data;
  const total = summary.totalConversations;
  const avgMessages = total > 0
    ? Math.round((summary.totalMessages / total) * 10) / 10
    : 5;

  const failedCount = conversations.filter(
    (c: ClaudeConversationResult) => c.outcome === "failed" || c.outcome === "abandoned"
  ).length;

  const falsePositives = Math.round(
    ((summary.reportedResolutionRate - summary.actualResolutionRate) / 100) * total
  );

  return {
    total,
    reported: {
      resolution: summary.reportedResolutionRate,
      csat: realityCheck?.reported
        ? Math.round((realityCheck.reported.resolutionRate / 20) * 10) / 10
        : 4.2,
      avgMessages: realityCheck?.reported?.avgMessagesPerConversation ?? avgMessages,
      conversations: total,
    },
    actual: {
      resolution: summary.actualResolutionRate,
      csat: realityCheck?.actual
        ? Math.round((realityCheck.actual.resolutionRate / 20) * 10) / 10
        : 3.1,
      avgMessages,
      actualAvgMessages: realityCheck?.actual?.avgMessagesToResolution ?? avgMessages,
      conversations: total - failedCount,
      falsePositives: Math.max(0, falsePositives),
      loops: failedCount,
    },
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export function transformUploadToActions(data: AnalysisResponse) {
  const { actions, summary, intents } = data;

  const mappedActions = actions.map((a, i) => {
    // Find matching intent for session count
    const matchingIntent = intents.find((intent: ClaudeIntentResult) =>
      intent.name === a.intent || intent.displayName === a.intent
    );
    const sessions = matchingIntent?.sessions ?? Math.round(summary.totalConversations / Math.max(actions.length, 1));
    const failCount = matchingIntent
      ? Math.round(sessions * (1 - matchingIntent.successRate))
      : Math.round(sessions * 0.5);

    return {
      priority: i + 1,
      title: a.title,
      description: a.why,
      intent: formatLabel(a.intent),
      effort: a.effort,
      impact: a.impact,
      metric: `${failCount} failures`,
      conversations: sessions,
      failCount,
    };
  });

  return {
    actions: mappedActions,
    totalConversations: summary.totalConversations,
  };
}

// ─── Conversations ───────────────────────────────────────────────────────────

export function transformUploadToConversations(data: AnalysisResponse) {
  const { conversations, summary } = data;

  const statusMap: Record<string, string> = {
    success: "completed",
    failed: "failed",
    abandoned: "abandoned",
    escalated: "failed",
  };

  const mapped = conversations.map((c: ClaudeConversationResult) => ({
    id: c.id,
    conversation_id: c.id,
    user_id: "user",
    platform: "upload",
    intent: formatLabel(c.intent),
    quality_score: c.outcome === "success" ? 80 : c.outcome === "abandoned" ? 40 : 25,
    completion_status: statusMap[c.outcome] ?? c.outcome,
    messages: [{ role: "user", content: c.summary }],
    created_at: new Date().toISOString(),
    turns: c.messageCount,
    firstUserMessage: c.summary,
    outcome: c.outcome,
  }));

  const intentSet = new Set(conversations.map((c: ClaudeConversationResult) => c.intent).filter(Boolean));

  return {
    conversations: mapped,
    total: summary.totalConversations,
    intents: Array.from(intentSet) as string[],
  };
}
