"use client";

import { useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CohortRow {
  cohortLabel: string;
  cohortStart: string;
  userCount:   number;
  weeks:       (number | null)[];
}

interface RetentionData {
  cohorts:          CohortRow[];
  maxWeeks:         number;
  successRetention: number;
  failedRetention:  number;
  successCount:     number;
  failedCount:      number;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
// Smooth red (0%) → amber (50%) → emerald (100%) interpolation

function interpRGB(pct: number): [number, number, number] {
  if (pct >= 50) {
    const t = (pct - 50) / 50;
    return [
      Math.round(251 - 199 * t), // 251 → 52
      Math.round(191 +  20 * t), // 191 → 211
      Math.round( 36 + 117 * t), //  36 → 153
    ];
  }
  const t = pct / 50;
  return [
    Math.round(239 +  12 * t), // 239 → 251
    Math.round( 68 + 123 * t), //  68 → 191
    Math.round( 68 -  32 * t), //  68 → 36
  ];
}

function heatBg(pct: number): string {
  const [r, g, b] = interpRGB(pct);
  const alpha = (0.12 + (pct / 100) * 0.22).toFixed(2);
  return `rgba(${r},${g},${b},${alpha})`;
}

function heatFg(pct: number): string {
  const [r, g, b] = interpRGB(pct);
  return `rgb(${r},${g},${b})`;
}

// ── Legend strip ──────────────────────────────────────────────────────────────

function ColorLegend() {
  const stops = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  return (
    <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/[0.05]">
      <span className="text-[10px] text-zinc-600 shrink-0">Low</span>
      <div className="flex gap-0.5">
        {stops.map((pct) => (
          <div
            key={pct}
            className="w-6 h-4 rounded-sm"
            style={{ background: heatBg(pct) }}
            title={`${pct}%`}
          />
        ))}
      </div>
      <span className="text-[10px] text-zinc-600 shrink-0">High</span>
    </div>
  );
}

// ── Comparison bar ────────────────────────────────────────────────────────────

function ComparisonBar({
  label,
  sublabel,
  pct,
  barColor,
  textColor,
}: {
  label:     string;
  sublabel:  string;
  pct:       number;
  barColor:  string;
  textColor: string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-xs text-zinc-600 mt-0.5">{sublabel}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color: textColor }}>
          {pct}%
        </span>
      </div>
      <div className="h-3 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RetentionPage() {
  const [data,    setData]    = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/retention")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-sm">Loading retention data…</span>
      </div>
    );
  }

  if (!data || !data.cohorts.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-zinc-600 text-sm">No cohort data available.</span>
      </div>
    );
  }

  const {
    cohorts, maxWeeks,
    successRetention, failedRetention,
    successCount, failedCount,
  } = data;

  const weekCols = Array.from({ length: maxWeeks + 1 }, (_, i) => i);
  const delta    = successRetention - failedRetention;

  return (
    <div className="p-8 max-w-6xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Retention</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Weekly cohort retention — % of users who returned each week after their first session
        </p>
      </div>

      {/* ── Cohort heatmap ── */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-300">Cohort Retention Heatmap</h2>
          <p className="text-xs text-zinc-600 mt-0.5">
            Week 0 = cohort&apos;s first week (always 100%). Empty cells = week not yet elapsed.
          </p>
        </div>

        <div className="p-5 overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: "4px" }}>
            <thead>
              <tr>
                <th className="text-left pb-1 pr-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 whitespace-nowrap min-w-[140px]">
                  Cohort
                </th>
                <th className="pb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center min-w-[36px]">
                  n
                </th>
                {weekCols.map((w) => (
                  <th
                    key={w}
                    className="pb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 text-center min-w-[56px] whitespace-nowrap"
                  >
                    Wk {w}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {cohorts.map((row) => (
                <tr key={row.cohortStart}>
                  {/* Cohort label */}
                  <td className="pr-3 py-0.5 text-xs font-medium text-zinc-400 whitespace-nowrap">
                    {row.cohortLabel} cohort
                  </td>

                  {/* User count */}
                  <td className="py-0.5 text-center text-xs text-zinc-600 tabular-nums px-1">
                    {row.userCount}
                  </td>

                  {/* Week cells */}
                  {weekCols.map((w) => {
                    const pct = row.weeks[w] ?? null;

                    if (pct === null) {
                      return (
                        <td key={w} className="py-0.5">
                          <div className="w-14 h-9 rounded-md border border-white/[0.03] bg-white/[0.01]" />
                        </td>
                      );
                    }

                    return (
                      <td key={w} className="py-0.5">
                        <div
                          className="w-14 h-9 rounded-md flex items-center justify-center
                                     text-xs font-bold tabular-nums border border-white/[0.06]
                                     transition-colors"
                          style={{
                            background: heatBg(pct),
                            color:      heatFg(pct),
                          }}
                          title={`${row.cohortLabel} · Week ${w}: ${pct}%`}
                        >
                          {pct}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <ColorLegend />
        </div>
      </div>

      {/* ── First-session impact ── */}
      <div className="rounded-xl border border-white/[0.06] bg-[#13141b] p-6">
        <h2 className="text-sm font-semibold text-zinc-300 mb-1">
          First Session Quality Impact on Retention
        </h2>
        <p className="text-xs text-zinc-600 mb-6">
          % of users who had another session ≥ 3 days after their first conversation,
          grouped by whether that first session succeeded or failed.
        </p>

        <div className="space-y-6">
          <ComparisonBar
            label="Successful first session"
            sublabel={`${successCount} users whose first conversation completed`}
            pct={successRetention}
            barColor="#34d399"
            textColor="#34d399"
          />
          <ComparisonBar
            label="Failed first session"
            sublabel={`${failedCount} users whose first conversation failed or was abandoned`}
            pct={failedRetention}
            barColor="#f87171"
            textColor="#f87171"
          />
        </div>

        {/* Insight callout */}
        {Math.abs(delta) >= 5 && (
          <div className={`mt-6 pt-4 border-t border-white/[0.05] rounded-lg`}>
            <p className="text-xs leading-relaxed text-zinc-400">
              {delta > 0 ? (
                <>
                  Users who succeed on their first session are{" "}
                  <span className="text-emerald-400 font-semibold">
                    {delta}pp more likely
                  </span>{" "}
                  to return. Investing in first-session success is your highest-leverage retention lever.
                </>
              ) : (
                <>
                  Users who fail their first session are{" "}
                  <span className="text-amber-400 font-semibold">
                    {Math.abs(delta)}pp more likely
                  </span>{" "}
                  to return — likely driven by high motivation to solve their problem. Ensure
                  follow-up sessions convert better to avoid frustration churn.
                </>
              )}
            </p>
          </div>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-white/[0.05]">
          {[
            { label: "Avg retention (all users)", value: `${Math.round((successRetention * successCount + failedRetention * failedCount) / Math.max(successCount + failedCount, 1))}%` },
            { label: "Success vs. fail gap",      value: `${delta > 0 ? "+" : ""}${delta}pp` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
