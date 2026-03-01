"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnalysisResults {
  job_id: string;
  data: Record<string, unknown>;
}

interface AnalysisContextValue {
  results: AnalysisResults | null;
  setResults: (r: AnalysisResults | null) => void;
  clear: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const clear = useCallback(() => setResults(null), []);

  return (
    <AnalysisContext.Provider value={{ results, setResults, clear }}>
      {children}
    </AnalysisContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
