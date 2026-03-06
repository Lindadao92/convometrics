"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeRangePreset = "1d" | "yesterday" | "7d" | "30d" | "3m" | "6m" | "12m" | "custom";

export const TIME_RANGE_PRESETS: { key: TimeRangePreset; label: string; days: number }[] = [
  { key: "1d",        label: "Today",     days: 1 },
  { key: "yesterday", label: "Yesterday", days: 2 },
  { key: "7d",        label: "7D",        days: 7 },
  { key: "30d",       label: "30D",       days: 30 },
  { key: "3m",        label: "3M",        days: 90 },
  { key: "6m",        label: "6M",        days: 180 },
  { key: "12m",       label: "12M",       days: 365 },
];

const MAX_MOCK_DATA_DAYS = 30;

export interface TimeRange {
  preset: TimeRangePreset;
  days: number;
  customFrom?: string;
  customTo?: string;
}

interface TimeRangeCtx {
  timeRange: TimeRange;
  setPreset: (preset: TimeRangePreset) => void;
  setCustomRange: (from: string, to: string) => void;
  effectiveDays: number;
  isShowingAllData: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DEFAULT_RANGE: TimeRange = { preset: "30d", days: 30 };

const TimeRangeContext = createContext<TimeRangeCtx>({
  timeRange: DEFAULT_RANGE,
  setPreset: () => {},
  setCustomRange: () => {},
  effectiveDays: 30,
  isShowingAllData: false,
});

const STORAGE_KEY = "convometrics_time_range";

export function TimeRangeProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_RANGE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as TimeRange;
        if (parsed.preset && parsed.days) setTimeRange(parsed);
      }
    } catch {}
  }, []);

  function persist(tr: TimeRange) {
    setTimeRange(tr);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tr)); } catch {}
  }

  function setPreset(preset: TimeRangePreset) {
    const found = TIME_RANGE_PRESETS.find((p) => p.key === preset);
    if (found) persist({ preset, days: found.days });
  }

  function setCustomRange(from: string, to: string) {
    const diffMs = new Date(to).getTime() - new Date(from).getTime();
    const days = Math.max(1, Math.ceil(diffMs / 86400000));
    persist({ preset: "custom", days, customFrom: from, customTo: to });
  }

  const effectiveDays = Math.min(timeRange.days, MAX_MOCK_DATA_DAYS);
  const isShowingAllData = timeRange.days > MAX_MOCK_DATA_DAYS;

  return (
    <TimeRangeContext.Provider value={{ timeRange, setPreset, setCustomRange, effectiveDays, isShowingAllData }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
