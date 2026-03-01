"use client";

import { useState, useRef, useEffect } from "react";
import { useFilters } from "@/lib/filter-context";
import { useDemoMode } from "@/lib/demo-mode-context";
import { useTimeRange } from "@/lib/time-range-context";
import { formatLabel } from "@/lib/formatLabel";

const SENTIMENTS = [
  { value: "satisfied", label: "Satisfied", color: "bg-emerald-400" },
  { value: "neutral", label: "Neutral", color: "bg-zinc-400" },
  { value: "frustrated", label: "Frustrated", color: "bg-amber-400" },
  { value: "abandoned", label: "Abandoned", color: "bg-red-400" },
];

const RESOLUTIONS = [
  { value: "completed", label: "Completed", color: "bg-emerald-400" },
  { value: "failed", label: "Failed", color: "bg-red-400" },
  { value: "abandoned", label: "Abandoned", color: "bg-amber-400" },
];

function Dropdown({ label, children, isActive }: { label: string; children: React.ReactNode; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
          isActive
            ? "bg-indigo-500/[0.15] border border-indigo-500/30 text-indigo-300"
            : "bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.12]"
        }`}
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 rounded-xl border border-white/[0.08] bg-[#13141b] shadow-xl z-30 min-w-[200px] py-1.5">
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterBar() {
  const { filters, setIntents, setSentiment, setResolution, clearAll, hasActiveFilters } = useFilters();
  const { segment } = useDemoMode();
  const { effectiveDays } = useTimeRange();
  const [availableIntents, setAvailableIntents] = useState<string[]>([]);

  // Fetch available intents for the current segment
  useEffect(() => {
    fetch(`/api/topics?segment=${segment}&days=${effectiveDays}`)
      .then((r) => r.json())
      .then((data) => {
        const intents = (data.unclustered ?? data.topics ?? []).map((t: { label?: string; intent?: string }) => t.label ?? t.intent ?? "");
        setAvailableIntents(intents.filter(Boolean));
      })
      .catch(() => {});
  }, [segment, effectiveDays]);

  const toggleIntent = (intent: string) => {
    if (filters.intents.includes(intent)) {
      setIntents(filters.intents.filter((i) => i !== intent));
    } else {
      setIntents([...filters.intents, intent]);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-3 border-b border-white/[0.05]">
      <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 mr-1">Filters</span>

      {/* Intent multi-select */}
      <Dropdown label={filters.intents.length > 0 ? `Intent (${filters.intents.length})` : "Intent"} isActive={filters.intents.length > 0}>
        <div className="max-h-60 overflow-y-auto px-1">
          {availableIntents.map((intent) => (
            <label key={intent} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04] rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={filters.intents.includes(intent)}
                onChange={() => toggleIntent(intent)}
                className="rounded border-white/20 bg-transparent text-indigo-500 focus:ring-indigo-500/30 cursor-pointer"
              />
              <span className="text-xs text-zinc-300">{formatLabel(intent)}</span>
            </label>
          ))}
          {availableIntents.length === 0 && (
            <p className="text-xs text-zinc-600 px-3 py-2">Loading...</p>
          )}
        </div>
      </Dropdown>

      {/* Sentiment single-select */}
      <Dropdown label={filters.sentiment ? formatLabel(filters.sentiment) : "Sentiment"} isActive={filters.sentiment !== null}>
        {SENTIMENTS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSentiment(filters.sentiment === s.value ? null : s.value)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-white/[0.04] rounded-lg cursor-pointer ${
              filters.sentiment === s.value ? "text-white" : "text-zinc-400"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.label}
            {filters.sentiment === s.value && <span className="ml-auto text-indigo-400">&#10003;</span>}
          </button>
        ))}
      </Dropdown>

      {/* Resolution single-select */}
      <Dropdown label={filters.resolution ? formatLabel(filters.resolution) : "Resolution"} isActive={filters.resolution !== null}>
        {RESOLUTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setResolution(filters.resolution === r.value ? null : r.value)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-white/[0.04] rounded-lg cursor-pointer ${
              filters.resolution === r.value ? "text-white" : "text-zinc-400"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${r.color}`} />
            {r.label}
            {filters.resolution === r.value && <span className="ml-auto text-indigo-400">&#10003;</span>}
          </button>
        ))}
      </Dropdown>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <>
          <div className="w-px h-4 bg-white/[0.08] mx-1" />
          {filters.intents.map((intent) => (
            <span key={intent} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/[0.12] border border-indigo-500/20 text-[10px] text-indigo-300">
              {formatLabel(intent)}
              <button onClick={() => toggleIntent(intent)} className="hover:text-white cursor-pointer">&times;</button>
            </span>
          ))}
          {filters.sentiment && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/[0.12] border border-indigo-500/20 text-[10px] text-indigo-300">
              {formatLabel(filters.sentiment)}
              <button onClick={() => setSentiment(null)} className="hover:text-white cursor-pointer">&times;</button>
            </span>
          )}
          {filters.resolution && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/[0.12] border border-indigo-500/20 text-[10px] text-indigo-300">
              {formatLabel(filters.resolution)}
              <button onClick={() => setResolution(null)} className="hover:text-white cursor-pointer">&times;</button>
            </span>
          )}
          <button onClick={clearAll} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer ml-1">
            Clear all
          </button>
        </>
      )}
    </div>
  );
}
