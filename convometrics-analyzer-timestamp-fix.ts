// ─── TIMESTAMP FIX FOR ANALYZER.TS ────────────────────────────────────
// This patch improves timestamp handling in the conversation analyzer
// Location: /Users/linda/convometrics/dashboard/src/lib/analyzer.ts
// Lines: 688-692

// PROBLEM: Timestamp sorting fails when dates are invalid, breaking conversation analysis
// SOLUTION: Add graceful error handling for invalid dates

// REPLACE LINE 688-692 IN analyzer.ts WITH:
/*
    // Sort by timestamp if available - handle invalid dates gracefully
    if (msgs[0]?.timestamp) {
      msgs.sort((a, b) => {
        const dateA = new Date(a.timestamp!);
        const dateB = new Date(b.timestamp!);
        
        const timeA = dateA.getTime();
        const timeB = dateB.getTime();
        
        // Handle invalid dates gracefully
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1;  // Invalid dates go to end
        if (isNaN(timeB)) return -1; // Valid dates come first
        
        return timeA - timeB;
      });
    }
*/

// ADDITIONAL IMPROVEMENTS FOR PERFORMANCE:

// 1. Add date validation helper
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.getTime() > 0;
}

// 2. Pre-filter invalid timestamps
function preprocessMessages(msgs: { timestamp?: string }[]) {
  return msgs.filter(msg => !msg.timestamp || isValidTimestamp(msg.timestamp));
}

// 3. Add fallback sorting by message order
function sortWithFallback(msgs: any[]) {
  if (!msgs[0]?.timestamp) return msgs;
  
  return msgs.sort((a, b) => {
    // Try timestamp first
    const timestampA = a.timestamp;
    const timestampB = b.timestamp;
    
    if (timestampA && timestampB) {
      const dateA = new Date(timestampA);
      const dateB = new Date(timestampB);
      
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();
      
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB;
      }
    }
    
    // Fallback to array index order if timestamps fail
    return 0;
  });
}

// HEALTH SCORE IMPROVEMENT:
// Current health score calculation could be improved by adding weights
function improvedHealthScore(
  avgQuality: number | null,
  completionRate: number | null,
  failureRate: number | null
): number | null {
  if (avgQuality === null || completionRate === null || failureRate === null) {
    return null;
  }
  
  // Weighted calculation (quality 50%, completion 30%, failure prevention 20%)
  const qualityComponent = (avgQuality / 100) * 0.5;
  const completionComponent = completionRate * 0.3;
  const failurePreventionComponent = (1 - failureRate) * 0.2;
  
  return Math.round((qualityComponent + completionComponent + failurePreventionComponent) * 100);
}

// ERROR BOUNDARY FOR ANALYZER:
export function safeAnalyzeConversations(rows: any[]) {
  try {
    // Pre-validate data
    if (!Array.isArray(rows) || rows.length === 0) {
      return getEmptyAnalysisResult();
    }
    
    // Filter out malformed rows
    const validRows = rows.filter(row => 
      row && 
      typeof row.conversation_id === 'string' && 
      row.conversation_id.trim() &&
      typeof row.message === 'string' &&
      row.message.trim()
    );
    
    if (validRows.length === 0) {
      return getEmptyAnalysisResult();
    }
    
    // Continue with normal analysis...
    // return analyzeConversations(validRows);
    
  } catch (error) {
    console.error('Analyzer error:', error);
    return getEmptyAnalysisResult();
  }
}

function getEmptyAnalysisResult() {
  return {
    summary: {
      totalConversations: 0,
      totalMessages: 0,
      reportedResolutionRate: 0,
      actualResolutionRate: 0,
      falsePosCount: 0,
      dateRange: { start: 'No data', end: 'No data' },
    },
    intents: [],
    patterns: [],
    actions: [],
    conversations: [],
    sentimentTrajectory: { worsened: 0, improved: 0, stable: 0 },
    resolutionBreakdown: {},
    channelBreakdown: [],
    productBreakdown: [],
    planTierBreakdown: [],
    churnRisk: { total: 0, cancellationSaveRate: 0, complaintResolutionRate: 0, refundResolutionRate: 0 },
    falsePositiveRate: 0,
    aiFailurePatterns: [],
    duplicateResponseCount: 0,
    revenueRisk: { highValueCustomers: 0, highValueBadOutcomeRate: 0 },
  };
}