// ─── OVERVIEW API IMPROVEMENTS ────────────────────────────────────────────
// Location: /Users/linda/convometrics/dashboard/src/app/api/overview/route.ts
// Fix timestamp bugs and improve performance

// PROBLEM 1: Timestamp sorting without error handling (line ~169)
// Current code:
/*
  const recentAnalyzed = [...analyzed]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
*/

// IMPROVED VERSION:
const recentAnalyzed = [...analyzed]
  .sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    
    const timeA = dateA.getTime();
    const timeB = dateB.getTime();
    
    // Handle invalid dates
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;  // Invalid dates to end
    if (isNaN(timeB)) return -1; // Valid dates first
    
    return timeB - timeA; // Newest first
  })
  .slice(0, 10)
  .map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.id,
      intent: r.intent,
      quality_score: r.quality_score,
      completion_status: r.completion_status,
      created_at: r.created_at,
      platform: (meta?.platform as string) ?? "unknown",
    };
  });

// PROBLEM 2: Inefficient date range calculation
// Current code repeatedly calls new Date() and getTime()

// IMPROVED VERSION with caching:
const getDateRange = (rows: any[]) => {
  if (!rows.length) return { start: 'Unknown', end: 'Unknown' };
  
  let minTime = Infinity;
  let maxTime = -Infinity;
  
  for (const row of rows) {
    if (!row.timestamp) continue;
    const time = new Date(row.timestamp).getTime();
    if (isNaN(time)) continue;
    
    if (time < minTime) minTime = time;
    if (time > maxTime) maxTime = time;
  }
  
  if (!isFinite(minTime) || !isFinite(maxTime)) {
    return { start: 'Unknown', end: 'Unknown' };
  }
  
  const formatDate = (time: number) => 
    new Date(time).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric", 
      year: "numeric",
    });
  
  return {
    start: formatDate(minTime),
    end: formatDate(maxTime),
  };
};

// PROBLEM 3: Health score calculation is too simplistic
// Current: (avgQuality/100) × completionRate × (1 - failureRate)
// This makes quality dominate too much

// IMPROVED VERSION with balanced weights:
const calculateHealthScore = (
  avgQuality: number | null,
  completionRate: number | null, 
  failureRate: number | null
): number | null => {
  if (avgQuality === null || completionRate === null || failureRate === null) {
    return null;
  }
  
  // Normalize all metrics to 0-1 scale
  const quality = Math.max(0, Math.min(100, avgQuality)) / 100;
  const completion = Math.max(0, Math.min(1, completionRate));
  const reliability = Math.max(0, Math.min(1, 1 - failureRate));
  
  // Weighted score: Quality 40%, Completion 35%, Reliability 25%
  const score = (quality * 0.4) + (completion * 0.35) + (reliability * 0.25);
  
  return Math.round(score * 100);
};

// PROBLEM 4: No error handling for malformed data
// Add data validation wrapper:

export const safeOverviewCalculation = (analyzed: any[]) => {
  try {
    // Filter out invalid entries
    const validAnalyzed = analyzed.filter(row => 
      row &&
      typeof row.id === 'string' &&
      row.id.trim() &&
      (row.quality_score === null || typeof row.quality_score === 'number') &&
      (row.completion_status === null || typeof row.completion_status === 'string') &&
      row.created_at
    );
    
    if (validAnalyzed.length === 0) {
      return getEmptyOverviewResult();
    }
    
    // Continue with calculations using validAnalyzed...
    return calculateOverviewStats(validAnalyzed);
    
  } catch (error) {
    console.error('Overview calculation error:', error);
    return getEmptyOverviewResult();
  }
};

const getEmptyOverviewResult = () => ({
  stats: {
    total: 0,
    analyzed: 0,
    avgQuality: null,
    completionRate: null,
    failureRate: null,
    avgTurns: null,
    totalMessages: 0,
    topTopic: null,
  },
  healthScore: null,
  byPlatform: [],
  turnDistribution: [],
  avgTurnsByPlatform: [],
  qualityDistribution: [],
  statusBreakdown: [],
  topPerformingTopics: [],
  worstPerformingTopics: [],
  recentAnalyzed: [],
});

// PROBLEM 5: Magic numbers and hardcoded limits
// Replace hardcoded values with constants:

const OVERVIEW_CONSTANTS = {
  MAX_SAMPLE_SIZE: 200000,
  MAX_ANALYZED_SIZE: 100000,
  TOP_TOPICS_COUNT: 3,
  RECENT_ITEMS_COUNT: 10,
  MIN_CONVERSATIONS_FOR_INSIGHTS: 5,
  PLATFORMS: ["chatgpt", "claude", "gemini", "grok", "perplexity"] as const,
  TURN_BUCKETS: {
    "1": { min: 1, max: 1 },
    "2-3": { min: 2, max: 3 },
    "4-6": { min: 4, max: 6 },
    "7-10": { min: 7, max: 10 },
    "10+": { min: 11, max: Infinity },
  },
  QUALITY_BUCKETS: {
    "0–20": { min: 0, max: 20 },
    "21–40": { min: 21, max: 40 },
    "41–60": { min: 41, max: 60 },
    "61–80": { min: 61, max: 80 },
    "81–100": { min: 81, max: 100 },
  },
} as const;

// PROBLEM 6: Inconsistent rounding
// Create consistent rounding helper:

const roundMetric = (value: number, precision: number = 1): number => {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
};

// Usage:
// const completionRate = roundMetric((completedCount / analyzed.length) * 100, 1);
// const avgQuality = roundMetric(qualitySum / qualityCount, 0);

// PERFORMANCE IMPROVEMENT: Batch processing for large datasets
const processBatches = <T, R>(
  items: T[], 
  processor: (batch: T[]) => R[], 
  batchSize: number = 1000
): R[] => {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...processor(batch));
  }
  
  return results;
};