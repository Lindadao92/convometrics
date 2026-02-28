// ─── IRL AI — Conversation Analyzer ─────────────────────────────────────────
// Client-side keyword/heuristic analysis engine. No external AI APIs.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RawMessage {
  conversation_id: string;
  role: string;
  message: string;
  timestamp?: string;
}

export interface ClassifiedConversation {
  id: string;
  intent: string;
  intentDisplayName: string;
  outcome: "success" | "failed" | "abandoned" | "escalated";
  patterns: string[];
  messageCount: number;
  messages: { role: "user" | "ai"; text: string }[];
}

export interface IntentBreakdown {
  label: string;
  percentage: number;
}

export interface IntentResult {
  name: string;
  displayName: string;
  sessions: number;
  successRate: number;
  severity: "critical" | "warning" | "good" | "info";
  failureBreakdown: IntentBreakdown[];
  exampleConversation: ClassifiedConversation | null;
}

export interface PatternResult {
  name: string;
  label: string;
  count: number;
  description: string;
  examples: ClassifiedConversation[];
}

export interface ActionResult {
  title: string;
  intent: string;
  effort: "low" | "medium" | "high";
  impact: string;
  why: string;
}

export interface BriefingData {
  summary: {
    totalConversations: number;
    totalMessages: number;
    reportedResolutionRate: number;
    actualResolutionRate: number;
    falsePosCount: number;
    dateRange: { start: string; end: string };
  };
  intents: IntentResult[];
  patterns: PatternResult[];
  actions: ActionResult[];
  conversations: ClassifiedConversation[];
}

// ─── Claude API response types ──────────────────────────────────────────────

export interface ClaudeExampleConversation {
  id: string;
  messages: { role: string; message: string }[];
  annotation: string;
}

export interface ClaudeIntentResult {
  name: string;
  displayName: string;
  sessions: number;
  successRate: number;
  severity: "critical" | "warning" | "performing";
  rootCause: string;
  failureBreakdown: { label: string; percentage: number; description?: string }[];
  exampleConversation: ClaudeExampleConversation | null;
  downstreamImpact: string;
}

export interface ClaudePatternExample {
  conversationId: string;
  lastUserMessage: string;
  reportedStatus: string;
  actualStatus: string;
}

export interface ClaudePatternResult {
  name: string;
  label: string;
  emoji: string;
  count: number;
  severity: "critical" | "warning" | "info";
  description: string;
  insight: string;
  examples: ClaudePatternExample[];
}

export interface ClaudeActionResult {
  priority: "high" | "medium" | "low";
  title: string;
  intent: string;
  effort: "low" | "medium" | "high";
  impact: string;
  why: string;
}

export interface ClaudeConversationResult {
  id: string;
  intent: string;
  outcome: "success" | "failed" | "abandoned" | "escalated";
  patterns: string[];
  messageCount: number;
  summary: string;
}

export interface AnalysisResponse {
  summary: {
    totalConversations: number;
    totalMessages: number;
    reportedResolutionRate: number;
    actualResolutionRate: number;
    gapExplanation: string;
    dateRange: { start: string; end: string };
  };
  realityCheck: {
    reported: {
      resolutionRate: number;
      resolutionRateLabel: string;
      conversationsHandled: number;
      conversationsHandledLabel: string;
      avgMessagesPerConversation: number;
      avgMessagesLabel: string;
    };
    actual: {
      resolutionRate: number;
      resolutionRateExplanation: string;
      avgMessagesToResolution: number;
      avgMessagesToResolutionExplanation: string;
      avgMessagesInFailed: number;
      avgMessagesInFailedExplanation: string;
    };
  };
  intents: ClaudeIntentResult[];
  patterns: ClaudePatternResult[];
  actions: ClaudeActionResult[];
  conversations: ClaudeConversationResult[];
}

// ─── Intent classification ──────────────────────────────────────────────────

const INTENT_DISPLAY_NAMES: Record<string, string> = {
  plan_upgrade_with_conditions: "Plan Upgrade (Conditional)",
  cancel_with_retention_offer: "Cancellation",
  account_access_recovery: "Account Access Recovery",
  order_status_check: "Order Status Check",
  password_reset: "Password Reset",
  billing_inquiry: "Billing Inquiry",
  integration_setup: "Integration Setup",
  feature_request: "Feature Request",
  pricing_question: "Pricing Question",
  data_export: "Data Export",
  permissions_management: "Permissions Management",
  general_inquiry: "General Inquiry",
};

function classifyIntent(userMessages: string[]): string {
  const allText = userMessages.join(" ").toLowerCase();

  if (
    (allText.includes("upgrade") ||
      allText.includes("switch plan") ||
      allText.includes("change plan")) &&
    (allText.includes("if") ||
      allText.includes("do i keep") ||
      allText.includes("carry over") ||
      allText.includes("credit") ||
      allText.includes("prorate") ||
      allText.includes("unused") ||
      allText.includes("grandfathered") ||
      allText.includes("trial") ||
      allText.includes("existing"))
  )
    return "plan_upgrade_with_conditions";

  if (
    allText.includes("cancel") ||
    allText.includes("cancellation") ||
    allText.includes("end my subscription")
  )
    return "cancel_with_retention_offer";

  if (
    allText.includes("can't log in") ||
    allText.includes("locked out") ||
    allText.includes("can't access") ||
    allText.includes("lost access") ||
    allText.includes("2fa") ||
    allText.includes("account recovery")
  )
    return "account_access_recovery";

  if (
    allText.includes("order") &&
    (allText.includes("status") ||
      allText.includes("where") ||
      allText.includes("track"))
  )
    return "order_status_check";

  if (
    allText.includes("password") &&
    (allText.includes("reset") ||
      allText.includes("forgot") ||
      allText.includes("change") ||
      allText.includes("expired"))
  )
    return "password_reset";

  if (
    allText.includes("charged") ||
    allText.includes("billing") ||
    allText.includes("invoice") ||
    allText.includes("refund") ||
    allText.includes("dispute")
  )
    return "billing_inquiry";

  if (
    allText.includes("integrat") ||
    allText.includes("connect") ||
    allText.includes("slack") ||
    allText.includes("jira") ||
    allText.includes("github") ||
    allText.includes("google sheets")
  )
    return "integration_setup";

  if (
    allText.includes("feature") ||
    allText.includes("can you add") ||
    allText.includes("request") ||
    allText.includes("is there a way")
  )
    return "feature_request";

  if (
    allText.includes("price") ||
    allText.includes("pricing") ||
    allText.includes("cost") ||
    allText.includes("how much") ||
    (allText.includes("plan") && allText.includes("difference"))
  )
    return "pricing_question";

  if (
    allText.includes("export") ||
    allText.includes("download") ||
    allText.includes("data")
  )
    return "data_export";

  if (
    allText.includes("permission") ||
    allText.includes("role") ||
    allText.includes("access")
  )
    return "permissions_management";

  return "general_inquiry";
}

// ─── Outcome classification ─────────────────────────────────────────────────

const FRUSTRATION_PHRASES = [
  "that's not what i asked",
  "you're not listening",
  "this is ridiculous",
  "going nowhere",
  "forget it",
  "this is your support team",
  "thanks for nothing",
  "not answering my question",
  "just cancel",
  "doesn't answer my question",
  "already told you",
  "i already said",
  "you already asked me",
  "are you even reading",
  "useless",
];

const POLITE_ENDINGS = [
  "ok thanks",
  "fine thanks",
  "ok whatever",
  "that's fine",
  "ok i'll try",
  "ok will do",
  "ok no worries",
  "ok i'll figure it out",
  "ok i'll email them",
  "ok i'll look at the website",
  "alright thanks",
  "ok i guess",
  "sure thanks",
  "i'll just",
];

const SUCCESS_PHRASES = [
  "perfect",
  "awesome",
  "great thanks",
  "worked",
  "that's exactly",
  "got it thanks",
  "thanks for the quick",
  "that's what i needed",
  "done thanks",
  "this changes everything",
  "all set",
  "enabling now",
  "signing up",
  "connected now",
  "that helps",
  "wonderful",
  "brilliant",
  "that did it",
  "problem solved",
  "exactly what i needed",
];

function classifyOutcome(
  messages: { role: string; text: string }[]
): "success" | "failed" | "abandoned" | "escalated" {
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return "abandoned";

  const lastUserMsg = userMsgs[userMsgs.length - 1].text.toLowerCase();
  const allUserText = userMsgs.map((m) => m.text).join(" ").toLowerCase();

  // Escalation
  if (
    allUserText.includes("talk to someone") ||
    allUserText.includes("talk to a person") ||
    allUserText.includes("speak to a human") ||
    allUserText.includes("can i talk to") ||
    allUserText.includes("real person") ||
    allUserText.includes("human agent")
  )
    return "escalated";

  // Frustration
  const hasFrustration = FRUSTRATION_PHRASES.some((p) =>
    allUserText.includes(p)
  );

  // Success
  const isSuccess = SUCCESS_PHRASES.some((p) => lastUserMsg.includes(p));

  // Polite disengagement
  const isPoliteEnding =
    POLITE_ENDINGS.some((p) => lastUserMsg.includes(p)) ||
    (lastUserMsg.length < 30 && lastUserMsg.includes("thanks"));

  if (isSuccess && messages.length <= 6) return "success";
  if (isSuccess) return "success";
  if (hasFrustration) return "failed";
  if (isPoliteEnding && messages.length > 4) return "abandoned";
  if (isPoliteEnding && messages.length <= 4) return "success";
  if (messages.length > 8) return "failed";

  return "success";
}

// ─── Pattern detection ──────────────────────────────────────────────────────

function detectPatterns(
  messages: { role: string; text: string }[],
  outcome: string
): string[] {
  const patterns: string[] = [];
  const userMsgs = messages.filter((m) => m.role === "user");
  if (userMsgs.length === 0) return patterns;

  const lastUserMsg = userMsgs[userMsgs.length - 1].text.toLowerCase();

  // Polite Churner
  if (
    (outcome === "failed" || outcome === "abandoned") &&
    POLITE_ENDINGS.some((p) => lastUserMsg.includes(p))
  ) {
    patterns.push("polite_churner");
  }

  // Exhaustion Loop: 3+ user messages, non-success, messages getting shorter
  if (userMsgs.length >= 3 && outcome !== "success") {
    const msgLengths = userMsgs.map((m) => m.text.length);
    if (msgLengths[msgLengths.length - 1] < msgLengths[0] * 0.5) {
      patterns.push("exhaustion_loop");
    }
  }

  // Frustration signals
  const frustrationRegexes = [
    /[A-Z]{4,}/,
    /\?{2,}/,
    /!{2,}/,
    /that's not what i asked/i,
    /you're not listening/i,
    /this is ridiculous/i,
    /forget it/i,
  ];
  if (
    frustrationRegexes.some((rx) => userMsgs.some((m) => rx.test(m.text)))
  ) {
    patterns.push("frustration_signal");
  }

  return patterns;
}

// ─── Failure breakdown generation ───────────────────────────────────────────

function computeFailureBreakdown(
  convos: ClassifiedConversation[]
): IntentBreakdown[] {
  const total = convos.length;
  if (total === 0)
    return [{ label: "No conversations", percentage: 100 }];

  const successCount = convos.filter((c) => c.outcome === "success").length;
  const failedCount = convos.filter((c) => c.outcome === "failed").length;
  const abandonedCount = convos.filter(
    (c) => c.outcome === "abandoned"
  ).length;
  const escalatedCount = convos.filter(
    (c) => c.outcome === "escalated"
  ).length;

  const breakdown: IntentBreakdown[] = [];

  if (failedCount > 0)
    breakdown.push({
      label: "Answered wrong question or gave wrong info",
      percentage: Math.round((failedCount / total) * 100),
    });
  if (abandonedCount > 0)
    breakdown.push({
      label: "User disengaged without resolution",
      percentage: Math.round((abandonedCount / total) * 100),
    });
  if (escalatedCount > 0)
    breakdown.push({
      label: "Escalated to human agent",
      percentage: Math.round((escalatedCount / total) * 100),
    });
  if (successCount > 0)
    breakdown.push({
      label: "Successfully resolved",
      percentage: Math.round((successCount / total) * 100),
    });

  // Ensure percentages sum to ~100
  const sum = breakdown.reduce((s, b) => s + b.percentage, 0);
  if (breakdown.length > 0 && sum !== 100) {
    breakdown[0].percentage += 100 - sum;
  }

  return breakdown;
}

// ─── Action generation ──────────────────────────────────────────────────────

const ACTION_TITLES: Record<string, string> = {
  plan_upgrade_with_conditions:
    "Add conditional billing logic to upgrade flow",
  account_access_recovery:
    "Add alternative identity verification for locked-out users",
  cancel_with_retention_offer:
    "Enable retention offer Q&A and acceptance processing",
  billing_inquiry:
    "Improve billing dispute handling with transaction lookup",
  integration_setup:
    "Add troubleshooting steps for common integration errors",
  permissions_management: "Implement granular permission controls",
  data_export: "Improve data export documentation and flow",
  order_status_check: "Add real-time order tracking integration",
  password_reset: "Streamline password reset with inline verification",
  pricing_question: "Add comparison table and plan recommendation logic",
  feature_request: "Route feature requests to product feedback system",
  general_inquiry: "Improve general knowledge base coverage",
};

const ACTION_REASONS: Record<string, string> = {
  plan_upgrade_with_conditions:
    "users ask conditional questions the AI can't answer",
  account_access_recovery:
    "users get stuck in verification loops",
  cancel_with_retention_offer:
    "retention offers aren't being presented effectively",
  billing_inquiry: "billing questions need real account data the AI lacks",
  integration_setup: "error-specific troubleshooting is missing",
  permissions_management: "permission changes require admin escalation",
  data_export: "export options aren't clearly documented",
  order_status_check: "AI can't access real-time order data",
  password_reset: "reset flow has too many steps",
  pricing_question: "plan comparisons lack specificity",
  feature_request: "no way to capture and acknowledge requests",
  general_inquiry: "broad questions get generic responses",
};

function generateActions(intents: IntentResult[]): ActionResult[] {
  return intents
    .filter((i) => i.successRate < 0.4 && i.sessions > 3)
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 3)
    .map((intent) => ({
      title:
        ACTION_TITLES[intent.name] ||
        `Improve handling for ${intent.name.replace(/_/g, " ")}`,
      intent: intent.displayName,
      effort: intent.successRate < 0.2 ? ("medium" as const) : ("low" as const),
      impact: `~${Math.round(intent.sessions * (1 - intent.successRate))} failures addressable`,
      why: `${intent.sessions} sessions at ${Math.round(intent.successRate * 100)}% success \u2014 ${ACTION_REASONS[intent.name] || "needs improvement"}`,
    }));
}

// ─── Main analyzer ──────────────────────────────────────────────────────────

export function analyzeConversations(rows: RawMessage[]): BriefingData {
  // 1. Group by conversation_id
  const grouped = new Map<string, RawMessage[]>();
  for (const row of rows) {
    if (!row.conversation_id || !row.message) continue;
    const id = row.conversation_id.trim();
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push(row);
  }

  // 2. Classify each conversation
  const classified: ClassifiedConversation[] = [];

  for (const [id, msgs] of grouped) {
    // Sort by timestamp if available
    if (msgs[0]?.timestamp) {
      msgs.sort(
        (a, b) =>
          new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()
      );
    }

    const normalized = msgs.map((m) => ({
      role: (m.role.toLowerCase().includes("user") ? "user" : "ai") as
        | "user"
        | "ai",
      text: m.message.trim(),
    }));

    const userMessages = normalized
      .filter((m) => m.role === "user")
      .map((m) => m.text);

    if (userMessages.length === 0) continue;

    const intent = classifyIntent(userMessages);
    const outcome = classifyOutcome(normalized);
    const patterns = detectPatterns(normalized, outcome);

    classified.push({
      id,
      intent,
      intentDisplayName:
        INTENT_DISPLAY_NAMES[intent] || intent.replace(/_/g, " "),
      outcome,
      patterns,
      messageCount: normalized.length,
      messages: normalized,
    });
  }

  // 3. Build intent results
  const intentMap = new Map<string, ClassifiedConversation[]>();
  for (const c of classified) {
    if (!intentMap.has(c.intent)) intentMap.set(c.intent, []);
    intentMap.get(c.intent)!.push(c);
  }

  const intents: IntentResult[] = Array.from(intentMap.entries())
    .map(([name, convos]) => {
      const sessions = convos.length;
      const successCount = convos.filter(
        (c) => c.outcome === "success"
      ).length;
      const successRate = sessions > 0 ? successCount / sessions : 0;

      let severity: IntentResult["severity"] = "good";
      if (successRate < 0.3 && sessions > 3) severity = "critical";
      else if (successRate < 0.6 && sessions > 3) severity = "warning";
      else if (sessions <= 3) severity = "info";

      // Pick a failed conversation as example
      const example =
        convos.find((c) => c.outcome === "failed") ||
        convos.find((c) => c.outcome === "abandoned") ||
        convos[0] ||
        null;

      return {
        name,
        displayName:
          INTENT_DISPLAY_NAMES[name] || name.replace(/_/g, " "),
        sessions,
        successRate,
        severity,
        failureBreakdown: computeFailureBreakdown(convos),
        exampleConversation: example,
      };
    })
    .sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, good: 2, info: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity])
        return severityOrder[a.severity] - severityOrder[b.severity];
      return b.sessions - a.sessions;
    });

  // 4. Build pattern results
  const patternCounts = new Map<string, ClassifiedConversation[]>();
  for (const c of classified) {
    for (const p of c.patterns) {
      if (!patternCounts.has(p)) patternCounts.set(p, []);
      patternCounts.get(p)!.push(c);
    }
  }

  const PATTERN_META: Record<
    string,
    { label: string; description: string }
  > = {
    polite_churner: {
      label: "The Polite Churner",
      description:
        "Users ended failed conversations with polite language, masking unresolved issues. These look like successes in your dashboard but the user left without answers.",
    },
    exhaustion_loop: {
      label: "The Exhaustion Loop",
      description:
        "Users rephrased their question multiple times as the AI kept missing the point. Messages got shorter as patience wore out.",
    },
    frustration_signal: {
      label: "Frustration Signals",
      description:
        "Conversations with explicit frustration markers: ALL CAPS, repeated punctuation, or direct complaints about the AI not understanding.",
    },
  };

  const patterns: PatternResult[] = Array.from(patternCounts.entries())
    .map(([name, convos]) => ({
      name,
      label: PATTERN_META[name]?.label || name.replace(/_/g, " "),
      count: convos.length,
      description:
        PATTERN_META[name]?.description ||
        `${convos.length} conversations matched this pattern.`,
      examples: convos.slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);

  // 5. Reality check metrics
  const total = classified.length;
  const reportedResolved = classified.filter(
    (c) => c.outcome !== "escalated"
  ).length;
  const actualResolved = classified.filter(
    (c) => c.outcome === "success"
  ).length;

  // 6. Date range
  const timestamps = rows
    .filter((r) => r.timestamp)
    .map((r) => new Date(r.timestamp!).getTime())
    .filter((t) => !isNaN(t));
  const start = timestamps.length
    ? new Date(Math.min(...timestamps)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";
  const end = timestamps.length
    ? new Date(Math.max(...timestamps)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  // 7. Actions
  const actions = generateActions(intents);

  // If no critical intents, generate generic actions
  if (actions.length === 0 && intents.length > 0) {
    const worst = intents.filter((i) => i.severity !== "good").slice(0, 2);
    for (const intent of worst) {
      actions.push({
        title:
          ACTION_TITLES[intent.name] ||
          `Improve handling for ${intent.displayName}`,
        intent: intent.displayName,
        effort: "low",
        impact: `${intent.sessions} sessions affected`,
        why: `${Math.round(intent.successRate * 100)}% success rate needs improvement`,
      });
    }
  }

  return {
    summary: {
      totalConversations: total,
      totalMessages: rows.length,
      reportedResolutionRate:
        total > 0 ? Math.round((reportedResolved / total) * 100) : 0,
      actualResolutionRate:
        total > 0 ? Math.round((actualResolved / total) * 100) : 0,
      falsePosCount: reportedResolved - actualResolved,
      dateRange: { start, end },
    },
    intents,
    patterns,
    actions,
    conversations: classified,
  };
}
