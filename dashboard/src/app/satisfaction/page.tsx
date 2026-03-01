"use client";

import {
  AreaChart, Area, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#f59e0b";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

const SATISFACTION_DAILY = (() => {
  const base = [53, 52, 54, 53, 51, 52, 53, 51, 50, 52, 51, 53, 52, 50, 51, 50, 52, 51, 49, 50, 51, 50, 49, 51, 50, 49, 50, 51, 50, 50];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

const DISTRIBUTION = [
  { key: "satisfied",  label: "Satisfied",  count: 1190, pct: 50, color: "#22c55e" },
  { key: "neutral",    label: "Neutral",    count: 714,  pct: 30, color: "#71717a" },
  { key: "frustrated", label: "Frustrated", count: 357,  pct: 15, color: "#f59e0b" },
  { key: "abandoned",  label: "Abandoned",  count: 119,  pct: 5,  color: "#ef4444" },
];

const SIGNAL_BREAKDOWN = [
  { key: "long_replies",       label: "Long, detailed replies",        emoji: "&#x1F4AC;", count: 892, pct: 37, sentiment: "positive", color: "#22c55e" },
  { key: "follow_up_questions", label: "Asked follow-up questions",     emoji: "&#x2753;",  count: 756, pct: 32, sentiment: "positive", color: "#22c55e" },
  { key: "session_return",     label: "Returned within 24h",           emoji: "&#x1F504;", count: 634, pct: 27, sentiment: "positive", color: "#22c55e" },
  { key: "positive_language",  label: "Used positive language",        emoji: "&#x1F60A;", count: 521, pct: 22, sentiment: "positive", color: "#22c55e" },
  { key: "short_replies",      label: "Gave 1–2 word replies",         emoji: "&#x1F4AD;", count: 412, pct: 17, sentiment: "negative", color: "#ef4444" },
  { key: "topic_switch",       label: "Abruptly switched topics",      emoji: "&#x1F500;", count: 298, pct: 13, sentiment: "negative", color: "#ef4444" },
  { key: "session_abandon",    label: "Abandoned mid-conversation",    emoji: "&#x1F6AA;", count: 187, pct: 8,  sentiment: "negative", color: "#ef4444" },
  { key: "negative_language",  label: "Used frustrated language",      emoji: "&#x1F621;", count: 143, pct: 6,  sentiment: "negative", color: "#ef4444" },
];

const SAT_BY_INTENT = [
  { intent: "Creative Storytelling", sessions: 337, satisfied: 62, neutral: 24, frustrated: 10, abandoned: 4 },
  { intent: "Roleplay",             sessions: 812, satisfied: 56, neutral: 28, frustrated: 12, abandoned: 4 },
  { intent: "Gaming Companion",     sessions: 156, satisfied: 54, neutral: 30, frustrated: 12, abandoned: 4 },
  { intent: "Casual Chat",          sessions: 421, satisfied: 48, neutral: 32, frustrated: 14, abandoned: 6 },
  { intent: "Language Practice",     sessions: 189, satisfied: 47, neutral: 33, frustrated: 15, abandoned: 5 },
  { intent: "Emotional Support",    sessions: 504, satisfied: 42, neutral: 24, frustrated: 26, abandoned: 8 },
  { intent: "Knowledge Q&A",        sessions: 226, satisfied: 40, neutral: 35, frustrated: 18, abandoned: 7 },
  { intent: "Debate / Argument",    sessions: 134, satisfied: 38, neutral: 30, frustrated: 24, abandoned: 8 },
  { intent: "NSFW / Adult",         sessions: 298, satisfied: 52, neutral: 28, frustrated: 14, abandoned: 6 },
];

const SAT_BY_CHARACTER = [
  { character: "Sakura-chan",          sessions: 312, satisfied: 58, frustrated: 14 },
  { character: "Captain Drake",       sessions: 198, satisfied: 61, frustrated: 11 },
  { character: "Shadow Knight Kael",  sessions: 245, satisfied: 52, frustrated: 16 },
  { character: "Nyx (shadow entity)", sessions: 134, satisfied: 55, frustrated: 13 },
  { character: "Dark Lord Zephyr",    sessions: 98,  satisfied: 56, frustrated: 12 },
  { character: "Ember Rose",          sessions: 112, satisfied: 53, frustrated: 15 },
  { character: "Alex (boyfriend)",    sessions: 143, satisfied: 47, frustrated: 19 },
  { character: "Luna the Wolf",       sessions: 187, satisfied: 49, frustrated: 18 },
  { character: "Dr. Elena",           sessions: 156, satisfied: 42, frustrated: 24 },
  { character: "AI Taylor",           sessions: 128, satisfied: 38, frustrated: 28 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US");
const satColor = (v: number) => v >= 55 ? "text-emerald-400" : v >= 45 ? "text-amber-400" : "text-red-400";
const frustColor = (v: number) => v >= 20 ? "text-red-400" : v >= 15 ? "text-amber-400" : "text-zinc-400";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SatisfactionPage() {
  const donutData = DISTRIBUTION.map(d => ({ name: d.label, value: d.count, fill: d.color }));
  const positiveSignals = SIGNAL_BREAKDOWN.filter(s => s.sentiment === "positive");
  const negativeSignals = SIGNAL_BREAKDOWN.filter(s => s.sentiment === "negative");
  const maxSignalCount = SIGNAL_BREAKDOWN[0].count;

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Back + Title */}
      <div>
        <a href="/" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
          ← Overview
        </a>
        <h1 className="text-2xl font-bold text-white mt-1">
          Satisfaction <span className="text-zinc-500 font-normal">·</span>{" "}
          <span className="text-amber-400">50% inferred satisfied</span>{" "}
          <span className="text-red-400 text-lg font-normal">↓ 2pp</span>
        </h1>
      </div>

      {/* Hero Chart — Daily Satisfaction Rate */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Daily Satisfaction Rate</p>
        <p className="text-xs text-zinc-600 mb-4">% of conversations inferred as satisfied</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={SATISFACTION_DAILY} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [`${v ?? 0}%`, "Satisfied"]} />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#satGrad)"
                dot={false} activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: 97% Coverage + Distribution Donut */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.08] p-5">
          <p className="text-5xl font-black text-indigo-300 leading-none">97%</p>
          <p className="text-sm font-semibold text-indigo-200 mt-1.5">of conversations analyzed</p>
          <p className="text-xs text-indigo-400/60 mt-0.5">via behavioral signal inference — no surveys required</p>
          <div className="mt-4 pt-4 border-t border-indigo-500/20 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-500">3%</span>
            <span className="text-xs text-zinc-600">explicit feedback (industry avg)</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Distribution</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={40} outerRadius={62} strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE}
                  formatter={(v: number | undefined, name: string | undefined) => [
                    `${v ?? 0} (${Math.round(((v ?? 0) / 2380) * 100)}%)`, name ?? "",
                  ]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {DISTRIBUTION.map(d => (
                <div key={d.key} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-zinc-300 w-20">{d.label}</span>
                  <span className="text-xs font-mono text-zinc-400 font-semibold">{d.pct}%</span>
                  <span className="text-[10px] font-mono text-zinc-600">({fmt(d.count)})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Signal Breakdown */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Signal Breakdown</p>
        <p className="text-xs text-zinc-600 mb-5">Behavioral signals used to infer satisfaction</p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Positive signals */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70 mb-3">Positive Signals</p>
            <div className="space-y-3">
              {positiveSignals.map(sig => {
                const pct = maxSignalCount > 0 ? (sig.count / maxSignalCount) * 100 : 0;
                return (
                  <div key={sig.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-zinc-300" dangerouslySetInnerHTML={{ __html: `${sig.emoji} ${sig.label}` }} />
                      <span className="text-xs font-mono text-zinc-500">{fmt(sig.count)} ({sig.pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sig.color + "88" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Negative signals */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500/70 mb-3">Negative Signals</p>
            <div className="space-y-3">
              {negativeSignals.map(sig => {
                const pct = maxSignalCount > 0 ? (sig.count / maxSignalCount) * 100 : 0;
                return (
                  <div key={sig.key}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-zinc-300" dangerouslySetInnerHTML={{ __html: `${sig.emoji} ${sig.label}` }} />
                      <span className="text-xs font-mono text-zinc-500">{fmt(sig.count)} ({sig.pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sig.color + "88" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Satisfaction by Intent */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Satisfaction by Intent</p>
          <p className="text-xs text-zinc-600">Sorted by satisfied %, with frustration % column</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sessions</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Satisfied</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Neutral</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Frustrated</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Abandoned</th>
              </tr>
            </thead>
            <tbody>
              {[...SAT_BY_INTENT].sort((a, b) => b.satisfied - a.satisfied).map((row) => (
                <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.intent}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{fmt(row.sessions)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${satColor(row.satisfied)}`}>{row.satisfied}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{row.neutral}%</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${frustColor(row.frustrated)}`}>{row.frustrated}%</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-600">{row.abandoned}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Satisfaction by Character */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Satisfaction by Character</p>
          <p className="text-xs text-zinc-600">Top 10 characters by session volume</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Character</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sessions</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Satisfied</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Frustrated</th>
              </tr>
            </thead>
            <tbody>
              {SAT_BY_CHARACTER.map((row) => (
                <tr key={row.character} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.character}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{fmt(row.sessions)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${satColor(row.satisfied)}`}>{row.satisfied}%</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${frustColor(row.frustrated)}`}>{row.frustrated}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
