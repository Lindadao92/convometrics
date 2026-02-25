import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSegmentConversations, getUserLtv, getConversationOutcome, computeChurnRiskUsers } from "@/lib/mockSegmentData";

export const dynamic = "force-dynamic";

function cap(s: string) { return s.replace(/_/g, " "); }

const MOCK_FIRST_MESSAGES: Record<string, string> = {
  // AI Assistant
  research_question: "Can you help me research the latest developments in quantum computing?",
  code_help: "I'm trying to write a function that parses JSON and handles nested arrays...",
  writing_task: "Help me write a compelling introduction for my blog post about remote work.",
  analysis: "Can you analyze the pros and cons of this product strategy document?",
  brainstorming: "I need creative ideas for a marketing campaign targeting Gen Z.",
  debug_error: "I'm getting a TypeError: Cannot read properties of undefined in my React app.",
  explain_concept: "Can you explain how transformer models work in simple terms?",
  connect_api: "How do I authenticate with the Stripe API using OAuth?",
  data_analysis: "I have a CSV with 10,000 sales records. How should I approach segmenting it?",
  summarization: "Please summarize this 20-page research paper on climate change adaptation.",
  // AI Companion (Character.ai style)
  roleplay: "Let's continue our story — you're the dragon queen and I'm the wandering knight who just arrived at your court.",
  emotional_support: "I've been feeling really overwhelmed lately and don't know who to talk to. Can you just listen?",
  casual_chat: "Hey! How's your day going? I just got back from the weirdest grocery store trip ever.",
  creative_storytelling: "Okay so imagine this: a haunted lighthouse, a missing sailor, and a talking cat. Let's build a story.",
  advice_seeking: "I'm thinking about dropping out of college to start a business. Everyone thinks I'm crazy. What do you think?",
  companionship: "I moved to a new city last month and it's been really lonely. Can we just hang out and talk?",
  humor_entertainment: "Make me laugh — I've had the worst day. No dad jokes, I need something actually funny.",
  learning_exploration: "I've been wondering how black holes actually work. Can you explain it in a way that's fun and not textbook-y?",
  philosophical_discussion: "Do you think we actually have free will, or are we all just following a script we can't see?",
  // AI Support
  billing_issue: "I was charged twice for my subscription this month. Order #84729.",
  technical_problem: "My account dashboard shows all zeros even though I have active campaigns.",
  feature_request: "Is there any way to schedule reports to send automatically every Monday?",
  account_access: "I can't log in — it says my password is wrong but I just reset it.",
  complaint: "This is the third time I've contacted support about the same issue. Unacceptable.",
  return_request: "I received the wrong item. I ordered the blue version but got red.",
  shipping_status: "My order was supposed to arrive 3 days ago. Can you check the status?",
  upgrade_inquiry: "What's the difference between the Pro and Business plans?",
  cancellation: "I'd like to cancel my subscription. It's just not the right fit right now.",
  // AI Tutor
  concept_explanation: "I don't understand why recursion works. Can you explain it differently?",
  practice_problem: "Can you give me a practice problem for quadratic equations?",
  homework_help: "I need help with question 4 from tonight's calculus homework.",
  exam_prep: "I have a chemistry exam on Monday covering thermodynamics and equilibrium.",
  language_practice: "Je voudrais pratiquer mon français. Peux-tu m'aider?",
  step_by_step_walkthrough: "Walk me through how to solve this proof step by step.",
  quiz_review: "Quiz me on the causes of World War I.",
  study_planning: "I have 3 weeks before my LSAT. Help me create a study plan.",
};

export async function GET(req: NextRequest) {
  const params    = req.nextUrl.searchParams;
  const segment   = params.get("segment") ?? "";

  // Demo mode: return mock conversations
  if (segment) {
    const allConvos = getSegmentConversations(segment);
    const intent    = params.get("intent")    ?? "";
    const minScore  = params.get("min_score") ?? "";
    const maxScore  = params.get("max_score") ?? "";
    const page      = parseInt(params.get("page") || "0", 10);
    const limit     = 25;

    let filtered = [...allConvos];
    if (intent) filtered = filtered.filter(c => c.intent === intent);
    const minNum = minScore ? parseInt(minScore, 10) : NaN;
    const maxNum = maxScore ? parseInt(maxScore, 10) : NaN;
    if (!isNaN(minNum)) filtered = filtered.filter(c => c.scores.overall >= minNum);
    if (!isNaN(maxNum)) filtered = filtered.filter(c => c.scores.overall <= maxNum);

    const total = filtered.length;
    const paginated = filtered.slice(page * limit, (page + 1) * limit);
    const intents = [...new Set(allConvos.map(c => c.intent))].sort();
    const { userIds: churnRiskSet } = computeChurnRiskUsers(allConvos);

    const conversations = paginated.map(c => ({
      id: c.id,
      conversation_id: c.id,
      user_id: c.user_id,
      platform: c.character_type ?? "Original Character",
      intent: c.intent,
      quality_score: c.scores.overall,
      completion_status: c.session_status ?? (c.inferred_satisfaction === "abandoned" ? "Abandoned" : "Normal"),
      messages: [],
      created_at: c.timestamp,
      turns: c.turns ?? 15,
      firstUserMessage: MOCK_FIRST_MESSAGES[c.intent] ?? `User asked about ${cap(c.intent).toLowerCase()}.`,
      churnRisk: churnRiskSet.has(c.user_id),
      ltv: getUserLtv(c.user_id),
      outcome: getConversationOutcome(c.id, c.scores.overall),
    }));

    return NextResponse.json({ conversations, total, page, pageSize: limit, intents });
  }

  const sb = getSupabaseServer();
  const intent    = params.get("intent");
  const status    = params.get("status");
  const platform  = params.get("platform");
  const minScore  = params.get("min_score");
  const maxScore  = params.get("max_score");
  const sortBy    = params.get("sort") || "created_at";
  const order     = params.get("order") || "desc";
  const page      = parseInt(params.get("page") || "0", 10);
  const format    = params.get("format");
  const limit     = 25;

  let query = sb
    .from("conversations")
    .select("id, conversation_id, user_id, intent, quality_score, completion_status, messages, created_at, metadata", { count: "exact" });

  if (intent)   query = query.eq("intent", intent);
  if (status)   query = query.eq("completion_status", status);
  if (platform && platform !== "all") query = query.eq("metadata->>platform", platform);
  const minScoreNum = minScore ? parseInt(minScore, 10) : NaN;
  const maxScoreNum = maxScore ? parseInt(maxScore, 10) : NaN;
  if (!isNaN(minScoreNum)) query = query.gte("quality_score", minScoreNum);
  if (!isNaN(maxScoreNum)) query = query.lte("quality_score", maxScoreNum);

  // CSV export — fetch up to 5000 rows, no pagination
  if (format === "csv") {
    const { data: csvRows, error: csvErr } = await query
      .order(sortBy, { ascending: order === "asc" })
      .limit(5000);
    if (csvErr) return NextResponse.json({ error: csvErr.message }, { status: 500 });

    const header = "id,platform,date,intent,quality_score,completion_status,turns,first_message\n";
    const lines = (csvRows ?? []).map((r) => {
      const meta = r.metadata as Record<string, unknown> | null;
      const msgs = r.messages as { role: string; content: string }[] | null;
      const firstUser = msgs?.find((m) => m.role === "user")?.content ?? "";
      return [
        r.id,
        (meta?.platform as string) ?? "unknown",
        r.created_at,
        r.intent ?? "",
        r.quality_score ?? "",
        r.completion_status ?? "",
        (meta?.turns_count as number | null) ?? "",
        `"${firstUser.slice(0, 200).replace(/"/g, '""')}"`,
      ].join(",");
    }).join("\n");

    return new Response(header + lines, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="conversations.csv"`,
      },
    });
  }

  query = query
    .order(sortBy, { ascending: order === "asc" })
    .range(page * limit, (page + 1) * limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Distinct intents for filter dropdown
  const { data: intentRows } = await sb
    .from("conversations")
    .select("intent")
    .not("intent", "is", null);
  const intents = [...new Set((intentRows || []).map((r) => r.intent).filter(Boolean))].sort();

  // Extract platform, turns, and first user message from each row
  const conversations = (data ?? []).map((r) => {
    const meta = r.metadata as Record<string, unknown> | null;
    const messages = r.messages as { role: string; content: string }[] | null;
    const firstUserMessage = messages?.find((m) => m.role === "user")?.content?.slice(0, 120) ?? "";
    return {
      ...r,
      platform: (meta?.platform as string) ?? "unknown",
      turns: (meta?.turns_count as number | null) ?? null,
      firstUserMessage,
    };
  });

  return NextResponse.json({ conversations, total: count ?? 0, page, pageSize: limit, intents });
}
