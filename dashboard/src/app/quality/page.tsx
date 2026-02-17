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
} from "recharts";

interface IntentData {
  intent: string;
  count: number;
  avgScore: number | null;
  completionRate: number;
  buckets: [number, number, number, number];
}

const BUCKET_LABELS = ["0–25", "26–50", "51–75", "76–100"];

function heatColor(value: number, max: number): string {
  if (value === 0) return "rgba(255,255,255,0.02)";
  const intensity = value / max;
  // Gradient from dark indigo to bright indigo
  if (intensity > 0.75) return "rgba(99,102,241,0.9)";
  if (intensity > 0.5) return "rgba(99,102,241,0.6)";
  if (intensity > 0.25) return "rgba(99,102,241,0.35)";
  return "rgba(99,102,241,0.15)";
}

function scatterColor(avgScore: number | null, completionRate: number): string {
  if (avgScore !== null && avgScore < 60) return "#ef4444";
  if (completionRate < 40) return "#f59e0b";
  return "#818cf8";
}

export default function QualityPage() {
  const [intents, setIntents] = useState<IntentData[]>([]);
  const [maxBucket, setMaxBucket] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{
    intent: string;
    bucket: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/quality");
        const data = await res.json();
        setIntents(data.intents);
        setMaxBucket(data.maxBucket);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const problemIntents = intents.filter(
    (i) => (i.avgScore !== null && i.avgScore < 60) || i.completionRate < 40
  );

  const scatterData = intents
    .filter((i) => i.avgScore !== null)
    .map((i) => ({
      x: i.avgScore!,
      y: i.completionRate,
      z: i.count,
      intent: i.intent,
    }));

  // Size range for scatter dots
  const counts = intents.map((i) => i.count);
  const minCount = Math.min(...counts, 1);
  const maxCount = Math.max(...counts, 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-semibold text-white mb-1">
        Quality × Intent
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        Cross-dimensional analysis of quality scores and intents
      </p>

      {/* Problem Intents */}
      {problemIntents.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-4 h-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-sm font-medium text-red-400">
              Problem Intents
            </h2>
            <span className="text-xs text-zinc-600">
              Avg quality &lt; 60 or completion rate &lt; 40%
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {problemIntents.map((i) => (
              <div
                key={i.intent}
                className="rounded-lg border border-red-500/20 bg-red-500/[0.05] p-4"
              >
                <p className="text-sm font-medium text-zinc-200 mb-2 truncate">
                  {i.intent}
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500">Quality </span>
                    <span
                      className={`font-medium ${
                        i.avgScore !== null && i.avgScore < 60
                          ? "text-red-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {i.avgScore ?? "--"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Completion </span>
                    <span
                      className={`font-medium ${
                        i.completionRate < 40
                          ? "text-red-400"
                          : "text-zinc-300"
                      }`}
                    >
                      {i.completionRate}%
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Count </span>
                    <span className="font-medium text-zinc-300">
                      {i.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-400">
            Quality Score Heatmap
          </h2>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Less</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.55, 0.8].map((v, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: heatColor(v * maxBucket, maxBucket) }}
                />
              ))}
            </div>
            <span>More</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {/* Column headers */}
          <div className="flex mb-1">
            <div className="w-52 shrink-0" />
            {BUCKET_LABELS.map((label) => (
              <div
                key={label}
                className="flex-1 min-w-[80px] text-center text-xs text-zinc-500 pb-2"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1">
            {intents.map((row) => (
              <div key={row.intent} className="flex items-center group">
                <div className="w-52 shrink-0 pr-3 text-xs text-zinc-400 truncate group-hover:text-zinc-200 transition-colors">
                  {row.intent}
                </div>
                {row.buckets.map((val, bi) => (
                  <div
                    key={bi}
                    className="flex-1 min-w-[80px] px-0.5"
                    onMouseEnter={() =>
                      setHoveredCell({
                        intent: row.intent,
                        bucket: bi,
                        count: val,
                      })
                    }
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <div
                      className="h-8 rounded-sm flex items-center justify-center text-xs font-medium transition-all cursor-default relative"
                      style={{ backgroundColor: heatColor(val, maxBucket) }}
                    >
                      <span
                        className={
                          val > 0 ? "text-white/70" : "text-transparent"
                        }
                      >
                        {val}
                      </span>
                      {hoveredCell?.intent === row.intent &&
                        hoveredCell?.bucket === bi && (
                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#1e1f2b] border border-white/[0.08] rounded-md px-2.5 py-1 text-xs text-zinc-200 whitespace-nowrap z-10 shadow-lg">
                            {BUCKET_LABELS[bi]}: {val} conversations
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scatter Plot */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-1">
          Quality vs Completion Rate
        </h2>
        <p className="text-xs text-zinc-600 mb-4">
          Each dot is an intent. Size = conversation count.{" "}
          <span className="text-red-400">Red</span> = low quality,{" "}
          <span className="text-amber-400">Amber</span> = low completion,{" "}
          <span className="text-indigo-400">Blue</span> = healthy.
        </p>
        {scatterData.length > 0 ? (
          <ResponsiveContainer width="100%" height={360}>
            <ScatterChart
              margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
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
                  offset: -5,
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
                width={40}
                label={{
                  value: "Completion Rate %",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fill: "#52525b",
                  fontSize: 11,
                }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                domain={[minCount, maxCount]}
                range={[80, 600]}
              />
              <RechartsTooltip
                cursor={{ strokeDasharray: "3 3", stroke: "rgba(255,255,255,0.1)" }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#1e1f2b] border border-white/[0.08] rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs font-medium text-zinc-200 mb-1">
                        {d.intent}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Quality: {d.x} · Completion: {d.y}% · Count:{" "}
                        {d.z}
                      </p>
                    </div>
                  );
                }}
              />
              {/* Reference lines for thresholds */}
              <Scatter data={scatterData} fillOpacity={0.8}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={scatterColor(entry.x, entry.y)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[360px] text-zinc-600 text-sm">
            No data
          </div>
        )}

        {/* Quadrant labels */}
        <div className="flex justify-between mt-2 px-12 text-xs text-zinc-600">
          <span>Low Quality / Low Completion</span>
          <span>High Quality / High Completion</span>
        </div>
      </div>
    </div>
  );
}
