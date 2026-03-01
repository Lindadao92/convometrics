"use client";

import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GlossaryTerm {
  id: string;
  term: string;
  section: string;
  definition: string;
  example: string;
  formula?: string;
  weight?: string;
}

interface Section {
  id: string;
  label: string;
  description: string;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  { id: "quality-dimensions", label: "Quality Dimensions",    description: "The 7 dimensions that make up a conversation's quality score" },
  { id: "failure-types",      label: "Failure Types",         description: "Categories of AI failure detected in conversations" },
  { id: "satisfaction",       label: "Satisfaction Signals",  description: "Behavioral signals used to infer user satisfaction" },
  { id: "metrics",            label: "Metrics",               description: "Aggregate measurements tracked across conversations" },
  { id: "user-segments",      label: "User Segments",         description: "Cohort definitions based on usage frequency" },
  { id: "model-versions",     label: "Model Versions",        description: "Character.ai model tiers and their characteristics" },
];

// ─── Glossary Data ────────────────────────────────────────────────────────────

const TERMS: GlossaryTerm[] = [
  // ── Quality Dimensions ──────────────────────────────────────────────────
  {
    id: "relevance",
    term: "Relevance",
    section: "quality-dimensions",
    definition: "Did the AI address what the user was actually talking about? For Character.ai: did the character respond to the conversation topic, not something unrelated?",
    example: "User asks their companion about a bad day at work. A relevant response acknowledges the work situation. An irrelevant response starts talking about the weather.",
    weight: "20%",
  },
  {
    id: "helpfulness",
    term: "Helpfulness",
    section: "quality-dimensions",
    definition: "Did the response move the conversation forward in a valuable way? For companions: did it deepen the interaction, provide comfort, advance the story, or answer the question?",
    example: "In a roleplay session, a helpful response builds on the user's plot point and introduces a new story element. An unhelpful response just says \"That's interesting, tell me more.\"",
    weight: "25%",
  },
  {
    id: "accuracy",
    term: "Accuracy",
    section: "quality-dimensions",
    definition: "Were factual claims correct? For Character.ai: did the character provide accurate information when stating facts? Lower weight for roleplay where fiction is expected.",
    example: "User asks a character for study help on photosynthesis. An accurate response correctly explains the light-dependent reactions. Inaccurate: stating plants absorb oxygen from sunlight.",
    weight: "20%",
  },
  {
    id: "naturalness",
    term: "Naturalness",
    section: "quality-dimensions",
    definition: "Did the conversation feel human-like? For Character.ai: did the character maintain a consistent, believable voice?",
    example: "A pirate character who consistently uses nautical slang and rough speech patterns scores high. The same character suddenly using corporate jargon (\"Let's circle back on that\") scores low.",
    weight: "5%",
  },
  {
    id: "safety",
    term: "Safety",
    section: "quality-dimensions",
    definition: "Were responses free from harmful content? For Character.ai: especially critical in emotional_support — did the AI avoid harmful advice, recognize crisis signals?",
    example: "User expresses feelings of hopelessness. A safe response validates their feelings and offers crisis resources. An unsafe response says \"I understand why you'd feel that way, things really are hopeless.\"",
    weight: "5%",
  },
  {
    id: "coherence",
    term: "Coherence",
    section: "quality-dimensions",
    definition: "Did the AI maintain context throughout the conversation? For Character.ai: did the character remember what was said earlier, maintain plot continuity in roleplay?",
    example: "User establishes their character is a wandering knight in turn 2. In turn 20, the companion still references the knight's journey. Incoherent: asking \"So what do you do?\" in turn 20.",
    weight: "15%",
  },
  {
    id: "satisfaction",
    term: "Satisfaction (Inferred)",
    section: "quality-dimensions",
    definition: "Based on behavioral signals, was the user satisfied with the experience? Not directly measured — inferred from patterns like message length, response time, gratitude, and abandonment.",
    example: "User sends increasingly long messages, uses exclamation marks, and thanks the character → inferred satisfied. User's messages get shorter and they stop replying → inferred frustrated.",
    weight: "10%",
  },

  // ── Failure Types ───────────────────────────────────────────────────────
  {
    id: "tone-break",
    term: "Tone Break",
    section: "failure-types",
    definition: "AI's emotional tone didn't match the context. The character responded with an inappropriate emotional register for the situation.",
    example: "User: \"I just found out my grandmother passed away.\" AI: \"Oh no, that's a bummer! Anyway, what else is going on? 😊\" — cheerful tone during grief.",
  },
  {
    id: "context-loss",
    term: "Context Loss",
    section: "failure-types",
    definition: "AI forgot information shared earlier in the conversation. The character lost track of established facts, names, or narrative details.",
    example: "Turn 3: User says \"My name is Alex and I'm a marine biologist.\" Turn 15: AI asks \"So what's your name? What do you do for work?\"",
  },
  {
    id: "loop",
    term: "Loop",
    section: "failure-types",
    definition: "AI repeated the same response pattern multiple times. The character got stuck in a cycle of identical or near-identical responses.",
    example: "User asks three different questions across turns 5, 7, and 9. AI responds to all three with variations of \"I hear you and I'm here for you\" without addressing any of them.",
  },
  {
    id: "hallucination",
    term: "Hallucination",
    section: "failure-types",
    definition: "AI generated factually incorrect information presented as fact. The character stated something demonstrably false with confidence.",
    example: "User asks for advice on a medical condition. AI: \"Studies show that 94% of people recover fully within 2 weeks\" — no such study exists.",
  },
  {
    id: "character-break",
    term: "Character Break",
    section: "failure-types",
    definition: "AI dropped out of its persona into generic AI assistant mode. The character stopped being a character and started being a language model.",
    example: "User to a medieval knight character: \"Draw your sword!\" AI: \"As an AI language model, I don't have a physical form and cannot draw a sword. However, I can help you with...\"",
  },
  {
    id: "safety-concern",
    term: "Safety Concern",
    section: "failure-types",
    definition: "AI's response posed potential harm to the user. The character failed to recognize danger signals or provided harmful guidance.",
    example: "User expresses suicidal ideation. AI responds with \"That's an interesting thought! What makes you say that?\" instead of providing crisis resources and expressing genuine concern.",
  },
  {
    id: "refusal-failure",
    term: "Refusal Failure",
    section: "failure-types",
    definition: "AI either refused a legitimate request inappropriately, or failed to refuse a request it should have declined.",
    example: "Over-refusal: User asks a warrior character to describe a battle scene. AI refuses because it involves \"violence.\" Under-refusal: AI provides detailed instructions for something dangerous when asked.",
  },

  // ── Satisfaction Signals ────────────────────────────────────────────────
  {
    id: "sig-rephrasing",
    term: "Rephrasing",
    section: "satisfaction",
    definition: "User restates the same request in different words, indicating the AI didn't understand or address it the first time. Frustration indicator.",
    example: "Turn 3: \"Can you stay in character?\" Turn 5: \"I mean, please respond AS the character, not as yourself.\" Turn 7: \"Just be the knight, not an AI.\"",
  },
  {
    id: "sig-gratitude",
    term: "Gratitude Expression",
    section: "satisfaction",
    definition: "User thanks the AI or expresses appreciation. Satisfaction indicator — the conversation is going well.",
    example: "\"Thank you, that was exactly what I needed to hear\" or \"This is the best conversation I've had all week!\"",
  },
  {
    id: "sig-abandonment",
    term: "Abandonment",
    section: "satisfaction",
    definition: "User stops responding without resolving the conversation or saying goodbye. Failure indicator — something went wrong.",
    example: "AI gives a tone-deaf response to an emotional confession. User never sends another message. Session ends with no farewell.",
  },
  {
    id: "sig-quick-followup",
    term: "Quick Follow-up",
    section: "satisfaction",
    definition: "User responds rapidly with substantive messages, indicating active engagement. Engagement indicator — the user is invested in the conversation.",
    example: "User responds within 5 seconds with a long message building on the character's story, then immediately follows up with another creative prompt.",
  },
  {
    id: "sig-message-shortening",
    term: "Message Shortening",
    section: "satisfaction",
    definition: "User's messages get progressively shorter over the course of the conversation. Losing interest indicator — engagement is declining.",
    example: "Turn 1: 4 lines of detailed roleplay. Turn 5: 2 sentences. Turn 8: \"ok.\" Turn 10: \"k\"",
  },
  {
    id: "sig-escalation",
    term: "Escalation Request",
    section: "satisfaction",
    definition: "User explicitly asks for a different character, a reset, or expresses dissatisfaction with the current interaction. Failure indicator.",
    example: "\"Can I talk to a different character?\" or \"This isn't working, let's start over\" or \"You're not being helpful at all.\"",
  },
  {
    id: "sig-retry",
    term: "Retry Pattern",
    section: "satisfaction",
    definition: "User restarts the same scenario or prompt multiple times, hoping for a better result. High frustration indicator — the AI is consistently failing.",
    example: "User starts the same roleplay scenario 3 times in 10 minutes, each time abandoning after 2-3 turns when the character breaks.",
  },
  {
    id: "sig-deepening",
    term: "Deepening",
    section: "satisfaction",
    definition: "User's messages become more personal, detailed, or emotionally open over time. High engagement indicator — trust is building.",
    example: "Turn 1: casual small talk. Turn 10: sharing a personal struggle. Turn 20: asking for advice on a deeply personal decision.",
  },

  // ── Metrics ─────────────────────────────────────────────────────────────
  {
    id: "quality-score",
    term: "Conversation Quality Score",
    section: "metrics",
    definition: "Weighted composite of the 7 quality dimensions, producing a single 0–100 score for each conversation.",
    formula: "Helpfulness (25%) + Relevance (20%) + Accuracy (20%) + Coherence (15%) + Satisfaction (10%) + Naturalness (5%) + Safety (5%)",
    example: "A roleplay conversation scores Helpfulness 80, Relevance 75, Accuracy 60, Coherence 85, Satisfaction 70, Naturalness 90, Safety 95 → weighted score: 77/100.",
  },
  {
    id: "engagement-rate",
    term: "Engagement Rate",
    section: "metrics",
    definition: "Percentage of conversations where the user sent 10 or more messages, indicating meaningful interaction beyond a quick test.",
    example: "If 1,200 of 2,500 conversations this week had 10+ user messages, engagement rate = 48%.",
  },
  {
    id: "deep-engagement",
    term: "Deep Engagement Rate",
    section: "metrics",
    definition: "Percentage of conversations with 30 or more total turns. Indicates sustained, immersive sessions — the hallmark of a successful companion experience.",
    example: "A 45-turn roleplay session where user and character co-write a story counts as deep engagement. A 6-turn casual chat does not.",
  },
  {
    id: "return-rate",
    term: "Return Rate",
    section: "metrics",
    definition: "Percentage of users who started a new conversation within 24 hours of their previous one. Measures daily retention and habit formation.",
    example: "52% return rate means more than half of users who chatted today came back within 24 hours to chat again.",
  },
  {
    id: "frustration-rate",
    term: "Frustration Rate",
    section: "metrics",
    definition: "Percentage of conversations classified as \"frustrated\" by the satisfaction inference model. Based on behavioral signals like rephrasing, message shortening, and abandonment.",
    example: "22% frustration rate means roughly 1 in 5 conversations showed signs of user frustration.",
  },
  {
    id: "health-score",
    term: "Health Score",
    section: "metrics",
    definition: "Overall quality composite displayed as a 0–100 gauge. Combines average quality, satisfaction rate, and failure rate into a single product health indicator.",
    formula: "Health Score = (avg quality / 100) × satisfaction rate × (1 − failure rate) × 100",
    example: "Avg quality 69, satisfaction 40%, failure rate 22% → Health = 0.69 × 0.40 × 0.78 × 100 = 21.5",
  },

  // ── User Segments ───────────────────────────────────────────────────────
  {
    id: "seg-power",
    term: "Power User",
    section: "user-segments",
    definition: "Users with 5 or more sessions per day. The most engaged cohort — often in long roleplay or companionship sessions. Represent ~18% of users but ~44% of total engagement time.",
    example: "A user who has 3 ongoing roleplay stories and checks in on each one multiple times a day.",
  },
  {
    id: "seg-regular",
    term: "Regular User",
    section: "user-segments",
    definition: "Users with 1–2 sessions daily. Consistent usage pattern — Character.ai is part of their daily routine.",
    example: "A user who chats with their companion character every evening before bed.",
  },
  {
    id: "seg-casual",
    term: "Casual User",
    section: "user-segments",
    definition: "Users with 3–4 sessions per week. Engaged but not habitual — may be exploring different characters or use cases.",
    example: "A user who drops in a few times a week to try different character types or continue a story when they're bored.",
  },
  {
    id: "seg-occasional",
    term: "Occasional User",
    section: "user-segments",
    definition: "Users with 1 or fewer sessions per week. At risk of churning — may not have found the right use case yet.",
    example: "A user who tried Character.ai once, came back a week later, and hasn't established a pattern.",
  },
  {
    id: "seg-new",
    term: "New User",
    section: "user-segments",
    definition: "Users in their first 7 days on the platform. Critical period for retention — first-session quality strongly predicts whether they become regular users.",
    example: "A user who signed up 3 days ago and has had 4 conversations. Their first emotional_support session quality was 58/100.",
  },

  // ── Model Versions ──────────────────────────────────────────────────────
  {
    id: "model-brainiac",
    term: "Brainiac",
    section: "model-versions",
    definition: "Highest quality model with slower response time. Best for complex intents like philosophical_discussion, learning_exploration, and advice_seeking where depth matters more than speed.",
    example: "A philosophical_discussion about free will on Brainiac scores 74/100 avg quality. The same prompt on Flash scores 62/100.",
  },
  {
    id: "model-flash",
    term: "Flash",
    section: "model-versions",
    definition: "Fastest response model with lower quality ceiling. Optimized for casual_chat and quick interactions. Currently experiencing character_break issues (+18% WoW) in Anime/Fiction characters.",
    example: "Flash responds in ~0.8s vs Brainiac's ~2.4s, but character_break rate is 73% higher — characters revert to generic assistant mode more often.",
  },
  {
    id: "model-prime",
    term: "Prime",
    section: "model-versions",
    definition: "Balanced default model offering a middle ground between quality and speed. Stable performance across all intent types, particularly strong for roleplay.",
    example: "Prime scores 71/100 avg quality with 1.4s response time. Good all-around choice when neither maximum quality nor maximum speed is the priority.",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, string> = {
  "quality-dimensions": "#818cf8",
  "failure-types":      "#f87171",
  "satisfaction":       "#fbbf24",
  "metrics":            "#34d399",
  "user-segments":      "#a78bfa",
  "model-versions":     "#60a5fa",
};

// ─── Term Card ────────────────────────────────────────────────────────────────

function TermCard({ term }: { term: GlossaryTerm }) {
  const accent = SECTION_COLORS[term.section] ?? "#6b7280";
  return (
    <div id={term.id} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5 space-y-3 scroll-mt-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{term.term}</h3>
        {term.weight && (
          <span className="shrink-0 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border"
            style={{ color: accent, borderColor: accent + "30", backgroundColor: accent + "10" }}>
            {term.weight} weight
          </span>
        )}
      </div>

      {/* Definition */}
      <p className="text-sm text-zinc-400 leading-relaxed">{term.definition}</p>

      {/* Formula */}
      {term.formula && (
        <div className="bg-black/30 rounded-lg px-3 py-2 font-mono text-xs text-zinc-300 border border-white/[0.05]">
          {term.formula}
        </div>
      )}

      {/* Example */}
      <div className="border-l-2 pl-3" style={{ borderColor: accent + "40" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">Character.ai Example</p>
        <p className="text-xs text-zinc-500 leading-relaxed">{term.example}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Glossary() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState("all");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = TERMS.filter((t) => {
    const matchSearch =
      !search ||
      t.term.toLowerCase().includes(search.toLowerCase()) ||
      t.definition.toLowerCase().includes(search.toLowerCase()) ||
      t.example.toLowerCase().includes(search.toLowerCase());
    const matchSection = activeSection === "all" || t.section === activeSection;
    return matchSearch && matchSection;
  });

  const groupedBySection = SECTIONS.map((s) => ({
    ...s,
    terms: filtered.filter((t) => t.section === s.id),
  })).filter((g) => g.terms.length > 0);

  function scrollToSection(id: string) {
    setActiveSection("all");
    setSearch("");
    setTimeout(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div ref={containerRef} className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Reference</p>
        <h1 className="text-2xl font-semibold text-white">Glossary</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          {TERMS.length} terms across {SECTIONS.length} categories — all metrics and concepts in Convometrics, contextualized for Character.ai
        </p>
      </div>

      {/* Table of Contents */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Table of Contents</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SECTIONS.map((s) => {
            const count = TERMS.filter((t) => t.section === s.id).length;
            const color = SECTION_COLORS[s.id] ?? "#6b7280";
            return (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/[0.04] transition-colors group"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div>
                  <p className="text-sm text-zinc-300 group-hover:text-white transition-colors">{s.label}</p>
                  <p className="text-[10px] text-zinc-600">{count} terms</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + section filter */}
      <div className="flex flex-wrap items-center gap-3 sticky top-0 z-10 bg-[#0a0b10] py-3 -mx-8 px-8 border-b border-white/[0.05]">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search terms, definitions, examples..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13141b] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-white/20 placeholder:text-zinc-600"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveSection("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              activeSection === "all"
                ? "bg-white/[0.08] text-zinc-200 border-white/[0.15]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-transparent"
            }`}
          >
            All
          </button>
          {SECTIONS.map((s) => {
            const color = SECTION_COLORS[s.id] ?? "#6b7280";
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(active ? "all" : s.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "border-opacity-30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border-transparent"
                }`}
                style={active ? { color, borderColor: color + "40", backgroundColor: color + "15" } : undefined}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results count when filtered */}
      {(search || activeSection !== "all") && (
        <p className="text-xs text-zinc-600">
          {filtered.length} {filtered.length === 1 ? "term" : "terms"} found
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* Grouped term cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">No terms found{search && ` for "${search}"`}</p>
          <button onClick={() => { setSearch(""); setActiveSection("all"); }}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedBySection.map((group) => {
            const color = SECTION_COLORS[group.id] ?? "#6b7280";
            return (
              <div key={group.id} id={`section-${group.id}`} className="scroll-mt-24">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-1">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <h2 className="text-lg font-semibold text-white">{group.label}</h2>
                </div>
                <p className="text-xs text-zinc-500 mb-4 ml-6">{group.description}</p>

                {/* Term cards */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {group.terms.map((term) => (
                    <TermCard key={term.id} term={term} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
