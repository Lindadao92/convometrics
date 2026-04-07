"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Area, AreaChart, Legend,
} from "recharts";

const C = {
  resolved: "#1D9E75", gave_up: "#E24B4A", escalated: "#EF9F27",
  abandoned: "#888780", polite_churner: "#D85A30", accent: "#7C6EF8",
  bg: "#0A0A0F", card: "#16161F", border: "#2A2A38", text: "#F0EEF8",
  text2: "#8B8A9E", t3: "#4A4A5E",
};

const mono = "'IBM Plex Mono', monospace";
const sans = "'DM Sans', sans-serif";

// ── Reusable pieces ──

function Nav() {
  return (
    <nav style={S.nav}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <a href="/" style={S.navLogo}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="6" width="3" height="8" rx="1" fill="#7C6EF8" />
            <rect x="6" y="1" width="3" height="14" rx="1" fill="#7C6EF8" />
            <rect x="11" y="4" width="3" height="10" rx="1" fill="#7C6EF8" />
          </svg>
          ConvoMetrics
        </a>
        <div style={{ display: "flex", gap: 4 }}>
          <a href="/demo" style={S.navLink}>Dashboard</a>
          <a href="/calls" style={S.navLink}>Call Logs</a>
          <a href="/analytics" style={{ ...S.navLink, color: C.accent, background: "rgba(124,110,248,0.12)", borderRadius: 4 }}>Analytics</a>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ ...S.badge, background: "rgba(74,74,94,0.2)", color: C.t3 }}>LIVE</span>
        <a href="/settings" style={{ ...S.navLink, color: C.text2 }}>Settings</a>
      </div>
    </nav>
  );
}

function Card({ children, title, style: extra }: { children: React.ReactNode; title?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ ...S.card, ...extra }}>
      {title && <div style={S.cardTitle}>{title}</div>}
      {children}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={S.mCard}>
      <div style={S.mLabel}>{label}</div>
      <div style={{ ...S.mVal, color: color || C.text }}>{value}</div>
    </div>
  );
}

function Skeleton({ h = 200 }: { h?: number }) {
  return <div style={{ ...S.skeleton, height: h }} />;
}

function EmptyState({ section }: { section: string }) {
  return (
    <div style={S.empty}>
      Not enough data yet. Connect your agent and analyze more calls to see {section} insights.
    </div>
  );
}

function SectionHead({ title }: { title: string }) {
  return <h2 style={S.secTitle}>{title}</h2>;
}

const ttStyle = { backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: mono };

// ── Main Page ──

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [intents, setIntents] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [minCalls, setMinCalls] = useState(true);

  // Chart builder
  const [cbMetric, setCbMetric] = useState("fcr_rate");
  const [cbDim, setCbDim] = useState("intent");
  const [cbType, setCbType] = useState("bar");
  const [cbData, setCbData] = useState<any>(null);
  const [cbLoading, setCbLoading] = useState(false);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    // Ensure session exists, then load data
    async function init() {
      await fetch("/api/auth/demo-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      fetch("/api/analytics/overview").then(r => r.ok ? r.json() : null).then(d => { setOverview(d); if (d && d.calls_this_week >= 10) setMinCalls(true); else setMinCalls(d ? d.calls_this_week >= 1 : false); });
      fetch("/api/analytics/intents").then(r => r.ok ? r.json() : null).then(setIntents);
      fetch("/api/analytics/sentiment").then(r => r.ok ? r.json() : null).then(setSentiment);
      fetch("/api/analytics/performance").then(r => r.ok ? r.json() : null).then(setPerformance);
    }
    init();
  }, []);

  const buildChart = useCallback(async () => {
    setCbLoading(true);
    const res = await fetch("/api/analytics/chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric: cbMetric, dimension: cbDim, chart_type: cbType }),
    });
    if (res.ok) setCbData(await res.json());
    setCbLoading(false);
  }, [cbMetric, cbDim, cbType]);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      <Nav />
      <div style={S.page}>

        {/* ── Section 1: Core Health ── */}
        <SectionHead title="Core Health" />
        {!overview ? <Skeleton h={80} /> : (
          <>
            <div style={S.metricRow}>
              <MetricCard label="Calls this week" value={overview.calls_this_week} color={C.text} />
              <MetricCard label="Resolution rate" value={overview.resolution_rate + "%"} color={C.resolved} />
              <MetricCard label="Polite churner rate" value={overview.polite_churner_rate + "%"} color={C.polite_churner} />
              <MetricCard label="Escalation rate" value={overview.escalation_rate + "%"} color={C.escalated} />
            </div>
            <Card title="Outcome distribution — 8 weeks">
              {overview.outcome_by_week.length === 0 ? <EmptyState section="outcome" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={overview.outcome_by_week} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="resolved" stackId="a" fill={C.resolved} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="gave_up" stackId="a" fill={C.gave_up} />
                    <Bar dataKey="escalated" stackId="a" fill={C.escalated} />
                    <Bar dataKey="abandoned" stackId="a" fill={C.abandoned} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        )}

        {/* ── Section 2: Intent Analytics ── */}
        <SectionHead title="Intent Analytics" />
        {!intents ? <Skeleton h={260} /> : (
          <>
            <div style={S.twoCol}>
              <Card title="Intent volume — this week vs last">
                {intents.intent_volume.length === 0 ? <EmptyState section="intent volume" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={intents.intent_volume} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="intent" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} width={160} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={ttStyle} />
                      <Bar dataKey="this_week" fill={C.accent} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
              <Card title="Intent × outcome matrix">
                {intents.intent_matrix.length === 0 ? <EmptyState section="intent matrix" /> : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Intent</th>
                          <th style={{ ...S.th, color: C.resolved }}>Resolved</th>
                          <th style={{ ...S.th, color: C.gave_up }}>Gave up</th>
                          <th style={{ ...S.th, color: C.escalated }}>Escalated</th>
                          <th style={{ ...S.th, color: C.abandoned }}>Aband.</th>
                          <th style={S.th}>FCR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intents.intent_matrix.map((r: any) => (
                          <tr key={r.intent}>
                            <td style={S.td}>{r.intent}</td>
                            <td style={S.tdNum}>{r.resolved}</td>
                            <td style={S.tdNum}>{r.gave_up}</td>
                            <td style={S.tdNum}>{r.escalated}</td>
                            <td style={S.tdNum}>{r.abandoned}</td>
                            <td style={{ ...S.tdNum, color: r.fcr_pct > 70 ? C.resolved : r.fcr_pct > 30 ? C.escalated : C.gave_up, fontWeight: 500 }}>{r.fcr_pct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
            {intents.new_intents.length > 0 && (
              <div style={S.callout}>
                <strong style={{ color: C.accent }}>New intents this week:</strong>{" "}
                {intents.new_intents.join(", ")}
              </div>
            )}
          </>
        )}

        {/* ── Section 3: Sentiment & Churn ── */}
        <SectionHead title="Sentiment &amp; Churn Signals" />
        {!sentiment ? <Skeleton h={220} /> : (
          <div style={S.threeCol}>
            <Card title="Sentiment by intent">
              {sentiment.sentiment_by_intent.length === 0 ? <EmptyState section="sentiment" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sentiment.sentiment_by_intent}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="intent" tick={{ fill: C.text2, fontSize: 9, fontFamily: mono }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="avg_sentiment" radius={[3, 3, 0, 0]}>
                      {sentiment.sentiment_by_intent.map((e: any, i: number) => (
                        <Cell key={i} fill={e.avg_sentiment < 2 ? C.gave_up : e.avg_sentiment > 3.5 ? C.resolved : C.escalated} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card title="Churn risk distribution">
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={[
                      { name: "High", value: sentiment.churn_distribution.high },
                      { name: "Medium", value: sentiment.churn_distribution.medium },
                      { name: "Low", value: sentiment.churn_distribution.low },
                    ]} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                      <Cell fill={C.gave_up} />
                      <Cell fill={C.escalated} />
                      <Cell fill={C.resolved} />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 12, fontFamily: mono, color: C.text2, lineHeight: 2 }}>
                  <div><span style={{ color: C.gave_up }}>&#9679;</span> High: {sentiment.churn_distribution.high} ({sentiment.churn_distribution.high_pct}%)</div>
                  <div><span style={{ color: C.escalated }}>&#9679;</span> Medium: {sentiment.churn_distribution.medium} ({sentiment.churn_distribution.medium_pct}%)</div>
                  <div><span style={{ color: C.resolved }}>&#9679;</span> Low: {sentiment.churn_distribution.low} ({sentiment.churn_distribution.low_pct}%)</div>
                </div>
              </div>
            </Card>
            <Card title="Polite churner trend">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={sentiment.polite_churner_by_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={ttStyle} />
                  <Line type="monotone" dataKey="count" stroke={C.polite_churner} strokeWidth={2} dot={{ r: 3, fill: C.polite_churner }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* ── Section 4: Agent Performance ── */}
        <SectionHead title="Agent Performance" />
        {!performance ? <Skeleton h={240} /> : (
          <>
            <div style={S.twoCol}>
              <Card title="Completion vs resolution — 8 weeks">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={performance.resolution_by_week}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v + "%"} />
                    <Tooltip contentStyle={ttStyle} formatter={(v) => v + "%"} />
                    <Area type="monotone" dataKey="reported_pct" stroke={C.t3} strokeDasharray="6 4" fill="none" name="Reported" />
                    <Area type="monotone" dataKey="actual_pct" stroke={C.resolved} fill={C.gave_up} fillOpacity={0.08} name="Actual" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <Card title="Avg call duration by outcome">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={performance.duration_by_outcome}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="outcome" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} tickFormatter={(v: number) => Math.floor(v / 60) + "m"} />
                    <Tooltip contentStyle={ttStyle} formatter={(v) => { const n = Number(v); return Math.floor(n / 60) + "m " + (n % 60) + "s"; }} />
                    <Bar dataKey="avg_seconds" radius={[3, 3, 0, 0]}>
                      {performance.duration_by_outcome.map((e: any, i: number) => (
                        <Cell key={i} fill={({ resolved: C.resolved, gave_up: C.gave_up, escalated: C.escalated, abandoned: C.abandoned } as any)[e.outcome] || C.t3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
            <Card title="Escalation rate trend — 8 weeks" style={{ marginTop: 14 }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={performance.escalation_by_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v + "%"} domain={[0, "auto"]} />
                  <Tooltip contentStyle={ttStyle} formatter={(v) => v + "%"} />
                  <Line type="monotone" dataKey="escalation_pct" stroke={C.escalated} strokeWidth={2} dot={{ r: 3, fill: C.escalated }} />
                  {/* Target line at 10% */}
                  <Line type="monotone" dataKey={() => 10} stroke={C.t3} strokeDasharray="6 4" dot={false} name="Target (10%)" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {/* ── Section 5: Chart Builder ── */}
        <SectionHead title="Chart Builder" />
        <Card>
          <div style={S.builderRow}>
            <div style={S.builderField}>
              <label style={S.builderLabel}>Metric</label>
              <select style={S.select} value={cbMetric} onChange={e => setCbMetric(e.target.value)}>
                <option value="fcr_rate">FCR rate (%)</option>
                <option value="call_volume">Call volume</option>
                <option value="sentiment_score">Sentiment (avg)</option>
                <option value="churn_risk">Churn risk %</option>
                <option value="escalation_rate">Escalation rate %</option>
                <option value="polite_churner_rate">Polite churner rate %</option>
              </select>
            </div>
            <div style={S.builderField}>
              <label style={S.builderLabel}>Break down by</label>
              <select style={S.select} value={cbDim} onChange={e => setCbDim(e.target.value)}>
                <option value="intent">Intent</option>
                <option value="outcome">Outcome</option>
                <option value="week">Week</option>
                <option value="platform">Platform</option>
              </select>
            </div>
            <div style={S.builderField}>
              <label style={S.builderLabel}>Chart type</label>
              <select style={S.select} value={cbType} onChange={e => setCbType(e.target.value)}>
                <option value="bar">Bar chart</option>
                <option value="line">Line chart</option>
                <option value="hbar">Horizontal bar</option>
              </select>
            </div>
            <button style={S.buildBtn} onClick={buildChart} disabled={cbLoading}>
              {cbLoading ? "Building..." : "Build chart"}
            </button>
          </div>
          {cbData && (
            <div style={{ marginTop: 20 }}>
              <ResponsiveContainer width="100%" height={260}>
                {cbType === "line" ? (
                  <LineChart data={cbData.labels.map((l: string, i: number) => ({ name: l, value: cbData.values[i] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Line type="monotone" dataKey="value" stroke={C.accent} strokeWidth={2} dot={{ r: 3, fill: C.accent }} />
                  </LineChart>
                ) : cbType === "hbar" ? (
                  <BarChart data={cbData.labels.map((l: string, i: number) => ({ name: l, value: cbData.values[i] }))} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} width={140} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                      {cbData.labels.map((_: string, i: number) => <Cell key={i} fill={cbData.colors[i] || C.accent} />)}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart data={cbData.labels.map((l: string, i: number) => ({ name: l, value: cbData.values[i] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={ttStyle} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {cbData.labels.map((_: string, i: number) => <Cell key={i} fill={cbData.colors[i] || C.accent} />)}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
              <div style={{ textAlign: "right", marginTop: 8 }}>
                <button style={S.saveBtn} onClick={() => { setToast(true); setTimeout(() => setToast(false), 2000); }}>
                  Save to dashboard
                </button>
                {toast && <span style={{ marginLeft: 12, fontSize: 12, color: C.escalated, fontFamily: mono }}>Coming soon</span>}
              </div>
            </div>
          )}
        </Card>

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
}

// ── Styles ──

const S: Record<string, React.CSSProperties> = {
  nav: {
    position: "sticky", top: 0, zIndex: 100, height: 52, background: "#111118",
    borderBottom: "0.5px solid #2A2A38", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "0 24px",
  },
  navLogo: {
    display: "flex", alignItems: "center", gap: 7,
    fontFamily: mono, fontSize: 14, fontWeight: 500, color: C.text, textDecoration: "none",
  },
  navLink: {
    fontFamily: mono, fontSize: 12, fontWeight: 500, color: C.text2,
    textDecoration: "none", padding: "6px 12px",
  },
  badge: {
    fontFamily: mono, fontSize: 10, fontWeight: 500, padding: "3px 8px", borderRadius: 4,
  },
  page: { maxWidth: 1100, margin: "0 auto", padding: "20px 24px" },
  secTitle: {
    fontFamily: sans, fontSize: 18, fontWeight: 600, color: C.text,
    marginTop: 36, marginBottom: 14,
  },
  card: {
    background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10,
    padding: "16px 18px", marginBottom: 14, overflow: "hidden",
  },
  cardTitle: {
    fontFamily: mono, fontSize: 11, fontWeight: 500, textTransform: "uppercase" as const,
    letterSpacing: "0.06em", color: C.text2, marginBottom: 14,
  },
  metricRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 },
  mCard: {
    background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 8,
    padding: "14px 16px", position: "relative" as const,
  },
  mLabel: {
    fontFamily: mono, fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const,
    letterSpacing: "0.08em", color: C.text2, marginBottom: 6,
  },
  mVal: { fontFamily: mono, fontSize: 26, fontWeight: 500, lineHeight: 1 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  threeCol: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 },
  skeleton: {
    background: "linear-gradient(90deg, #16161F 25%, #1c1c28 50%, #16161F 75%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.5s infinite",
    borderRadius: 10, marginBottom: 14,
  },
  empty: {
    padding: "24px 16px", textAlign: "center" as const, fontSize: 13,
    color: C.t3, fontFamily: mono,
  },
  table: {
    width: "100%", borderCollapse: "collapse" as const, fontFamily: mono, fontSize: 11,
  },
  th: {
    textAlign: "left" as const, padding: "8px 10px", color: C.t3, fontWeight: 500,
    borderBottom: `0.5px solid ${C.border}`, fontSize: 10, textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  td: { padding: "8px 10px", color: C.text2, borderBottom: `0.5px solid rgba(42,42,56,0.4)` },
  tdNum: {
    padding: "8px 10px", color: C.text2, borderBottom: `0.5px solid rgba(42,42,56,0.4)`,
    textAlign: "center" as const, fontFamily: mono, fontSize: 11,
  },
  callout: {
    background: "rgba(124,110,248,0.06)", border: "1px solid rgba(124,110,248,0.15)",
    borderRadius: 8, padding: "12px 16px", fontFamily: mono, fontSize: 12,
    color: C.text2, marginTop: 10,
  },
  builderRow: {
    display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" as const,
  },
  builderField: { display: "flex", flexDirection: "column" as const, gap: 4, flex: 1, minWidth: 140 },
  builderLabel: {
    fontFamily: mono, fontSize: 10, fontWeight: 500, color: C.text2,
    textTransform: "uppercase" as const, letterSpacing: "0.06em",
  },
  select: {
    padding: "8px 12px", background: "#111118", border: `1px solid ${C.border}`,
    borderRadius: 6, color: C.text, fontFamily: sans, fontSize: 13, outline: "none",
  },
  buildBtn: {
    padding: "8px 20px", background: C.accent, color: "#fff", border: "none",
    borderRadius: 6, fontFamily: sans, fontSize: 13, fontWeight: 600, cursor: "pointer",
    minHeight: 36,
  },
  saveBtn: {
    padding: "6px 14px", background: "transparent", border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text2, fontFamily: mono, fontSize: 11, cursor: "pointer",
  },
};
