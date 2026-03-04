"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useState, useRef, useEffect } from "react";
import { ProductProfileProvider } from "@/lib/product-profile-context";
import { DemoModeProvider } from "@/lib/demo-mode-context";
import { TimeRangeProvider, useTimeRange, TIME_RANGE_PRESETS, TimeRangePreset } from "@/lib/time-range-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
      </svg>
    ),
  },
  {
    href: "/intents",
    label: "Intent Analysis",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    href: "/patterns",
    label: "Hidden Patterns",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    href: "/reality-check",
    label: "Reality Check",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  {
    href: "/actions",
    label: "Recommendations",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    href: "/glossary",
    label: "Glossary",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

// ─── Time Range Selector ─────────────────────────────────────────────────────

function TimeRangeSelector() {
  const { timeRange, setPreset, setCustomRange, isShowingAllData } = useTimeRange();
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    }
    if (showCustom) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCustom]);

  function applyCustom() {
    if (customFrom && customTo) {
      setCustomRange(customFrom, customTo);
      setShowCustom(false);
    }
  }

  return (
    <div className="relative flex items-center gap-2" ref={dropdownRef}>
      <div className="flex items-center gap-0.5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.07] p-0.5">
        {TIME_RANGE_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPreset(p.key); setShowCustom(false); }}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
              timeRange.preset === p.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
            timeRange.preset === "custom"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
          }`}
        >
          Custom
        </button>
      </div>

      {isShowingAllData && (
        <span className="text-[10px] text-zinc-600 whitespace-nowrap">Showing all available data (30 days)</span>
      )}

      {showCustom && (
        <div className="absolute right-0 top-full mt-2 rounded-xl border border-white/[0.08] bg-[#13141b] p-4 shadow-xl z-30 min-w-[280px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Custom Date Range</p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 mb-1 block">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full bg-[#0a0b10] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/40"
              />
            </div>
            <span className="text-zinc-600 mt-4">-</span>
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 mb-1 block">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full bg-[#0a0b10] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/40"
              />
            </div>
          </div>
          <button
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
            className="w-full py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inner shell (uses context) ───────────────────────────────────────────────

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0b10]">
      {/* Top header bar */}
      <header className="h-12 shrink-0 border-b border-white/[0.06] bg-[#0a0b10] flex items-center px-4 gap-3 z-20">
        {/* Mobile hamburger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {sidebarOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>

        {/* Product name */}
        <Link
          href="/"
          className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity shrink-0"
        >
          ConvoMetrics
        </a>
        <span className="text-[10px] text-zinc-600 font-medium">Character.ai Dashboard</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Time range selector */}
        <TimeRangeSelector />

        {/* Gear icon → Settings */}
        <Link
          href="/settings"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left sidebar */}
        <aside className={`
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          fixed md:static inset-y-0 left-0 z-30
          w-52 shrink-0 border-r border-white/[0.06] bg-[#0a0b10]
          flex flex-col overflow-y-auto
          transition-transform duration-200 ease-in-out
          pt-12 md:pt-0
        `}>
          <nav className="flex flex-col gap-0.5 px-3 py-4">
            {NAV.map(({ href, label, icon }) => {
              const OVERVIEW_SUBPAGES = ["/retention", "/engagement", "/satisfaction", "/at-risk"];
              const active = href === "/"
                ? pathname === "/" || OVERVIEW_SUBPAGES.some(p => pathname.startsWith(p))
                : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "text-white bg-white/[0.07]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {icon}
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-5 py-4 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-600">v0.4.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col">
          <FilterBar />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/[0.05] py-6 text-center">
            <p className="text-[10px] text-zinc-700">ConvoMetrics &middot; Mixpanel for AI Conversations</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ─── Exported shell (wraps with provider) ─────────────────────────────────────

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <DemoModeProvider>
      <ProductProfileProvider>
        <TimeRangeProvider>
          <ShellInner>{children}</ShellInner>
        </TimeRangeProvider>
      </ProductProfileProvider>
    </DemoModeProvider>
  );
}
