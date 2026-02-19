"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
  ReferenceLine,
} from "recharts";

interface SampleFailed {
  preview: string;
  quality_score: number | null;
  completion_status: string | null;
  created_at: string;
}

interface IntentData {
  intent: string;
  count: number;
  countThisWeek: number;
  failedThisWeek: number;
  avgScore: number | null;
  completionRate: number;
  failureRate: number;
  buckets: [number, number, number, number];
  sampleFailed: SampleFailed[];
}

// Quadrant color for scatter dot
function dotColor(quality: number, completionRate: number): string {
  const highQ = quality >= 60;
  const highC = completionRate >= 50;
  if (highQ  && highC)  return "#10b981"; // Working Well — green
  if (!highQ && highC)  return "#eab308"; // UX Problem  — yellow
  if (!highQ && !highC) return "#ef4444"; // Fix First   — red
  return "#3b82f6";                        // Fragile     — blue
}

// Severity label for the priority list
function severityLabel(intent: IntentData): { label: string; cls: string } {
  if (intent.completionRate < 30 || (intent.avgScore !== null && intent.avgScore < 45)) {
    return { label: "Critical", cls: "bg-red-500/15 text-red-400" };
  }
  if (intent.completionRate < 50 || (intent.avgScore !== null && intent.avgScore < 60)) {
    return { label: "High",     cls: "bg-amber-500/15 text-amber-400" };
  }
  return { label: "Medium", cls: "bg-zinc-500/15 text-zinc-400" };
}

function scoreColor(s: number | null) {
  if (s === null) return "text-zinc-600";
  if (s > 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  return "text-red-400";
}

// ── Hardcoded root causes (demo) ─────────────────────────────────────────────
const ROOT_CAUSES: Record<string, string> = {
  fix_break_loop:  "AI fixes one bug but introduces new bugs in adjacent code. Users retry 3+ times then give up.",
  connect_api:     "AI hallucinates API endpoints and auth methods for non-Supabase services.",
  make_responsive: "AI interprets 'fix mobile' as desktop layout changes, ignoring viewport.",
  fix_bug:         "AI patches symptoms without understanding the underlying architecture, causing cascading breaks.",
};

// Custom scatter tooltip
function ScatterTip({ payload }: { payload?: Array<{ payload: { intent: string; x: number; y: number; z: number } }> }) {
  if (!payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1e1f2b] border border-white/[0.08] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-zinc-200 mb-1 capitalize">
        {d.intent.replace(/_/g, " ")}
      </p>
      <p className="text-xs text-zinc-400">
        Quality <span className="text-zinc-200">{d.x}</span>
        {" · "}Success <span className="text-zinc-200">{d.y}%</span>
        {" · "}Vol <span className="text-zinc-200">{d.z}</span>
      </p>
    </div>
  );
}

export default function QualityPage() {
  const [intents,    setIntents]    = useState<IntentData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/quality");
        const data = await res.json();
        setIntents(data.intents ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Priority list: below 50% completion OR below 60 quality
  const priority = intents
    .filter((i) => i.completionRate < 50 || (i.avgScore !== null && i.avgScore < 60))
    .sort((a, b) => {
      // Sort by: critical first, then failedThisWeek desc
      const aScore = (a.avgScore ?? 100) + a.completionRate;
      const bScore = (b.avgScore ?? 100) + b.completionRate;
      if (aScore !== bScore) return aScore - bScore; // lower combined = worse
      return b.failedThisWeek - a.failedThisWeek;
    });

  // Scatter data
  const scatterData = intents
    .filter((i) => i.avgScore !== null)
    .map((i) => ({
      x:      i.avgScore!,
      y:      i.completionRate,
      z:      i.count,
      intent: i.intent,
    }));

  const counts   = scatterData.map((d) => d.z);
  const minCount = Math.min(...counts, 1);
  const maxCount = Math.max(...counts, 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-sm">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-semibold text-white mb-1">What To Fix Next</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Intents below 50% completion or below 60 avg quality — ranked by severity
      </p>

      {/* ── Priority list ── */}
      {priority.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#13141b] px-5 py-10 text-center text-zinc-600 text-sm mb-8">
          All intents are performing above threshold.
        </div>
      ) : (
        <div className="space-y-3 mb-10">
          {priority.map((row, i) => {
            const sev       = severityLabel(row);
            const revAtRisk = row.failedThisWeek * 35;
            const isOpen    = expanded === row.intent;

            return (
              <div
                key={row.intent}
                className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden"
              >
                {/* Main row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : row.intent)}
                  className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rank */}
                  <span className="shrink-0 w-6 text-sm font-semibold text-zinc-600 tabular-nums pt-0.5">
                    {i + 1}
                  </span>

                  {/* Intent + severity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span className="text-sm font-semibold text-white capitalize">
                        {row.intent.replace(/_/g, " ")}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.cls}`}>
                        {sev.label}
                      </span>
                    </div>

                    {/* Metrics row */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Success rate</span>
                        <span className={`font-semibold ${
                          row.completionRate >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {row.completionRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Avg quality</span>
                        <span className={`font-semibold ${scoreColor(row.avgScore)}`}>
                          {row.avgScore ?? "--"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Users affected / wk</span>
                        <span className="font-semibold text-zinc-200">{row.failedThisWeek}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-500">Revenue at risk</span>
                        <span className="font-semibold text-red-400">
                          ${revAtRisk.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Root cause */}
                    {ROOT_CAUSES[row.intent] && (
                      <p className="text-xs italic text-zinc-400 mb-3">
                        <span className="not-italic font-medium text-zinc-500">Root cause: </span>
                        {ROOT_CAUSES[row.intent]}
                      </p>
                    )}

                    {/* Sample previews */}
                    {row.sampleFailed.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {row.sampleFailed.map((s, si) => (
                          <div
                            key={si}
                            className="flex items-start gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5 max-w-xs"
                          >
                            <span className="text-zinc-600 text-xs mt-px shrink-0">"</span>
                            <p className="text-xs text-zinc-400 leading-snug line-clamp-2">
                              {s.preview || "(no message)"}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-700 italic">No failed conversation samples.</p>
                    )}
                  </div>

                  {/* Expand chevron */}
                  <span className={`shrink-0 text-zinc-600 text-xs transition-transform pt-1 ${isOpen ? "rotate-180" : ""}`}>
                    ▼
                  </span>
                </button>

                {/* Expanded detail: full preview text */}
                {isOpen && row.sampleFailed.length > 0 && (
                  <div className="border-t border-white/[0.05] px-5 py-4 space-y-3 bg-[#0f1015]">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                      Failed conversation samples
                    </p>
                    {row.sampleFailed.map((s, si) => (
                      <div key={si} className="flex gap-3">
                        <span className="shrink-0 text-xs text-zinc-600 tabular-nums pt-0.5 w-4">
                          {si + 1}.
                        </span>
                        <div>
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {s.preview || "(no message)"}
                          </p>
                          <div className="flex gap-3 mt-1">
                            <span className={`text-xs ${scoreColor(s.quality_score)}`}>
                              Quality {s.quality_score ?? "--"}
                            </span>
                            <span className="text-xs text-zinc-600">·</span>
                            <span className="text-xs text-zinc-500 capitalize">
                              {s.completion_status ?? "--"}
                            </span>
                            <span className="text-xs text-zinc-600">·</span>
                            <span className="text-xs text-zinc-600">
                              {new Date(s.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day:   "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scatter plot ── */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-1">
          Quality vs. Completion Rate
        </h2>
        <p className="text-xs text-zinc-600 mb-5">
          Each dot is an intent — size = conversation volume
        </p>

        {scatterData.length > 0 ? (
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ left: 16, right: 32, top: 24, bottom: 24 }}>
              {/* Quadrant backgrounds */}
              <ReferenceArea
                x1={0} x2={60} y1={50} y2={100}
                fill="rgba(234,179,8,0.04)"
                stroke="none"
                label={{ value: "UX Problem", fill: "#ca8a04", fontSize: 11, fontWeight: 600 }}
              />
              <ReferenceArea
                x1={60} x2={100} y1={50} y2={100}
                fill="rgba(16,185,129,0.04)"
                stroke="none"
                label={{ value: "Working Well", fill: "#059669", fontSize: 11, fontWeight: 600 }}
              />
              <ReferenceArea
                x1={0} x2={60} y1={0} y2={50}
                fill="rgba(239,68,68,0.05)"
                stroke="none"
                label={{ value: "Fix First", fill: "#dc2626", fontSize: 11, fontWeight: 600 }}
              />
              <ReferenceArea
                x1={60} x2={100} y1={0} y2={50}
                fill="rgba(59,130,246,0.04)"
                stroke="none"
                label={{ value: "Fragile", fill: "#2563eb", fontSize: 11, fontWeight: 600 }}
              />

              {/* Threshold lines */}
              <ReferenceLine
                x={60}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
              />
              <ReferenceLine
                y={50}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 4"
              />

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />

              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 100]}
                name="Quality"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: "Avg Quality Score",
                  position: "insideBottom",
                  offset: -10,
                  fill: "#52525b",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[0, 100]}
                name="Completion %"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                label={{
                  value: "Completion Rate %",
                  angle: -90,
                  position: "insideLeft",
                  offset: 12,
                  fill: "#52525b",
                  fontSize: 11,
                }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                domain={[minCount, maxCount]}
                range={[60, 500]}
              />
              <RechartsTooltip
                cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }}
                content={<ScatterTip />}
              />
              <Scatter data={scatterData} fillOpacity={0.85}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={dotColor(d.x, d.y)} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[420px] text-zinc-600 text-sm">
            No data
          </div>
        )}

        {/* Quadrant legend */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {[
            { color: "#10b981", label: "Working Well",  desc: "quality ≥ 60 & completion ≥ 50%" },
            { color: "#ef4444", label: "Fix First",     desc: "quality < 60 & completion < 50%" },
            { color: "#eab308", label: "UX Problem",    desc: "quality < 60 & completion ≥ 50%" },
            { color: "#3b82f6", label: "Fragile",       desc: "quality ≥ 60 & completion < 50%" },
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-medium text-zinc-300">{label}</span>
              <span className="text-xs text-zinc-600">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
