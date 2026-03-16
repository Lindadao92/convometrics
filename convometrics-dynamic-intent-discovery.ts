/**
 * Dynamic Intent Discovery
 * 
 * Replaces hardcoded intent categories with dynamic topic clustering
 * based on actual conversation patterns.
 */

export interface ConversationSample {
  id: string;
  firstMessage: string;
  messages: Array<{ role: string; content: string }>;
  outcome?: 'success' | 'failure' | 'abandoned';
  qualityScore?: number;
}

export interface DiscoveredIntent {
  key: string;
  label: string;
  description: string;
  keywords: string[];
  exampleMessages: string[];
  avgQualityScore: number;
  successRate: number;
  conversationCount: number;
  emergingTrend?: boolean; // new pattern in recent data
}

interface ClusteringConfig {
  minClusterSize: number;
  maxClusters: number;
  keywordThreshold: number;
  emergingTrendDays: number;
}

const DEFAULT_CONFIG: ClusteringConfig = {
  minClusterSize: 10, // minimum conversations to form a cluster
  maxClusters: 25,    // maximum intents to discover
  keywordThreshold: 0.3, // minimum keyword frequency
  emergingTrendDays: 7,   // days to consider for emerging trends
};

/**
 * Extract keywords from conversation content using simple TF-IDF approximation
 */
function extractKeywords(text: string, corpus: string[]): string[] {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)
    .filter(word => !STOP_WORDS.includes(word));

  // Simple TF calculation
  const wordCount = words.length;
  const termFreq = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Simple IDF approximation
  const keywords = Object.entries(termFreq)
    .map(([word, freq]) => ({
      word,
      score: (freq / wordCount) * Math.log(corpus.length / (corpus.filter(doc => doc.includes(word)).length + 1))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(item => item.word);

  return keywords;
}

/**
 * Cluster conversations by similarity in first messages and keywords
 */
function clusterConversations(conversations: ConversationSample[], config: ClusteringConfig): ConversationSample[][] {
  // Simple clustering based on keyword overlap
  // In production, would use more sophisticated methods like embeddings + k-means
  
  const clusters: ConversationSample[][] = [];
  const processed = new Set<string>();

  for (const conv of conversations) {
    if (processed.has(conv.id)) continue;

    const convKeywords = extractKeywords(conv.firstMessage, conversations.map(c => c.firstMessage));
    const cluster = [conv];
    processed.add(conv.id);

    // Find similar conversations
    for (const other of conversations) {
      if (processed.has(other.id)) continue;

      const otherKeywords = extractKeywords(other.firstMessage, conversations.map(c => c.firstMessage));
      const overlap = convKeywords.filter(kw => otherKeywords.includes(kw)).length;
      const similarity = overlap / Math.max(convKeywords.length, otherKeywords.length);

      if (similarity > config.keywordThreshold) {
        cluster.push(other);
        processed.add(other.id);
      }
    }

    if (cluster.length >= config.minClusterSize) {
      clusters.push(cluster);
    }

    if (clusters.length >= config.maxClusters) break;
  }

  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Generate intent metadata from a cluster of conversations
 */
function generateIntentFromCluster(cluster: ConversationSample[], isEmerging: boolean): DiscoveredIntent {
  const allMessages = cluster.map(c => c.firstMessage).join(' ');
  const keywords = extractKeywords(allMessages, cluster.map(c => c.firstMessage));
  
  // Generate label from most common keywords
  const label = keywords.slice(0, 2).join('_').replace(/\s+/g, '_');
  
  // Calculate success metrics
  const withOutcome = cluster.filter(c => c.outcome);
  const successRate = withOutcome.length > 0 
    ? withOutcome.filter(c => c.outcome === 'success').length / withOutcome.length 
    : 0.5;

  const withQuality = cluster.filter(c => c.qualityScore !== undefined);
  const avgQualityScore = withQuality.length > 0
    ? withQuality.reduce((sum, c) => sum + (c.qualityScore || 0), 0) / withQuality.length
    : 50;

  return {
    key: `discovered_${label}`,
    label: formatLabel(label),
    description: generateDescription(keywords, cluster),
    keywords: keywords.slice(0, 5),
    exampleMessages: cluster.slice(0, 3).map(c => c.firstMessage),
    avgQualityScore,
    successRate,
    conversationCount: cluster.length,
    emergingTrend: isEmerging,
  };
}

/**
 * Generate human-readable description from keywords and conversation samples
 */
function generateDescription(keywords: string[], cluster: ConversationSample[]): string {
  const topKeywords = keywords.slice(0, 3).join(', ');
  const conversationCount = cluster.length;
  
  return `Conversations focused on ${topKeywords}. Pattern discovered from ${conversationCount} similar conversations.`;
}

/**
 * Format cluster label into human-readable format
 */
function formatLabel(label: string): string {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' & ');
}

/**
 * Detect emerging trends by comparing recent vs historical conversation patterns
 */
function detectEmergingTrends(
  recentConversations: ConversationSample[], 
  historicalConversations: ConversationSample[],
  config: ClusteringConfig
): string[] {
  const recentClusters = clusterConversations(recentConversations, config);
  const historicalClusters = clusterConversations(historicalConversations, config);
  
  const historicalPatterns = new Set(
    historicalClusters.map(cluster => 
      extractKeywords(
        cluster.map(c => c.firstMessage).join(' '), 
        historicalConversations.map(c => c.firstMessage)
      ).slice(0, 2).join('_')
    )
  );

  return recentClusters
    .map(cluster => 
      extractKeywords(
        cluster.map(c => c.firstMessage).join(' '), 
        recentConversations.map(c => c.firstMessage)
      ).slice(0, 2).join('_')
    )
    .filter(pattern => !historicalPatterns.has(pattern));
}

/**
 * Main function: Discover intents from conversation data
 */
export function discoverIntents(
  conversations: ConversationSample[],
  config: Partial<ClusteringConfig> = {}
): DiscoveredIntent[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Split recent vs historical for emerging trend detection
  const cutoffDate = Date.now() - (finalConfig.emergingTrendDays * 24 * 60 * 60 * 1000);
  const recentConversations = conversations.filter(c => 
    new Date(c.id).getTime() > cutoffDate // assuming ID contains timestamp
  );
  const historicalConversations = conversations.filter(c => 
    new Date(c.id).getTime() <= cutoffDate
  );

  // Detect emerging trends
  const emergingPatterns = detectEmergingTrends(recentConversations, historicalConversations, finalConfig);
  
  // Cluster all conversations
  const clusters = clusterConversations(conversations, finalConfig);
  
  // Generate intents from clusters
  return clusters.map(cluster => {
    const pattern = extractKeywords(
      cluster.map(c => c.firstMessage).join(' '), 
      conversations.map(c => c.firstMessage)
    ).slice(0, 2).join('_');
    
    const isEmerging = emergingPatterns.includes(pattern);
    return generateIntentFromCluster(cluster, isEmerging);
  });
}

/**
 * Common English stop words to filter out
 */
const STOP_WORDS = [
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 
  'out', 'day', 'get', 'use', 'man', 'new', 'now', 'way', 'may', 'say', 'each', 'which', 'she',
  'how', 'its', 'two', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think',
  'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now',
  'made', 'before', 'here', 'through', 'when', 'where', 'much', 'take', 'than', 'only', 'come',
  'could', 'them'
];