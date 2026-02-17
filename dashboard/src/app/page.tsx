"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface CompletionData {
  name: string;
  value: number;
  color: string;
}

interface IntentData {
  intent: string;
  count: number;
}

interface TrendData {
  date: string;
  avg_score: number;
}

const COMPLETION_COLORS: Record<string, string> = {
  completed: "#6366f1",
  partial: "#a78bfa",
  abandoned: "#475569",
  failed: "#ef4444",
};

export default function Overview() {
  const [totalConversations, setTotalConversations] = useState<number>(0);
  const [avgQuality, setAvgQuality] = useState<number>(0);
  const [completionData, setCompletionData] = useState<CompletionData[]>([]);
  const [intentData, setIntentData] = useState<IntentData[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/overview");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `API returned ${res.status}`);
          return;
        }

        const data = await res.json();

        setTotalConversations(data.totalConversations);
        setAvgQuality(data.avgQuality);
        setIntentData(data.topIntents);
        setTrendData(data.qualityTrend);

        // Build completion pie data
        setCompletionData(
          Object.entries(data.completionStatus as Record<string, number>).map(
            ([name, value]) => ({
              name,
              value,
              color: COMPLETION_COLORS[name] || "#64748b",
            })
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg p-4 max-w-lg">
          <p className="font-medium mb-1">Error loading data</p>
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl">
      <h1 className="text-2xl font-semibold text-white mb-1">Overview</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Conversation analytics at a glance
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="Total Conversations"
          value={totalConversations.toLocaleString()}
          accent="blue"
        />
        <StatCard
          label="Avg Quality Score"
          value={avgQuality > 0 ? `${avgQuality}/100` : "--"}
          accent="purple"
        />
        <StatCard
          label="Completion Rate"
          value={
            completionData.length > 0
              ? `${Math.round(
                  ((completionData.find((d) => d.name === "completed")
                    ?.value ?? 0) /
                    completionData.reduce((s, d) => s + d.value, 0)) *
                    100
                )}%`
              : "--"
          }
          accent="indigo"
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Completion status pie chart */}
        <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">
            Task Completion
          </h2>
          {completionData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={completionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {completionData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1f2b",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "8px",
                      color: "#e4e4e7",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 shrink-0">
                {completionData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-zinc-400 capitalize">{d.name}</span>
                    <span className="text-zinc-300 font-medium ml-auto pl-3">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty />
          )}
        </div>

        {/* Top intents bar chart */}
        <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">
            Top Intents
          </h2>
          {intentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={intentData}
                layout="vertical"
                margin={{ left: 0, right: 20, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="intent"
                  width={180}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e1f2b",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "8px",
                    color: "#e4e4e7",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </div>
      </div>

      {/* Quality trend line chart */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">
          Quality Score Trend (30 days)
        </h2>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={trendData}
              margin={{ left: 0, right: 20, top: 10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e1f2b",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  color: "#e4e4e7",
                  fontSize: "13px",
                }}
              />
              <Line
                type="monotone"
                dataKey="avg_score"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ r: 3, fill: "#818cf8" }}
                activeDot={{ r: 5, fill: "#a78bfa" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "blue" | "purple" | "indigo";
}) {
  const gradients = {
    blue: "from-blue-500/10 to-transparent",
    purple: "from-purple-500/10 to-transparent",
    indigo: "from-indigo-500/10 to-transparent",
  };
  const dots = {
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    indigo: "bg-indigo-400",
  };

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-gradient-to-br ${gradients[accent]} bg-[#13141b] p-6`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1.5 h-1.5 rounded-full ${dots[accent]}`} />
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-[220px] text-zinc-600 text-sm">
      No data yet
    </div>
  );
}
