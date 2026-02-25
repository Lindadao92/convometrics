"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useTimeRange } from "@/lib/time-range-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DimensionResult {
  key: string; label: string; weight: number; color: string;
  scoreA: number; scoreB: number; delta: number; pValue: number;
  significant: boolean; direction: "improved" | "regressed" | "neutral";
}

interface RegressionItem {
  dimension: string; dimLabel: string;
  intent: string | null; intentLabel: string;
  scoreA: number; scoreB: number; delta: number;
  pValue: number; conversationsAffected: number | null;
  description: string;
}

interface SampleConvo {
  id: string; intent: string; intentLabel: string; model: string;
  overall: number; keyDim: string; keyDimLabel: string; keyDimScore: number;
  improvement?: number; regression?: number; snippet: string;
}

interface CompareData {
  modelA: string; modelB: string;
  countA: number; countB: number;
  overall: { scoreA: number; scoreB: number; delta: number };
  dimensions: DimensionResult[];
  regressions: RegressionItem[];
  improvements: RegressionItem[];
  samplesBetter: SampleConvo[];
  samplesWorse: SampleConvo[];
  recommendation: { summary: string; details: string; action: "approve" | "investigate" | "rollback"; actionLabel: string };
  availableModels: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: { background: "#1c1d28", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 },
};

function scoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 55) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function deltaColor(delta: number, significant: boolean) {
  if (!significant) return "#71717a";
  if (delta > 0) return "#22c55e";
  if (delta < 0) return "#ef4444";
  return "#71717a";
}

function PValueBadge({ p, significant }: { p: number; significant: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
      significant
        ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
        : "bg-white/[0.04] text-zinc-600 border border-white/[0.06]"
    }`}>
      p={p.toFixed(2)}{significant && " ✓"}
    </span>
  );
}

// ─── Section: Overview Banner ─────────────────────────────────────────────────

function OverviewBanner({ data }: { data: CompareData }) {
  const { overall, modelA, modelB, regressions, improvements, countA, countB } = data;
  const deltaPositive = overall.delta > 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6">
      <div className="flex flex-col xl:flex-row xl:items-center gap-6">
        {/* Score comparison */}
        <div className="flex items-center gap-6 flex-1">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{modelA}</p>
            <p className="text-5xl font-black tabular-nums" style={{ color: scoreColor(overall.scoreA) }}>{overall.scoreA}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{countA} convos</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className={`text-3xl font-bold ${deltaPositive ? "text-emerald-400" : "text-red-400"}`}>
              {deltaPositive ? "+" : ""}{overall.delta}
            </span>
            <span className="text-zinc-600 text-lg">→</span>
            <span className="text-[10px] text-zinc-600">overall</span>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{modelB}</p>
            <p className="text-5xl font-black tabular-nums" style={{ color: scoreColor(overall.scoreB) }}>{overall.scoreB}</p>
            <p className="text-[10px] text-zinc-600 mt-1">{countB} convos</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex xl:flex-col gap-3">
          {regressions.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.08] px-3 py-2">
              <span className="text-amber-400">⚠</span>
              <span className="text-sm font-medium text-amber-200">
                {regressions.length} regression{regressions.length > 1 ? "s" : ""} detected
              </span>
            </div>
          )}
          {improvements.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2">
              <span className="text-emerald-400">✓</span>
              <span className="text-sm font-medium text-emerald-200">
                {improvements.length} improvement{improvements.length > 1 ? "s" : ""} detected
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Dimension Comparison ───────────────────────────────────────────

function DimensionComparison({ data }: { data: CompareData }) {
  const { dimensions, modelA, modelB } = data;

  const chartData = dimensions.map((d) => ({
    name: d.label,
    [modelA]: d.scoreA,
    [modelB]: d.scoreB,
    color: d.color,
  }));

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-0.5">
        Dimension Comparison
      </p>
      <p className="text-xs text-zinc-600 mb-5">
        Side-by-side scores across all 7 quality dimensions
      </p>

      {/* Grouped Bar Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "#52525b", fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}/100`, ""]} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#71717a", paddingTop: 12 }}
            formatter={(val) => <span style={{ color: "#a1a1aa" }}>{val}</span>}
          />
          <Bar dataKey={modelA} fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={24} />
          <Bar dataKey={modelB} fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>

      {/* Detail table */}
      <div className="mt-5 border-t border-white/[0.05] pt-4">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 pb-2 border-b border-white/[0.04]">
          <span>Dimension</span>
          <span className="text-right">{modelA}</span>
          <span className="text-right">{modelB}</span>
          <span className="text-right">Delta</span>
          <span className="text-right">Significance</span>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {dimensions.map((d) => {
            const dc = deltaColor(d.delta, d.significant);
            const arrow = d.delta > 0 ? "↑" : d.delta < 0 ? "↓" : "→";
            return (
              <div key={d.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 py-2.5 items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-zinc-300">{d.label}</span>
                </div>
                <span className="text-sm font-mono text-right" style={{ color: scoreColor(d.scoreA) }}>{d.scoreA}</span>
                <span className="text-sm font-mono text-right" style={{ color: scoreColor(d.scoreB) }}>{d.scoreB}</span>
                <span className="text-sm font-mono font-semibold text-right" style={{ color: dc }}>
                  {arrow}{Math.abs(d.delta)}
                </span>
                <div className="flex justify-end">
                  <PValueBadge p={d.pValue} significant={d.significant} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Regression / Improvement Cards ─────────────────────────────────

function FindingCard({ item, type }: { item: RegressionItem; type: "regression" | "improvement" }) {
  const isReg = type === "regression";
  return (
    <div className={`rounded-xl border p-4 ${isReg ? "border-red-500/20 bg-red-500/[0.05]" : "border-emerald-500/20 bg-emerald-500/[0.05]"}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${isReg ? "text-red-400/70" : "text-emerald-400/70"}`}>
            {isReg ? "⚠ Regression" : "✓ Improvement"}
          </span>
          <p className="text-sm font-semibold text-white mt-0.5">
            {item.intentLabel} × {item.dimLabel}
          </p>
        </div>
        <PValueBadge p={item.pValue} significant={item.pValue < 0.05} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl font-bold font-mono" style={{ color: scoreColor(item.scoreA) }}>{item.scoreA}</span>
        <span className="text-zinc-600">→</span>
        <span className="text-xl font-bold font-mono" style={{ color: scoreColor(item.scoreB) }}>{item.scoreB}</span>
        <span className={`text-lg font-bold font-mono ${isReg ? "text-red-400" : "text-emerald-400"}`}>
          ({item.delta > 0 ? "+" : ""}{item.delta} pts)
        </span>
      </div>

      {item.conversationsAffected && (
        <p className="text-xs text-zinc-500 mb-2">
          {item.conversationsAffected} conversations affected
        </p>
      )}

      <p className="text-xs text-zinc-400 leading-relaxed">{item.description}</p>
    </div>
  );
}

// ─── Section: Sample Conversations ───────────────────────────────────────────

function SampleCard({ sample, type }: { sample: SampleConvo; type: "better" | "worse" }) {
  const isBetter = type === "better";
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#0f1018] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-zinc-600">{sample.id}</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border bg-white/[0.03] border-white/[0.06] text-zinc-400">
          {sample.intentLabel}
        </span>
      </div>
      <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{sample.snippet}</p>
      <div className="flex items-center gap-4 text-xs font-mono">
        <span>
          <span className="text-zinc-600">Overall </span>
          <span style={{ color: scoreColor(sample.overall) }}>{sample.overall}</span>
        </span>
        <span>
          <span className="text-zinc-600">{sample.keyDimLabel} </span>
          <span style={{ color: isBetter ? "#22c55e" : "#ef4444" }}>{sample.keyDimScore}</span>
        </span>
        {isBetter && sample.improvement !== undefined && (
          <span className="text-emerald-400">+{sample.improvement} pts</span>
        )}
        {!isBetter && sample.regression !== undefined && (
          <span className="text-red-400">−{sample.regression} pts</span>
        )}
      </div>
    </div>
  );
}

// ─── Section: Recommendation ─────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: CompareData["recommendation"] }) {
  const borderClass =
    rec.action === "approve"      ? "border-emerald-500/30" :
    rec.action === "investigate"  ? "border-amber-500/30" :
                                    "border-red-500/30";
  const bgClass =
    rec.action === "approve"      ? "bg-emerald-500/[0.06]" :
    rec.action === "investigate"  ? "bg-amber-500/[0.06]" :
                                    "bg-red-500/[0.06]";
  const badgeClass =
    rec.action === "approve"      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/20" :
    rec.action === "investigate"  ? "bg-amber-500/20 text-amber-300 border-amber-500/20" :
                                    "bg-red-500/20 text-red-300 border-red-500/20";
  const icon =
    rec.action === "approve"      ? "✓" :
    rec.action === "investigate"  ? "⚠" : "✕";

  return (
    <div className={`rounded-xl border ${borderClass} ${bgClass} p-6`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Net Recommendation</p>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${badgeClass}`}>
          {icon} {rec.actionLabel}
        </span>
      </div>
      <p className="text-base font-semibold text-white mb-3">{rec.summary}</p>
      <p className="text-sm text-zinc-400 leading-relaxed">{rec.details}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const [modelA, setModelA] = useState("Flash");
  const [modelB, setModelB] = useState("Brainiac");
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const { effectiveDays } = useTimeRange();

  const fetchData = useCallback((a: string, b: string) => {
    setLoading(true);
    fetch(`/api/model-comparison?modelA=${a}&modelB=${b}&days=${effectiveDays}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [effectiveDays]);

  useEffect(() => { fetchData(modelA, modelB); }, [effectiveDays]);

  function handleChange(a: string, b: string) {
    setModelA(a);
    setModelB(b);
    fetchData(a, b);
  }

  const models = data?.availableModels ?? ["Brainiac", "Prime", "Flash"];

  return (
    <div className="p-8 max-w-6xl space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-end gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Model Comparison</h1>
          {data && (
            <p className="text-sm text-zinc-500 mt-1">
              Comparing {data.countA.toLocaleString()} vs {data.countB.toLocaleString()} conversations
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Model A</span>
            <select
              value={modelA}
              onChange={(e) => handleChange(e.target.value, modelB)}
              className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <span className="text-zinc-600">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Model B</span>
            <select
              value={modelB}
              onChange={(e) => handleChange(modelA, e.target.value)}
              className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
            >
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && !data && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6 text-center">
          <p className="text-red-300 text-sm">Failed to load comparison data.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Section 1: Overview Banner ─────────────────────────────────── */}
          <OverviewBanner data={data} />

          {/* ── Section 2: Dimension Comparison ───────────────────────────── */}
          <DimensionComparison data={data} />

          {/* ── Section 3: Regressions ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500/80" />
              <h2 className="text-sm font-semibold text-zinc-300">Where Did It Get Worse?</h2>
              <span className="text-[10px] text-zinc-600 ml-1">{data.modelB} regressions vs {data.modelA}</span>
            </div>
            {data.regressions.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-5 text-center">
                <span className="text-emerald-400 text-sm">No regressions detected — {data.modelB} holds or improves all dimensions.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.regressions.map((r, i) => (
                  <FindingCard key={i} item={r} type="regression" />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 4: Improvements ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
              <h2 className="text-sm font-semibold text-zinc-300">Where Did It Get Better?</h2>
              <span className="text-[10px] text-zinc-600 ml-1">{data.modelB} improvements vs {data.modelA}</span>
            </div>
            {data.improvements.length === 0 ? (
              <div className="rounded-xl border border-zinc-700/20 bg-white/[0.02] p-5 text-center">
                <span className="text-zinc-600 text-sm">No significant improvements detected.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.improvements.map((r, i) => (
                  <FindingCard key={i} item={r} type="improvement" />
                ))}
              </div>
            )}
          </div>

          {/* ── Section 5: Sample Conversations ───────────────────────────── */}
          {(data.samplesBetter.length > 0 || data.samplesWorse.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                  {data.modelB} outperforms
                </p>
                <div className="space-y-3">
                  {data.samplesBetter.map((s) => (
                    <SampleCard key={s.id} sample={s} type="better" />
                  ))}
                  {data.samplesBetter.length === 0 && (
                    <p className="text-xs text-zinc-700 italic">No samples available</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
                  {data.modelA} held the edge
                </p>
                <div className="space-y-3">
                  {data.samplesWorse.map((s) => (
                    <SampleCard key={s.id} sample={s} type="worse" />
                  ))}
                  {data.samplesWorse.length === 0 && (
                    <p className="text-xs text-zinc-700 italic">No samples available</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Section 6: Recommendation ──────────────────────────────────── */}
          <RecommendationCard rec={data.recommendation} />
        </>
      )}
    </div>
  );
}
