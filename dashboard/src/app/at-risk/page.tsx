"use client";

import {
  AreaChart, Area, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#ef4444";

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1a1b23", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#a1a1aa" },
  itemStyle: { color: "#e4e4e7" },
};

const ATRISK_DAILY = (() => {
  const base = [72, 74, 71, 75, 78, 76, 79, 77, 80, 78, 81, 79, 82, 80, 83, 81, 84, 82, 85, 83, 86, 84, 85, 86, 84, 87, 85, 88, 86, 87];
  return base.map((v, i) => {
    const d = new Date("2026-01-25"); d.setDate(d.getDate() + i);
    return { label: d.toISOString().slice(5, 10), value: v };
  });
})();

const ATRISK_BY_INTENT = [
  { intent: "Emotional Support",    atRisk: 41, pctOfTotal: 47, topFailure: "Tone break",     avgQuality: 52 },
  { intent: "Roleplay",             atRisk: 29, pctOfTotal: 33, topFailure: "Character break", avgQuality: 58 },
  { intent: "Knowledge Q&A",        atRisk: 8,  pctOfTotal: 9,  topFailure: "Hallucination",   avgQuality: 41 },
  { intent: "Casual Chat",          atRisk: 6,  pctOfTotal: 7,  topFailure: "Repetition",       avgQuality: 48 },
  { intent: "Creative Storytelling", atRisk: 3,  pctOfTotal: 3,  topFailure: "Context loss",    avgQuality: 55 },
];

const ATRISK_BY_FAILURE = [
  { key: "tone_break",      icon: "&#x1F3AD;", label: "Tone Break",       count: 34, pct: 39 },
  { key: "character_break", icon: "&#x1F9D1;", label: "Character Break",  count: 22, pct: 25 },
  { key: "repetition",      icon: "&#x1F504;", label: "Repetition Loop",  count: 14, pct: 16 },
  { key: "context_loss",    icon: "&#x1F4AD;", label: "Context Loss",     count: 9,  pct: 10 },
  { key: "hallucination",   icon: "&#x26A0;",  label: "Hallucination",    count: 5,  pct: 6 },
  { key: "safety_refusal",  icon: "&#x1F6D1;", label: "Safety Refusal",   count: 3,  pct: 3 },
];

const ATRISK_BY_CHARACTER = [
  { type: "Therapist/Advisor",  atRisk: 28, pctFrustrated: 34 },
  { type: "Romantic Partner",   atRisk: 19, pctFrustrated: 26 },
  { type: "Anime/Fiction",      atRisk: 15, pctFrustrated: 14 },
  { type: "Celebrity",          atRisk: 12, pctFrustrated: 31 },
  { type: "Original Character", atRisk: 8,  pctFrustrated: 16 },
  { type: "Game Character",     atRisk: 5,  pctFrustrated: 12 },
];

const RECOVERY_DATA = [
  { week: "Jan 27 – Feb 2",  atRisk: 74, recovered: 18, recoveryRate: 24 },
  { week: "Feb 3 – Feb 9",   atRisk: 79, recovered: 21, recoveryRate: 27 },
  { week: "Feb 10 – Feb 16", atRisk: 82, recovered: 19, recoveryRate: 23 },
  { week: "Feb 17 – Feb 23", atRisk: 85, recovered: 22, recoveryRate: 26 },
  { week: "Feb 24 – Mar 2",  atRisk: 87, recovered: 20, recoveryRate: 23 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US");

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AtRiskPage() {
  const failureBarData = ATRISK_BY_FAILURE.map(f => ({
    label: f.label,
    count: f.count,
  }));

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Back + Title */}
      <div>
        <a href="/" className="text-xs text-red-400 hover:text-red-300 transition-colors">
          ← Overview
        </a>
        <h1 className="text-2xl font-bold text-white mt-1">
          At-Risk Users <span className="text-zinc-500 font-normal">·</span>{" "}
          <span className="text-red-400">87 DAUs this week</span>
        </h1>
      </div>

      {/* Definition card */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 flex items-start gap-3">
        <span className="text-red-400 text-base shrink-0 mt-0.5">&#x26A0;</span>
        <div>
          <p className="text-sm font-semibold text-red-200">Definition</p>
          <p className="text-xs text-red-300/70 mt-0.5">Users with 2+ frustrated sessions in the past 7 days. These users are at high risk of churning.</p>
        </div>
      </div>

      {/* Hero Chart — Daily At-Risk DAU Count */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Daily At-Risk DAU Count</p>
        <p className="text-xs text-zinc-600 mb-4">Number of at-risk daily active users over 30 days</p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ATRISK_DAILY} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis domain={[0, 150]} tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [v ?? 0, "At-risk DAUs"]} />
              <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2.5} fill="url(#riskGrad)"
                dot={false} activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-column: Top Failures BarChart + At-Risk by Intent */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Failures */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Top Failures Driving Risk</p>
          <p className="text-xs text-zinc-600 mb-4">Failure types among at-risk user sessions</p>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={failureBarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="label" type="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number | undefined) => [v ?? 0, "Users"]} />
                <Bar dataKey="count" fill={ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* At-Risk by Intent */}
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">At-Risk by Intent</p>
            <p className="text-xs text-zinc-600">Which conversation intents produce at-risk users</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intent</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">At Risk</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">% Total</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Top Failure</th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Avg Qual</th>
                </tr>
              </thead>
              <tbody>
                {ATRISK_BY_INTENT.map((row) => (
                  <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-2.5 text-zinc-300">{row.intent}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-red-400 font-semibold">{row.atRisk}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-zinc-500">{row.pctOfTotal}%</td>
                    <td className="px-3 py-2.5 text-zinc-400">{row.topFailure}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${row.avgQuality < 50 ? "text-red-400" : "text-amber-400"}`}>{row.avgQuality}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* At-Risk by Character Type */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">At-Risk by Character Type</p>
          <p className="text-xs text-zinc-600">Which character types have the most at-risk users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Type</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">At-Risk Users</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Frustrated %</th>
              </tr>
            </thead>
            <tbody>
              {ATRISK_BY_CHARACTER.map((row) => (
                <tr key={row.type} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.type}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-400 font-semibold">{row.atRisk}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.pctFrustrated >= 25 ? "text-red-400" : row.pctFrustrated >= 15 ? "text-amber-400" : "text-zinc-400"}`}>
                    {row.pctFrustrated}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recovery Tracking */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">Recovery Tracking</p>
          <p className="text-xs text-zinc-600">Weekly at-risk count, recovered users, and recovery rate</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Week</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">At-Risk</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recovered</th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Recovery Rate</th>
              </tr>
            </thead>
            <tbody>
              {RECOVERY_DATA.map((row) => (
                <tr key={row.week} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 text-zinc-300">{row.week}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-red-400">{row.atRisk}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{row.recovered}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${row.recoveryRate >= 25 ? "text-emerald-400" : "text-amber-400"}`}>
                    {row.recoveryRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insight Callout */}
      <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
        <div className="flex items-start gap-2.5">
          <span className="text-red-400 text-sm shrink-0 mt-0.5">&#9733;</span>
          <div>
            <p className="text-sm font-semibold text-red-200 mb-1">Recovery Insight</p>
            <p className="text-xs text-red-300/70 leading-relaxed">
              Recovery rate has been stable at ~24% — roughly 1 in 4 at-risk users recovers each week.
              The at-risk pool is <span className="text-red-300 font-semibold">growing faster than recovery</span>,
              meaning net at-risk users increase week over week. Fixing tone_break in emotional_support could
              reduce inflow by an estimated <span className="text-red-300 font-semibold">~15 users/week</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
