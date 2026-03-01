"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DemoSegment = "ai_assistant" | "ai_companion" | "ai_support" | "ai_tutor";

export const DEMO_SEGMENT_META: Record<DemoSegment, { name: string; emoji: string; short: string }> = {
  ai_assistant: { name: "AI Assistant",     emoji: "🤖", short: "Assistant" },
  ai_companion: { name: "AI Companion",     emoji: "💬", short: "Companion" },
  ai_support:   { name: "AI Support Agent", emoji: "🎧", short: "Support"   },
  ai_tutor:     { name: "AI Tutor",         emoji: "📚", short: "Tutor"     },
};

export const DEMO_SEGMENTS = Object.keys(DEMO_SEGMENT_META) as DemoSegment[];

// ─── Context ──────────────────────────────────────────────────────────────────

interface DemoModeCtx {
  segment: DemoSegment;
  setSegment: (s: DemoSegment) => void;
}

const DemoModeContext = createContext<DemoModeCtx>({
  segment: "ai_assistant",
  setSegment: () => {},
});

const STORAGE_KEY = "convometrics_demo_segment";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [segment, setSegmentState] = useState<DemoSegment>("ai_companion");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as DemoSegment | null;
      if (stored && DEMO_SEGMENTS.includes(stored)) setSegmentState(stored);
    } catch {}
  }, []);

  function setSegment(s: DemoSegment) {
    setSegmentState(s);
    try { localStorage.setItem(STORAGE_KEY, s); } catch {}
  }

  return (
    <DemoModeContext.Provider value={{ segment, setSegment }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
