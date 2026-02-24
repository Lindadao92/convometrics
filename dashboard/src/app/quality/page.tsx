"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  chatgpt: "#10A37F", claude: "#D97706", gemini: "#4285F4",
  grok: "#EF4444", perplexity: "#8B5CF6",
};
const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  grok: "Grok", perplexity: "Perplexity",
};
const PLATFORMS = ["all", "chatgpt", "claude", "gemini", "grok", "perplexity"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SampleFailed { preview: string; id: string; }
interface IntentData {
  intent: string; count: number; avgScore: number | null; completionRate: number;
  failureRate: number; buckets: [number, number, number, number];
  sampleFailed: SampleFailed[]; topPlatform: string | null;
}
interface ApiData { intents: IntentData[]; maxBucket: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(s: string) { return s.replace(/_/g, " "); }
function fmt(n: number) { return n.toLocaleString(); }

function Bone({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />;
}
function LoadingSkeleton() {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      <Bone className="h-7 w-40" />
      <Bone className="h-[360px] rounded-xl" />
      <Bone className="h-64 rounded-xl" />
    </div>
  );
}

// ─── Custom scatter tooltip ───────────────────────────────────────────────────

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: { payload: IntentData & { x: number; y: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#1c1d28] border border-white/[0.08] rounded-xl p-3 text-xs space-y-1 shadow-2xl">
      <p className="font-semibold text-white capitalize">{cap(d.intent)}</p>
      <p className="text-zinc-400">Quality: <span className="text-white font-mono">{d.avgScore ?? "—"}</span></p>
      <p className="text-zinc-400">Completion: <span className="text-white font-mono">{d.completionRate}%</span></p>
      <p className="text-zinc-400">Volume: <span className="text-white font-mono">{fmt(d.count)}</span></p>
      {d.topPlatform && (
        <p className="text-zinc-400">Platform: <span style={{ color: PLATFORM_COLORS[d.topPlatform] }}>{PLATFORM_LABELS[d.topPlatform] ?? d.topPlatform}</span></p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QualityIntent() {
  const [platform, setPlatform] = useState("all");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = `/api/quality${platform !== "all" ? `?platform=${platform}` : ""}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((b) => Promise.reject(b.error ?? `HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [platform]);

  if (loading) return <LoadingSkeleton />;
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-5 max-w-md">
          <p className="font-semibold mb-1">Failed to load</p><p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  const analyzed = data.intents.filter((d) => d.avgScore !== null);
  const scatterData = analyzed.map((d) => ({
    ...d,
    x: d.avgScore!,
    y: d.completionRate,
    z: Math.sqrt(d.count) * 2,
  }));

  // Quadrant classification
  function quadrant(x: number, y: number) {
    if (x >= 60 && y >= 50) return "working";
    if (x < 60  && y >= 50) return "ux";
    if (x >= 60 && y < 50)  return "fragile";
    return "fix";
  }

  // Priority list: lowest quality + highest volume
  const priority = [...data.intents]
    .filter((d) => d.avgScore !== null)
    .sort((a, b) => {
      const aScore = (100 - (a.avgScore ?? 50)) * 0.6 + a.failureRate * 0.4;
      const bScore = (100 - (b.avgScore ?? 50)) * 0.6 + b.failureRate * 0.4;
      return bScore - aScore;
    });

  const quadrantLabel: Record<string, { label: string; color: string; desc: string }> = {
    working: { label: "Working Well", color: "#34d399", desc: "High quality + high completion" },
    ux:      { label: "UX Problem",   color: "#fbbf24", desc: "Low quality but users push through" },
    fragile: { label: "Fragile",      color: "#60a5fa", desc: "High quality but users abandon" },
    fix:     { label: "Fix First",    color: "#f87171", desc: "Low quality + low completion" },
  };

  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Quality × Intent</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Quality score vs completion rate — bubble size = conversation volume, color = top platform</p>
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="bg-[#13141b] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-white/20"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.filter((p) => p !== "all").map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {analyzed.length === 0 ? (
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-10 text-center space-y-3">
          <p className="text-zinc-300 font-medium">No analyzed conversations yet</p>
          <p className="text-zinc-500 text-sm">Run AI workers to see quality vs completion breakdown by intent.</p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400 text-left max-w-sm mx-auto">
            <p className="text-emerald-500">python -m scripts.test_workers</p>
          </div>
        </div>
      ) : (
        <>
          {/* Quadrant legend */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(quadrantLabel).map(([key, { label, color, desc }]) => (
              <div key={key} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold text-white">{label}</span>
                </div>
                <p className="text-[10px] text-zinc-600">{desc}</p>
                <p className="text-sm font-mono font-bold mt-1" style={{ color }}>
                  {scatterData.filter((d) => quadrant(d.x, d.y) === key).length}
                </p>
              </div>
            ))}
          </div>

          {/* Scatter chart */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <XAxis
                  type="number" dataKey="x" name="Quality" domain={[0, 100]}
                  tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                  label={{ value: "Avg Quality Score →", position: "insideBottom", offset: -12, fill: "#52525b", fontSize: 11 }}
                />
                <YAxis
                  type="number" dataKey="y" name="Completion" domain={[0, 100]}
                  tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false}
                  label={{ value: "Completion Rate % →", angle: -90, position: "insideLeft", offset: 16, fill: "#52525b", fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 800]} />
                <Tooltip content={<ScatterTooltip />} />
                <ReferenceLine x={60} stroke="#ffffff10" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#ffffff10" strokeDasharray="4 4" />
                <ReferenceLine x={30} y={75} label={{ value: "Fix First", fill: "#f87171", fontSize: 10 }} stroke="none" />
                <ReferenceLine x={80} y={75} label={{ value: "Working Well", fill: "#34d399", fontSize: 10 }} stroke="none" />
                <ReferenceLine x={30} y={25} label={{ value: "UX Problem", fill: "#fbbf24", fontSize: 10 }} stroke="none" />
                <ReferenceLine x={80} y={25} label={{ value: "Fragile", fill: "#60a5fa", fontSize: 10 }} stroke="none" />
                <Scatter data={scatterData} fillOpacity={0.85}>
                  {scatterData.map((d, i) => {
                    const color = d.topPlatform ? (PLATFORM_COLORS[d.topPlatform] ?? "#6b7280") : "#6b7280";
                    return <Cell key={i} fill={color} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>

            {/* Platform color legend */}
            <div className="flex flex-wrap gap-4 mt-2 px-2">
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[key] }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Priority table */}
          <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Fix Priority — sorted by quality gap × failure rate</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Intent", "Avg Quality", "Completion Rate", "Failure Rate", "Volume", "Quadrant"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priority.slice(0, 15).map((row, i) => {
                  const q = quadrant(row.avgScore!, row.completionRate);
                  const { label, color } = quadrantLabel[q];
                  return (
                    <tr key={row.intent} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 text-zinc-200 capitalize">{cap(row.intent)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono font-medium ${(row.avgScore ?? 0) >= 75 ? "text-emerald-400" : (row.avgScore ?? 0) >= 55 ? "text-amber-400" : (row.avgScore ?? 0) >= 40 ? "text-orange-400" : "text-red-400"}`}>
                          {row.avgScore}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono ${row.completionRate >= 60 ? "text-emerald-400" : row.completionRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {row.completionRate}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-red-400 font-mono">{row.failureRate}%</td>
                      <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums">{fmt(row.count)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ color, backgroundColor: color + "20" }}>{label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sample failed conversations */}
          {data.intents.some((d) => d.sampleFailed.length > 0) && (
            <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Failed Conversation Previews</p>
              <p className="text-xs text-zinc-600 mb-4">First user message from low-quality conversations</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data.intents
                  .filter((d) => d.sampleFailed.length > 0 && d.avgScore !== null && d.avgScore < 60)
                  .slice(0, 6)
                  .flatMap((d) => d.sampleFailed.slice(0, 1).map((s) => ({ ...s, intent: d.intent })))
                  .map((s) => (
                    <div key={s.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                      <p className="text-xs text-zinc-500 capitalize mb-1">{cap(s.intent)}</p>
                      <p className="text-xs text-zinc-400 line-clamp-3 italic">&ldquo;{s.preview}&rdquo;</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
