// ─── Dynamic Topic Discovery Engine for Convometrics ──────────────────────────
// Automatically identifies emerging conversation patterns and topics
// beyond the hardcoded intent classifications
//
// IMPLEMENTATION NOTES:
// - Add to: /Users/linda/convometrics/dashboard/src/lib/dynamic-topic-discovery.ts
// - Import MockConversation from "./mockQualityData"
// - Create API route at: /Users/linda/convometrics/dashboard/src/app/api/dynamic-topics/route.ts

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MockConversation {
  id: string;
  timestamp: string;
  intent: string;
  user_id: string;
  turns: number;
  scores: {
    overall: number;
    helpfulness: number;
    relevance: number;
    accuracy: number;
    coherence: number;
    satisfaction: number;
    naturalness: number;
    safety: number;
  };
  satisfaction_signals: string[];
  inferred_satisfaction: string;
  failure_tags: Array<{
    type: string;
    turn: number;
    detail: string;
  }>;
}

export interface TopicCluster {
  id: string;
  label: string;
  keywords: string[];
  conversations: string[];
  quality: {
    average: number;
    trend: "improving" | "declining" | "stable";
    count: number;
  };
  emergence: {
    firstSeen: string;
    growth: number; // percentage growth week over week
    maturity: "emerging" | "established" | "declining";
  };
  suggestedIntent: string;
}

export interface EmergingPattern {
  pattern: string;
  description: string;
  frequency: number;
  impact: "high" | "medium" | "low";
  examples: Array<{
    conversationId: string;
    snippet: string;
    outcome: string;
  }>;
}

export interface TopicInsight {
  type: "new_topic" | "quality_shift" | "volume_spike" | "pattern_change";
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  actionable: boolean;
  data: Record<string, any>;
}

// ─── Core Analysis Functions ───────────────────────────────────────────────────

/**
 * Analyzes conversations to identify potential new topics/intents
 * that don't fit existing classifications
 */
export function identifyUnclassifiedPatterns(
  conversations: MockConversation[],
  knownIntents: string[]
): TopicCluster[] {
  const clusters: TopicCluster[] = [];
  
  // Group conversations by similar characteristics
  const potentialClusters = new Map<string, MockConversation[]>();
  
  for (const conv of conversations) {
    // Generate a cluster key based on conversation characteristics
    const clusterKey = generateClusterKey(conv);
    
    if (!potentialClusters.has(clusterKey)) {
      potentialClusters.set(clusterKey, []);
    }
    potentialClusters.get(clusterKey)!.push(conv);
  }
  
  // Convert clusters with sufficient size to TopicCluster objects
  let clusterIndex = 0;
  for (const [key, convs] of potentialClusters.entries()) {
    if (convs.length >= 5) { // Minimum cluster size
      const quality = calculateClusterQuality(convs);
      const emergence = calculateEmergenceMetrics(convs);
      
      clusters.push({
        id: `cluster_${clusterIndex++}`,
        label: generateClusterLabel(convs),
        keywords: extractKeywords(convs),
        conversations: convs.map(c => c.id),
        quality,
        emergence,
        suggestedIntent: generateSuggestedIntent(convs),
      });
    }
  }
  
  return clusters.sort((a, b) => b.quality.count - a.quality.count);
}

/**
 * Detects emerging conversation patterns that indicate new user behaviors
 */
export function detectEmergingPatterns(conversations: MockConversation[]): EmergingPattern[] {
  const patterns: EmergingPattern[] = [];
  
  // Pattern 1: Multi-turn help-seeking
  const multiTurnPatterns = conversations.filter(c => 
    c.turns > 8 && 
    c.satisfaction_signals.includes("retry_pattern") &&
    c.inferred_satisfaction === "frustrated"
  );
  
  if (multiTurnPatterns.length > 0) {
    patterns.push({
      pattern: "escalating_help_seeking",
      description: "Users engaging in prolonged help-seeking sessions with increasing frustration",
      frequency: multiTurnPatterns.length,
      impact: multiTurnPatterns.length > 20 ? "high" : multiTurnPatterns.length > 10 ? "medium" : "low",
      examples: multiTurnPatterns.slice(0, 3).map(c => ({
        conversationId: c.id,
        snippet: `${c.turns} turns, ${c.satisfaction_signals.join(", ")}`,
        outcome: c.inferred_satisfaction,
      })),
    });
  }
  
  // Pattern 2: Quick abandonment after initial engagement
  const quickAbandonments = conversations.filter(c =>
    c.turns <= 3 &&
    c.satisfaction_signals.includes("abandonment") &&
    c.scores.overall < 50
  );
  
  if (quickAbandonments.length > 0) {
    patterns.push({
      pattern: "immediate_disengagement",
      description: "Users quickly abandoning conversations after minimal interaction",
      frequency: quickAbandonments.length,
      impact: quickAbandonments.length > 30 ? "high" : quickAbandonments.length > 15 ? "medium" : "low",
      examples: quickAbandonments.slice(0, 3).map(c => ({
        conversationId: c.id,
        snippet: `${c.turns} turns, quality ${c.scores.overall}`,
        outcome: c.inferred_satisfaction,
      })),
    });
  }
  
  // Pattern 3: Polite but unsatisfied
  const politeUnsatisfied = conversations.filter(c =>
    c.satisfaction_signals.includes("gratitude") &&
    (c.scores.overall < 60 || c.failure_tags.length > 0)
  );
  
  if (politeUnsatisfied.length > 0) {
    patterns.push({
      pattern: "polite_churn_risk",
      description: "Users expressing gratitude but showing signs of underlying dissatisfaction",
      frequency: politeUnsatisfied.length,
      impact: politeUnsatisfied.length > 25 ? "high" : politeUnsatisfied.length > 12 ? "medium" : "low",
      examples: politeUnsatisfied.slice(0, 3).map(c => ({
        conversationId: c.id,
        snippet: `Grateful but quality ${c.scores.overall}, failures: ${c.failure_tags.map(f => f.type).join(", ")}`,
        outcome: c.inferred_satisfaction,
      })),
    });
  }
  
  // Pattern 4: Context loss spirals
  const contextLossSpirals = conversations.filter(c =>
    c.failure_tags.some(f => f.type === "context_loss") &&
    c.turns > 6 &&
    c.satisfaction_signals.includes("rephrasing")
  );
  
  if (contextLossSpirals.length > 0) {
    patterns.push({
      pattern: "context_degradation_spiral",
      description: "Conversations where context loss leads to user frustration and repeated clarification attempts",
      frequency: contextLossSpirals.length,
      impact: contextLossSpirals.length > 15 ? "high" : contextLossSpirals.length > 8 ? "medium" : "low",
      examples: contextLossSpirals.slice(0, 3).map(c => ({
        conversationId: c.id,
        snippet: `${c.turns} turns, context loss at turn ${c.failure_tags.find(f => f.type === "context_loss")?.turn}`,
        outcome: c.inferred_satisfaction,
      })),
    });
  }
  
  // Pattern 5: High-turn successful sessions (potential power users)
  const powerUserSessions = conversations.filter(c =>
    c.turns > 15 &&
    c.scores.overall > 70 &&
    c.satisfaction_signals.includes("deepening")
  );
  
  if (powerUserSessions.length > 0) {
    patterns.push({
      pattern: "power_user_engagement",
      description: "Extended, high-quality sessions indicating sophisticated user engagement",
      frequency: powerUserSessions.length,
      impact: powerUserSessions.length > 10 ? "high" : powerUserSessions.length > 5 ? "medium" : "low",
      examples: powerUserSessions.slice(0, 3).map(c => ({
        conversationId: c.id,
        snippet: `${c.turns} turns, quality ${c.scores.overall}, user ${c.user_id}`,
        outcome: c.inferred_satisfaction,
      })),
    });
  }
  
  return patterns.sort((a, b) => {
    const impactOrder = { "high": 3, "medium": 2, "low": 1 };
    return impactOrder[b.impact] - impactOrder[a.impact];
  });
}

/**
 * Generates insights about topic evolution and quality changes
 */
export function generateTopicInsights(
  conversations: MockConversation[],
  clusters: TopicCluster[],
  patterns: EmergingPattern[]
): TopicInsight[] {
  const insights: TopicInsight[] = [];
  
  // Insight 1: New topic emergence
  const newTopics = clusters.filter(c => c.emergence.maturity === "emerging");
  if (newTopics.length > 0) {
    insights.push({
      type: "new_topic",
      title: `${newTopics.length} New Conversation Topics Detected`,
      description: `Emerging topics: ${newTopics.map(t => t.label).join(", ")}. Consider adding these as formal intent categories.`,
      severity: newTopics.length > 3 ? "critical" : "warning",
      actionable: true,
      data: { topics: newTopics.map(t => t.label), count: newTopics.length },
    });
  }
  
  // Insight 2: Quality degradation in established topics
  const decliningTopics = clusters.filter(c => 
    c.quality.trend === "declining" && 
    c.emergence.maturity === "established"
  );
  if (decliningTopics.length > 0) {
    insights.push({
      type: "quality_shift",
      title: "Quality Decline in Established Topics",
      description: `Topics showing quality degradation: ${decliningTopics.map(t => `${t.label} (${t.quality.average})`).join(", ")}`,
      severity: "warning",
      actionable: true,
      data: { topics: decliningTopics },
    });
  }
  
  // Insight 3: High-impact patterns
  const highImpactPatterns = patterns.filter(p => p.impact === "high");
  if (highImpactPatterns.length > 0) {
    insights.push({
      type: "pattern_change",
      title: "Critical User Behavior Patterns Detected",
      description: `High-impact patterns: ${highImpactPatterns.map(p => p.pattern).join(", ")}. Immediate attention recommended.`,
      severity: "critical",
      actionable: true,
      data: { patterns: highImpactPatterns },
    });
  }
  
  // Insight 4: Volume spikes in new areas
  const highVolumeNewTopics = clusters.filter(c => 
    c.quality.count > 20 && 
    c.emergence.growth > 50
  );
  if (highVolumeNewTopics.length > 0) {
    insights.push({
      type: "volume_spike",
      title: "Rapid Growth in New Topic Areas",
      description: `Fast-growing topics may need dedicated handling: ${highVolumeNewTopics.map(t => t.label).join(", ")}`,
      severity: "warning",
      actionable: true,
      data: { topics: highVolumeNewTopics },
    });
  }
  
  // Insight 5: Intent classification gaps
  const intentGaps = identifyIntentGaps(conversations, clusters);
  if (intentGaps.length > 0) {
    insights.push({
      type: "new_topic",
      title: "Intent Classification Gaps Detected",
      description: `${intentGaps.length} conversation clusters suggest missing intent categories. Current taxonomy may be incomplete.`,
      severity: "warning",
      actionable: true,
      data: { gaps: intentGaps },
    });
  }
  
  return insights.sort((a, b) => {
    const severityOrder = { "critical": 3, "warning": 2, "info": 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function generateClusterKey(conv: MockConversation): string {
  // Create a simplified clustering key based on conversation characteristics
  const turnBucket = conv.turns <= 3 ? "short" : conv.turns <= 8 ? "medium" : "long";
  const qualityBucket = conv.scores.overall >= 70 ? "high" : conv.scores.overall >= 40 ? "medium" : "low";
  const satisfactionKey = conv.inferred_satisfaction;
  const hasFailures = conv.failure_tags.length > 0 ? "has_failures" : "no_failures";
  
  // Add failure type clustering
  const primaryFailure = conv.failure_tags.length > 0 ? 
    conv.failure_tags[0].type : "no_failure";
  
  return `${turnBucket}_${qualityBucket}_${satisfactionKey}_${hasFailures}_${primaryFailure}`;
}

function calculateClusterQuality(conversations: MockConversation[]) {
  const qualities = conversations.map(c => c.scores.overall);
  const average = Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length);
  
  // Simple trend calculation (could be enhanced with time-series analysis)
  const recentQualities = conversations
    .filter(c => new Date(c.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000)
    .map(c => c.scores.overall);
  
  const olderQualities = conversations
    .filter(c => new Date(c.timestamp).getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000)
    .map(c => c.scores.overall);
  
  let trend: "improving" | "declining" | "stable" = "stable";
  if (recentQualities.length > 0 && olderQualities.length > 0) {
    const recentAvg = recentQualities.reduce((a, b) => a + b, 0) / recentQualities.length;
    const olderAvg = olderQualities.reduce((a, b) => a + b, 0) / olderQualities.length;
    
    if (recentAvg > olderAvg + 5) trend = "improving";
    else if (recentAvg < olderAvg - 5) trend = "declining";
  }
  
  return {
    average,
    trend,
    count: conversations.length,
  };
}

function calculateEmergenceMetrics(conversations: MockConversation[]) {
  const timestamps = conversations.map(c => new Date(c.timestamp).getTime());
  const firstSeen = new Date(Math.min(...timestamps)).toISOString();
  
  // Calculate growth (simplified - in real implementation would use proper time series)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = conversations.filter(c => new Date(c.timestamp).getTime() > weekAgo).length;
  const olderCount = conversations.filter(c => new Date(c.timestamp).getTime() <= weekAgo).length;
  
  const growth = olderCount > 0 ? Math.round(((recentCount / olderCount) - 1) * 100) : 100;
  
  // Determine maturity
  const daysSinceFirst = (Date.now() - Math.min(...timestamps)) / (24 * 60 * 60 * 1000);
  const maturity: "emerging" | "established" | "declining" = 
    daysSinceFirst < 7 ? "emerging" : 
    daysSinceFirst < 30 && conversations.length > 10 ? "established" : 
    "declining";
  
  return {
    firstSeen,
    growth,
    maturity,
  };
}

function generateClusterLabel(conversations: MockConversation[]): string {
  // Generate a descriptive label based on conversation characteristics
  const commonFailures: Record<string, number> = {};
  const commonSignals: Record<string, number> = {};
  
  conversations.forEach(c => {
    c.failure_tags.forEach(f => {
      commonFailures[f.type] = (commonFailures[f.type] || 0) + 1;
    });
    c.satisfaction_signals.forEach(s => {
      commonSignals[s] = (commonSignals[s] || 0) + 1;
    });
  });
  
  const topFailure = Object.entries(commonFailures)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  const topSignal = Object.entries(commonSignals)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];
  
  // Generate descriptive label
  const avgTurns = Math.round(conversations.reduce((sum, c) => sum + c.turns, 0) / conversations.length);
  const avgQuality = Math.round(conversations.reduce((sum, c) => sum + c.scores.overall, 0) / conversations.length);
  
  if (topFailure && (topFailure[1] as number) > conversations.length * 0.4) {
    return `${topFailure[0].replace('_', ' ')} issues (${conversations.length} convos)`;
  }
  
  if (avgTurns > 10) {
    return `Extended sessions (${conversations.length} convos, ${avgTurns} turns avg)`;
  }
  
  if (avgQuality < 40) {
    return `Low quality cluster (${conversations.length} convos, ${avgQuality} quality)`;
  }
  
  if (topSignal && topSignal[0] === "abandonment") {
    return `Abandonment pattern (${conversations.length} convos)`;
  }
  
  return `Unclassified pattern (${conversations.length} conversations)`;
}

function extractKeywords(conversations: MockConversation[]): string[] {
  // In a real implementation, this would analyze actual conversation content
  // For now, return keywords based on conversation metadata
  const keywords = new Set<string>();
  
  conversations.forEach(c => {
    // Add intent as keyword
    keywords.add(c.intent);
    
    // Add failure types as keywords
    c.failure_tags.forEach(f => keywords.add(f.type));
    
    // Add satisfaction signals as keywords
    c.satisfaction_signals.forEach(s => keywords.add(s));
    
    // Add quality/turn descriptors
    if (c.scores.overall < 40) keywords.add("low_quality");
    if (c.turns > 10) keywords.add("extended_session");
    if (c.inferred_satisfaction === "frustrated") keywords.add("frustrated_user");
  });
  
  return Array.from(keywords).slice(0, 10); // Limit to top 10
}

function generateSuggestedIntent(conversations: MockConversation[]): string {
  const label = generateClusterLabel(conversations);
  
  // Convert cluster label to suggested intent name
  return label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function identifyIntentGaps(conversations: MockConversation[], clusters: TopicCluster[]): string[] {
  // Identify clusters that represent potential missing intent categories
  return clusters
    .filter(c => c.quality.count > 10 && c.emergence.maturity === "emerging")
    .map(c => c.suggestedIntent);
}

// ─── API Integration ───────────────────────────────────────────────────────────

/**
 * Main function to run complete dynamic topic discovery analysis
 */
export function runTopicDiscoveryAnalysis(
  conversations: MockConversation[],
  knownIntents: string[]
) {
  const clusters = identifyUnclassifiedPatterns(conversations, knownIntents);
  const patterns = detectEmergingPatterns(conversations);
  const insights = generateTopicInsights(conversations, clusters, patterns);
  
  return {
    clusters,
    patterns,
    insights,
    summary: {
      totalConversations: conversations.length,
      clustersFound: clusters.length,
      patternsDetected: patterns.length,
      criticalInsights: insights.filter(i => i.severity === "critical").length,
      emergingTopics: clusters.filter(c => c.emergence.maturity === "emerging").length,
    },
  };
}

// ─── Export for API Route ─────────────────────────────────────────────────────

export default runTopicDiscoveryAnalysis;