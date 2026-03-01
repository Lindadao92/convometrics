"use client";

import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#8b5cf6";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

const ENGAGEMENT_DAILY = (() => {
  const base = [64, 66, 68, 65, 67, 69, 66, 63, 65, 67, 70, 68, 66, 64, 67, 69, 71, 68, 66, 65, 67, 68, 70, 67, 65, 66, 68, 69, 67, 67];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

const TURN_DISTRIBUTION = [
  { bucket: "1–5", count: 420 },
  { bucket: "6–10", count: 380 },
  { bucket: "11–20", count: 610 },
  { bucket: "21–30", count: 450 },
  { bucket: "31–50", count: 320 },
  { bucket: "50+", count: 180 },
];

const SESSIONS_PER_USER = (() => {
  const base = [1.8, 1.9, 2.0, 1.7, 1.9, 2.1, 2.0, 1.8, 1.9, 2.0, 2.2, 2.1, 1.9, 1.8, 2.0, 2.1, 2.3, 2.1, 1.9, 1.8, 2.0, 2.0, 2.2, 2.0, 1.8, 1.9, 2.1, 2.1, 2.0, 2.0];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

const AVG_DURATION_TREND = (() => {
  const base = [12, 13, 14, 11, 13, 15, 14, 12, 13, 14, 16, 15, 13, 12, 14, 15, 16, 15, 13, 12, 14, 14, 15, 14, 12, 13, 14, 15, 14, 14];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

const ENGAGEMENT_BY_INTENT = [
  { intent: "Roleplay",             deepRate: 78, avgTurns: 34, sessionsPerUser: 2.4 },
  { intent: "Creative Storytelling", deepRate: 82, avgTurns: 38, sessionsPerUser: 2.1 },
  { intent: "Emotional Support",    deepRate: 65, avgTurns: 22, sessionsPerUser: 1.8 },
  { intent: "Casual Chat",          deepRate: 52, avgTurns: 14, sessionsPerUser: 2.6 },
  { intent: "Gaming Companion",     deepRate: 71, avgTurns: 28, sessionsPerUser: 2.3 },
  { intent: "Knowledge Q&A",        deepRate: 38, avgTurns: 8,  sessionsPerUser: 1.4 },
  { intent: "Language Practice",     deepRate: 61, avgTurns: 19, sessionsPerUser: 1.7 },
  { intent: "Debate / Argument",    deepRate: 74, avgTurns: 31, sessionsPerUser: 1.5 },
  { intent: "NSFW / Adult",         deepRate: 69, avgTurns: 26, sessionsPerUser: 2.2 },
];

const ENGAGEMENT_BY_CHARACTER = [
  { type: "Anime/Fiction",      deepRate: 76, avgTurns: 35 },
  { type: "Original Character", deepRate: 72, avgTurns: 32 },
  { type: "Romantic Partner",   deepRate: 68, avgTurns: 42 },
  { type: "Game Character",     deepRate: 70, avgTurns: 29 },
  { type: "Therapist/Advisor",  deepRate: 58, avgTurns: 18 },
  { type: "Celebrity",          deepRate: 41, avgTurns: 14 },
  { type: "Historical Figure",  deepRate: 45, avgTurns: 12 },
];

type IntentSortKey = "deepRate" | "avgTurns" | "sessionsPerUser";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngagementPage() {
  const [sortKey, setSortKey] = useState<IntentSortKey>("deepRate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: IntentSortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedIntents = [...ENGAGEMENT_BY_INTENT].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const sortArrow = (key: IntentSortKey) => {
    if (sortKey !== key) return <span className="text-zinc-700 ml-0.5">&#8597;</span>;
    return <span className="text-purple-400 ml-0.5">{sortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const deepColor = (v: number) => v >= 70 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Back + Title */}
      <div>
        <a href="/" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
          ← Overview
        </a>
        <h1 className="text-2xl font-bold text-white mt-1">
          Engagement <span className="text-zinc-500 font-normal">·</span>{" "}
          <span className="text-purple-400">67% deep conversation rate</span>
        </h1>
      </div>

      {/* Hero Chart — Daily Engagement Rate */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Daily Engagement Rate</p>
        <p className="text-xs text-zinc-600 mb-4">% of sessions with 10+ turns (deep conversations)</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ENGAGEMENT_DAILY} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Deep rate"]} />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#engGrad)"
                dot={false} activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Three stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Avg Turns / Session</p>
          <p className="text-3xl font-bold font-mono text-white">25</p>
          <p className="text-xs text-zinc-600 mt-1">35% of sessions reach 30+ turns</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Sessions / User / Day</p>
          <p className="text-3xl font-bold font-mono text-white">2.0</p>
          <p className="text-xs text-zinc-600 mt-1">Stable over past 30 days</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Avg Session Duration</p>
          <p className="text-3xl font-bold font-mono text-white">14 min</p>
          <p className="text-xs text-zinc-600 mt-1">Ranging 11–16 min over period</p>
        </div>
      </div>

      {/* Two-column: Turn Distribution + Session Duration */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Turn Distribution Histogram */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Turn Distribution</p>
          <p className="text-xs text-zinc-600 mb-4">Sessions by number of turns</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TURN_DISTRIBUTION} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="bucket" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [v ?? 0, "Sessions"]} />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Session Duration Trend */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Avg Session Duration</p>
          <p className="text-xs text-zinc-600 mb-4">Daily average in minutes</p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={AVG_DURATION_TREND} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
                <YAxis domain={[0, 25]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0} min`, "Duration"]} />
                <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={false}
                  activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Engagement by Intent — sortable table */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement by Intent</p>
          <p className="text-xs text-zinc-600">Click column headers to sort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("deepRate")}>
                  Deep Rate{sortArrow("deepRate")}
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("avgTurns")}>
                  Avg Turns{sortArrow("avgTurns")}
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500 cursor-pointer select-none" onClick={() => toggleSort("sessionsPerUser")}>
                  Sessions/User{sortArrow("sessionsPerUser")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIntents.map((row) => (
                <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.intent}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${deepColor(row.deepRate)}`}>{row.deepRate}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{row.avgTurns}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{row.sessionsPerUser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Engagement by Character Type */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Engagement by Character Type</p>
          <p className="text-xs text-zinc-600">Deep conversation rate and average turns by character category</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Type</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Deep Rate</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Avg Turns</th>
              </tr>
            </thead>
            <tbody>
              {ENGAGEMENT_BY_CHARACTER.map((row) => (
                <tr key={row.type} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.type}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${deepColor(row.deepRate)}`}>{row.deepRate}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-400">{row.avgTurns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
