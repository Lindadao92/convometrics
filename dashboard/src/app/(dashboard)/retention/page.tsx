"use client";

import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#6366f1";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

const RETENTION_CURVE = [
  { label: "Day 0", value: 100 },
  { label: "Day 1", value: 62 },
  { label: "Day 3", value: 51 },
  { label: "Day 7", value: 43 },
  { label: "Day 14", value: 41 },
  { label: "Day 21", value: 46 },
  { label: "Day 28", value: 45 },
];

const COHORT_DATA = [
  { cohort: "Jan 27 – Feb 2",  week0: 100, week1: 44, week2: 42, week3: 47, week4: 45 },
  { cohort: "Feb 3 – Feb 9",   week0: 100, week1: 42, week2: 40, week3: 45, week4: null },
  { cohort: "Feb 10 – Feb 16", week0: 100, week1: 46, week2: 43, week3: null, week4: null },
  { cohort: "Feb 17 – Feb 23", week0: 100, week1: 41, week2: null, week3: null, week4: null },
  { cohort: "Feb 24 – Mar 2",  week0: 100, week1: null, week2: null, week3: null, week4: null },
];

const RETENTION_BY_INTENT = [
  { intent: "Roleplay",             sessions: 812, avgQuality: 68, week1: 48, week4: 52 },
  { intent: "Emotional Support",    sessions: 504, avgQuality: 59, week1: 38, week4: 36 },
  { intent: "Casual Chat",          sessions: 421, avgQuality: 52, week1: 35, week4: 33 },
  { intent: "Creative Storytelling", sessions: 337, avgQuality: 71, week1: 51, week4: 55 },
  { intent: "Knowledge Q&A",        sessions: 226, avgQuality: 45, week1: 28, week4: 24 },
  { intent: "Language Practice",     sessions: 189, avgQuality: 63, week1: 42, week4: 40 },
  { intent: "Gaming Companion",     sessions: 156, avgQuality: 66, week1: 45, week4: 47 },
];

const RETENTION_BY_CHARACTER = [
  { type: "Anime/Fiction",      sessions: 755, week1: 49, week4: 53 },
  { type: "Original Character", sessions: 433, week1: 44, week4: 46 },
  { type: "Romantic Partner",   sessions: 312, week1: 42, week4: 44 },
  { type: "Therapist/Advisor",  sessions: 267, week1: 36, week4: 32 },
  { type: "Celebrity",          sessions: 198, week1: 30, week4: 26 },
  { type: "Game Character",     sessions: 176, week1: 46, week4: 48 },
  { type: "Historical Figure",  sessions: 89,  week1: 33, week4: 29 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US");
const retColor = (v: number | null) => {
  if (v === null) return "";
  if (v >= 50) return "text-emerald-400";
  if (v >= 40) return "text-amber-400";
  return "text-red-400";
};
const cellBg = (v: number | null) => {
  if (v === null) return "bg-white/[0.02]";
  if (v >= 50) return "bg-emerald-500/20";
  if (v >= 45) return "bg-emerald-500/10";
  if (v >= 40) return "bg-amber-500/10";
  return "bg-red-500/10";
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RetentionPage() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Back + Title */}
      <div>
        <a href="/" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          ← Overview
        </a>
        <h1 className="text-2xl font-bold text-white mt-1">
          Retention <span className="text-zinc-500 font-normal">·</span>{" "}
          <span className="text-indigo-400">Week 4: 45%</span>
        </h1>
      </div>

      {/* Hero Chart — Retention Curve */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Retention Curve</p>
        <p className="text-xs text-zinc-600 mb-4">% of users returning at each time interval</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={RETENTION_CURVE} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Retention"]} />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#retGrad)"
                dot={{ fill: ACCENT, r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: ACCENT, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cohort Heatmap */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Cohort Retention Heatmap</p>
          <p className="text-xs text-zinc-600">Weekly cohorts showing retention % at each week</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Cohort</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week 0</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week 1</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week 2</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week 3</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week 4</th>
              </tr>
            </thead>
            <tbody>
              {COHORT_DATA.map((row) => (
                <tr key={row.cohort} className="border-b border-white/[0.03]">
                  <td className="px-5 py-2.5 text-zinc-300 font-medium">{row.cohort}</td>
                  {[row.week0, row.week1, row.week2, row.week3, row.week4].map((val, i) => (
                    <td key={i} className={`px-3 py-2.5 text-center font-mono ${cellBg(val)} ${val === null ? "text-zinc-700" : retColor(val)}`}>
                      {val === null ? "—" : `${val}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two-column: By Intent + By Character Type */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Retention by Intent */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Retention by Intent</p>
            <p className="text-xs text-zinc-600">Week 1 & Week 4 retention by conversation intent</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sessions</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Avg Qual</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Wk 1</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Wk 4</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_BY_INTENT.map((row) => (
                  <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-zinc-300">{row.intent}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{fmt(row.sessions)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{row.avgQuality}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${retColor(row.week1)}`}>{row.week1}%</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${retColor(row.week4)}`}>{row.week4}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Retention by Character Type */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Retention by Character Type</p>
            <p className="text-xs text-zinc-600">Week 1 & Week 4 retention by character category</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Type</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sessions</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Wk 1</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Wk 4</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_BY_CHARACTER.map((row) => (
                  <tr key={row.type} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-zinc-300">{row.type}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{fmt(row.sessions)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${retColor(row.week1)}`}>{row.week1}%</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${retColor(row.week4)}`}>{row.week4}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Insight Callout */}
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-5 py-4">
        <div className="flex items-start gap-2.5">
          <span className="text-indigo-400 text-sm shrink-0 mt-0.5">&#9733;</span>
          <div>
            <p className="text-sm font-semibold text-indigo-200 mb-1">Retention Insight</p>
            <p className="text-xs text-indigo-300/70 leading-relaxed">
              Creative Storytelling and Gaming Companion show <span className="text-indigo-300 font-semibold">improving</span> retention from Week 1 to Week 4,
              suggesting users who engage deeply in narrative-driven experiences form stronger habits.
              Emotional Support and Celebrity characters see <span className="text-red-400 font-semibold">declining</span> retention — prioritize quality improvements there.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
