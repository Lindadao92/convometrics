"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Papa from "papaparse";
import {
  analyzeConversations,
  type BriefingData,
  type RawMessage,
  type AnalysisResponse,
  type ClaudeIntentResult,
  type ClaudePatternResult,
  type ClaudePatternExample,
  type ClaudeActionResult,
  type IntentResult,
  type ClassifiedConversation,
} from "@/lib/analyzer";

// ─── Types ──────────────────────────────────────────────────────────────────

type AppState = "upload" | "preview" | "processing" | "briefing";

interface ColumnMapping {
  conversation_id: string | null;
  role: string | null;
  message: string | null;
  timestamp: string | null;
}

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  conversation_id: ["conversation_id", "session_id", "thread_id", "chat_id", "conv_id", "id"],
  role: ["role", "speaker", "sender", "author", "type"],
  message: ["message", "content", "text", "body", "msg"],
  timestamp: ["timestamp", "time", "created_at", "datetime", "date", "sent_at"],
};

const REQUIRED_COLUMNS: (keyof ColumnMapping)[] = ["conversation_id", "role", "message"];

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { conversation_id: null, role: null, message: null, timestamp: null };
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = lowerHeaders.indexOf(alias);
      if (idx !== -1) {
        mapping[field as keyof ColumnMapping] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

// Type guard for Claude response
function isClaudeResponse(data: BriefingData | AnalysisResponse): data is AnalysisResponse {
  return "realityCheck" in data;
}

// ─── TopBar ─────────────────────────────────────────────────────────────────

function TopBar({ onNewAnalysis, showNew }: { onNewAnalysis: () => void; showNew: boolean }) {
  return (
    <header className="sticky top-0 z-50 h-14 shrink-0 border-b border-white/[0.06] bg-[#0a0b10]/90 backdrop-blur-md flex items-center justify-between px-6">
      <a href="https://convometrics-landing.vercel.app" className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        IRL AI
      </a>
      {showNew && (
        <button onClick={onNewAnalysis} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8178ff] text-white hover:bg-[#9490ff] hover:shadow-[0_0_20px_rgba(129,120,255,0.3)] transition-all cursor-pointer">
          New Analysis
        </button>
      )}
    </header>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-white/[0.05] py-12 first:pt-10 last:border-b-0">
      {children}
    </section>
  );
}

// ─── Chat bubble ────────────────────────────────────────────────────────────

function Chat({ role, children }: { role: "user" | "ai" | "assistant" | "system"; children: React.ReactNode }) {
  if (role === "system") {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[10px] font-mono text-zinc-600 italic">{children}</span>
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <div className="flex gap-2.5 py-1.5">
      <div className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5 ${isUser ? "bg-blue-500/20 text-blue-400" : "bg-zinc-700/50 text-zinc-500"}`}>
        {isUser ? "U" : "AI"}
      </div>
      <p className="text-[12px] text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}

// ─── Annotation ─────────────────────────────────────────────────────────────

function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 pl-[30px]">
      <p className="text-[11px] text-indigo-400/80 leading-relaxed italic">{children}</p>
    </div>
  );
}

// ─── IntentBlock ────────────────────────────────────────────────────────────

function IntentBlock({ name, sessions, success, status }: { name: string; sessions: number; success: number | null; status: string }) {
  const colors: Record<string, string> = {
    critical: "border-red-500/20 bg-red-500/[0.05]",
    warning: "border-amber-500/20 bg-amber-500/[0.05]",
    good: "border-emerald-500/20 bg-emerald-500/[0.05]",
    performing: "border-emerald-500/20 bg-emerald-500/[0.05]",
    info: "border-zinc-500/20 bg-zinc-500/[0.05]",
  };
  const textColors: Record<string, string> = {
    critical: "text-red-400",
    warning: "text-amber-400",
    good: "text-emerald-400",
    performing: "text-emerald-400",
    info: "text-zinc-400",
  };
  return (
    <div className={`border rounded-lg p-2.5 ${colors[status] || colors.info}`}>
      <p className="font-mono text-[10px] text-zinc-400 leading-tight mb-1.5 truncate">{name}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[11px] text-zinc-500">{sessions}</span>
        {success !== null && (
          <span className={`font-mono text-[11px] font-semibold ${textColors[status] || textColors.info}`}>{success}%</span>
        )}
      </div>
    </div>
  );
}

// ─── Upload View ────────────────────────────────────────────────────────────

function UploadView({ onFileLoaded, onSampleData }: { onFileLoaded: (file: File, headers: string[], data: Record<string, string>[], rowCount: number) => void; onSampleData: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setError(null);
    if (!f.name.endsWith(".csv")) { setError("Please upload a CSV file."); return; }
    if (f.size > 50 * 1024 * 1024) { setError("File too large. Max 50MB."); return; }
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data || result.data.length === 0) { setError("CSV appears to be empty."); return; }
        const headers = result.meta.fields || [];
        onFileLoaded(f, headers, result.data as Record<string, string>[], result.data.length);
      },
      error: () => setError("Failed to parse CSV. Check the file format."),
    });
  }, [onFileLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg" style={{ animation: "fade-in-up 0.3s ease-out" }}>
        <h1 className="text-xl font-bold text-white text-center mb-2">Upload Your Conversations</h1>
        <p className="text-sm text-zinc-500 text-center mb-8">Drop a CSV export of your AI conversations. We&rsquo;ll show you what&rsquo;s actually happening.</p>
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${dragging ? "border-indigo-400 bg-indigo-400/[0.06]" : "border-white/[0.08] bg-[#13141b] hover:border-white/[0.15] hover:bg-[#161824]"}`}
        >
          <input ref={inputRef} type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
          <div className="text-3xl mb-3 opacity-40">{dragging ? "+" : "\u2191"}</div>
          <p className="text-sm text-zinc-400 mb-1">{dragging ? "Drop your CSV here" : "Drag & drop your CSV file here"}</p>
          <p className="text-xs text-zinc-600">or click to browse &middot; .csv, max 50MB</p>
        </div>
        {error && <p className="mt-4 text-sm text-red-400 text-center">{error}</p>}
        <div className="mt-8 text-center">
          <button onClick={onSampleData} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
            or <span className="underline underline-offset-2">try with sample data</span>
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Preview View ───────────────────────────────────────────────────────────

function PreviewView({
  fileName, fileSize, rowCount, headers, previewRows, mapping, onMappingChange, onRunAnalysis, onBack,
}: {
  fileName: string; fileSize: number; rowCount: number; headers: string[];
  previewRows: Record<string, string>[]; mapping: ColumnMapping;
  onMappingChange: (field: keyof ColumnMapping, value: string | null) => void;
  onRunAnalysis: () => void; onBack: () => void;
}) {
  const requiredMapped = REQUIRED_COLUMNS.every((col) => mapping[col] !== null);
  const convIdCol = mapping.conversation_id;
  const uniqueConvs = convIdCol ? new Set(previewRows.map((r) => r[convIdCol])).size : 0;

  return (
    <main className="flex-1 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto" style={{ animation: "fade-in-up 0.3s ease-out" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-zinc-500 bg-white/[0.04] px-2 py-1 rounded">CSV</span>
            <span className="text-sm text-white font-medium">{fileName}</span>
            <span className="text-xs text-zinc-600">{(fileSize / 1024).toFixed(1)} KB</span>
          </div>
          <button onClick={onBack} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer">&larr; Back</button>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 mb-6">
          <p className="text-[13px] text-zinc-400">
            <span className="text-white font-semibold">{rowCount.toLocaleString()} rows</span> found
            {convIdCol && <> across <span className="text-white font-semibold">{uniqueConvs.toLocaleString()} conversations</span></>}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-white/[0.06]">{headers.map((col, i) => <th key={i} className="px-3 py-2 text-left text-zinc-500 font-medium whitespace-nowrap">{col}</th>)}</tr></thead>
              <tbody>{previewRows.slice(0, 5).map((row, ri) => <tr key={ri} className="border-b border-white/[0.03] last:border-b-0">{headers.map((col, ci) => <td key={ci} className="px-3 py-2 text-zinc-400 whitespace-nowrap max-w-[200px] truncate">{row[col]}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="mb-6">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">Column Mapping</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(COLUMN_ALIASES) as (keyof ColumnMapping)[]).map((field) => {
              const mapped = mapping[field];
              const isRequired = REQUIRED_COLUMNS.includes(field);
              return (
                <div key={field} className="flex items-center gap-3">
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {mapped ? <span className="text-emerald-400 text-sm">{"\u2713"}</span> : isRequired ? <span className="text-amber-400 text-sm">!</span> : <span className="text-zinc-600 text-sm">&ndash;</span>}
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-zinc-500 mb-1">{field} {isRequired && <span className="text-red-400">*</span>}</p>
                    <select value={mapped || ""} onChange={(e) => onMappingChange(field, e.target.value || null)} className="w-full bg-[#0e1017] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-zinc-300 appearance-none cursor-pointer">
                      <option value="">-- select column --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onRunAnalysis} disabled={!requiredMapped} className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${requiredMapped ? "bg-[#8178ff] text-white hover:bg-[#9490ff] hover:shadow-[0_0_24px_rgba(129,120,255,0.35)]" : "bg-zinc-800 text-zinc-600 cursor-not-allowed"}`}>
            Run Analysis
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Processing View ────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { label: "Parsing conversations..." },
  { label: "Sending to IRL analyst..." },
  { label: "Reading every conversation..." },
  { label: "Classifying intents and outcomes..." },
  { label: "Detecting hidden patterns..." },
  { label: "Generating your briefing..." },
];

function ProcessingView({ convCount, dataReady, error, onComplete, onRetry }: {
  convCount: number; dataReady: boolean; error: string | null; onComplete: () => void; onRetry: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(false);

  // Advance steps 0-4 on timers, step 5 waits for dataReady
  useEffect(() => {
    const durations = [800, 1200, 1500, 1200, 1500];
    let step = 0;
    let timeout: ReturnType<typeof setTimeout>;

    function advance() {
      if (step < 5) {
        setCurrentStep(step);
        timeout = setTimeout(() => {
          setCompletedSteps((prev) => [...prev, step]);
          step++;
          advance();
        }, durations[step]);
      } else {
        // Step 5: wait for dataReady
        setCurrentStep(5);
      }
    }
    advance();
    return () => clearTimeout(timeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When dataReady, complete step 5 and transition
  useEffect(() => {
    if (dataReady && currentStep >= 5 && !doneRef.current) {
      doneRef.current = true;
      setCompletedSteps((prev) => [...prev, 5]);
      const t = setTimeout(onComplete, 500);
      return () => clearTimeout(t);
    }
  }, [dataReady, currentStep, onComplete]);

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm" style={{ animation: "fade-in-up 0.3s ease-out" }}>
        <p className="text-sm text-zinc-500 text-center mb-8">Analyzing {convCount.toLocaleString()} conversations...</p>

        <div className="space-y-4">
          {PROCESSING_STEPS.map((step, i) => {
            const isDone = completedSteps.includes(i);
            const isActive = currentStep === i && !isDone;
            const isPending = i > currentStep;

            return (
              <div key={i} className={`flex items-center gap-3 transition-opacity ${isPending ? "opacity-30" : "opacity-100"}`}>
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  {isDone ? (
                    <span className="text-emerald-400 text-sm">{"\u2713"}</span>
                  ) : isActive ? (
                    <span className="text-indigo-400 text-sm animate-pulse">{"\u25CF"}</span>
                  ) : (
                    <span className="text-zinc-700 text-sm">{"\u25CB"}</span>
                  )}
                </div>
                <p className={`text-sm ${isDone ? "text-zinc-400" : isActive ? "text-white" : "text-zinc-600"}`}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Timeout messages */}
        {elapsed > 30 && !dataReady && !error && (
          <p className="text-xs text-zinc-600 text-center mt-6">Taking longer than usual... complex datasets take a bit longer.</p>
        )}

        {/* Error state */}
        {error && (
          <div className="mt-8 text-center">
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={onRetry} className="px-4 py-2 rounded-lg bg-[#8178ff] text-white text-xs font-semibold hover:bg-[#9490ff] transition-all cursor-pointer">
                Retry
              </button>
              <button onClick={onComplete} className="px-4 py-2 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer">
                Use basic analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Briefing View ──────────────────────────────────────────────────────────

function BriefingView({ data, fileName, analysisError }: { data: BriefingData | AnalysisResponse; fileName: string; analysisError: string | null }) {
  const claude = isClaudeResponse(data);
  const { summary, intents, patterns, actions } = data;

  // Normalize severity for intent grouping (Claude uses "performing" instead of "good")
  const normSeverity = (s: string) => s === "performing" ? "good" : s;
  const critical = intents.filter((i) => normSeverity(i.severity) === "critical");
  const warning = intents.filter((i) => normSeverity(i.severity) === "warning");
  const good = intents.filter((i) => normSeverity(i.severity) === "good" || normSeverity(i.severity) === "performing");
  const info = intents.filter((i) => normSeverity(i.severity) === "info");

  // Deep dives: top worst intents
  const deepDives = intents.filter((i) => normSeverity(i.severity) === "critical" || normSeverity(i.severity) === "warning").slice(0, 3);

  // Reality check values
  let reportedRate: number, actualRate: number, conversationsHandled: number, avgMsgs: string;
  let actualExplanation = "", avgSuccessMsg = "0", avgFailedMsg = "", avgFailedExplanation = "";

  if (isClaudeResponse(data)) {
    const rc = data.realityCheck;
    reportedRate = rc.reported.resolutionRate;
    actualRate = rc.actual.resolutionRate;
    conversationsHandled = rc.reported.conversationsHandled;
    avgMsgs = String(rc.reported.avgMessagesPerConversation);
    actualExplanation = rc.actual.resolutionRateExplanation;
    avgSuccessMsg = String(rc.actual.avgMessagesToResolution);
    avgFailedMsg = String(rc.actual.avgMessagesInFailed);
    avgFailedExplanation = rc.actual.avgMessagesInFailedExplanation;
  } else {
    const kw = data;
    const convos = kw.conversations;
    reportedRate = kw.summary.reportedResolutionRate;
    actualRate = kw.summary.actualResolutionRate;
    conversationsHandled = kw.summary.totalConversations;
    avgMsgs = convos.length > 0
      ? (convos.reduce((s, c) => s + c.messageCount, 0) / convos.length).toFixed(1)
      : "0";
    const success = convos.filter((c) => c.outcome === "success");
    const failed = convos.filter((c) => c.outcome !== "success");
    avgSuccessMsg = success.length > 0 ? (success.reduce((s, c) => s + c.messageCount, 0) / success.length).toFixed(1) : "0";
    avgFailedMsg = failed.length > 0 ? (failed.reduce((s, c) => s + c.messageCount, 0) / failed.length).toFixed(1) : "0";
    actualExplanation = `${kw.summary.falsePosCount} conversations look resolved but aren\u2019t`;
    avgFailedExplanation = "Long conversations usually mean frustration, not engagement";
  }

  return (
    <main className="flex-1">
      <div className="max-w-[720px] mx-auto px-5">

        {/* Fallback banner */}
        {analysisError && (
          <div className="bg-amber-500/[0.05] border border-amber-500/10 rounded-lg px-4 py-2 mt-6">
            <p className="text-[11px] text-amber-400/80">AI analysis unavailable ({analysisError}). Showing heuristic analysis instead.</p>
          </div>
        )}

        {/* HEADER */}
        <Section>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">IRL Briefing</p>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Your AI Conversations</h1>
          <p className="text-sm text-zinc-400 mb-2">
            Analysis of {summary.totalConversations.toLocaleString()} conversations &middot; {summary.dateRange.start} &ndash; {summary.dateRange.end}
          </p>
          <p className="text-[11px] text-zinc-600 bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 inline-block">
            Source: {fileName}
          </p>
        </Section>

        {/* REALITY CHECK */}
        <Section id="reality-check">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-6">The Reality Check</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl border border-white/[0.07] overflow-hidden">
            <div className="bg-[#0e1017] p-5 sm:border-r border-b sm:border-b-0 border-white/[0.07]">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">What your dashboard says</p>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Resolution Rate</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-500">{reportedRate}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Conversations Handled</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-500">{conversationsHandled.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 mb-0.5">Avg Messages/Conversation</p>
                  <p className="font-mono text-2xl font-semibold text-zinc-500">{avgMsgs}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#13141b] p-5">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/70 mb-4">What&rsquo;s actually happening</p>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Actual Resolution Rate</p>
                  <p className="font-mono text-2xl font-bold text-red-400">{actualRate}%</p>
                  <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{actualExplanation}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Avg Messages in Successful Convos</p>
                  <p className="font-mono text-2xl font-bold text-emerald-400">{avgSuccessMsg}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Avg Messages in Failed Convos</p>
                  <p className="font-mono text-2xl font-bold text-amber-400">{avgFailedMsg}</p>
                  <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">{avgFailedExplanation}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Gap explanation for Claude responses */}
          {claude && "gapExplanation" in summary && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 mt-4">
              <p className="text-[13px] text-zinc-400 leading-relaxed">{(summary as AnalysisResponse["summary"]).gapExplanation}</p>
            </div>
          )}
        </Section>

        {/* INTENT MAP */}
        <Section id="intent-map">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Intent Map</p>
          <p className="text-sm text-zinc-400 mb-6">Every conversation classified by user intent and outcome</p>
          {critical.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2">Critical &mdash; failing</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {critical.map((i) => <IntentBlock key={i.name} name={i.name} sessions={i.sessions} success={Math.round(i.successRate * 100)} status="critical" />)}
              </div>
            </div>
          )}
          {warning.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-amber-400/60 mb-2">Needs attention</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {warning.map((i) => <IntentBlock key={i.name} name={i.name} sessions={i.sessions} success={Math.round(i.successRate * 100)} status="warning" />)}
              </div>
            </div>
          )}
          {good.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-emerald-400/60 mb-2">Performing well</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {good.map((i) => <IntentBlock key={i.name} name={i.name} sessions={i.sessions} success={Math.round(i.successRate * 100)} status="good" />)}
              </div>
            </div>
          )}
          {info.length > 0 && (
            <div className="mb-5">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-2">Low volume</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {info.map((i) => <IntentBlock key={i.name} name={i.name} sessions={i.sessions} success={Math.round(i.successRate * 100)} status="info" />)}
              </div>
            </div>
          )}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
            <p className="text-[13px] text-zinc-400 leading-relaxed">
              <span className="text-white font-semibold">{intents.length} intents classified.</span>{" "}
              {critical.length > 0 && <>{critical.length} critical, </>}
              {warning.length > 0 && <>{warning.length} need attention, </>}
              {good.length > 0 && <>{good.length} performing well.</>}
            </p>
          </div>
        </Section>

        {/* DEEP DIVES */}
        {deepDives.length > 0 && (
          <Section id="deep-dives">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Deep Dives</p>
            <p className="text-sm text-zinc-400 mb-8">Investigation of the worst-performing intents</p>
            {deepDives.map((intent, idx) => (
              <DeepDiveBlock key={intent.name} intent={intent} isLast={idx === deepDives.length - 1} isClaude={claude} />
            ))}
          </Section>
        )}

        {/* HIDDEN PATTERNS */}
        {patterns.length > 0 && (
          <Section id="patterns">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Hidden Patterns</p>
            <p className="text-sm text-zinc-400 mb-8">Cross-conversation patterns detected in your data</p>
            {patterns.map((pattern) => (
              <PatternBlock key={pattern.name} pattern={pattern} isClaude={claude} />
            ))}
          </Section>
        )}

        {/* RECOMMENDED ACTIONS */}
        {actions.length > 0 && (
          <Section id="actions">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Recommended Actions</p>
            <p className="text-sm text-zinc-400 mb-6">Prioritized by impact</p>
            <div className="space-y-4">
              {actions.map((action, i) => {
                const priority = "priority" in action ? (action as ClaudeActionResult).priority : (i === 0 ? "high" : "medium");
                return (
                  <div key={i} className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                    <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                      <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        priority === "high" ? "bg-red-500/[0.12] border border-red-500/20 text-red-400"
                        : priority === "medium" ? "bg-amber-500/[0.12] border border-amber-500/20 text-amber-400"
                        : "bg-blue-500/[0.12] border border-blue-500/20 text-blue-400"
                      }`}>
                        {priority} priority
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">{action.intent}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-2">{action.title}</h4>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                        <p className="text-xs text-zinc-400 font-medium capitalize">{action.effort}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                        <p className="text-xs text-zinc-400 font-medium">{action.impact}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      <span className="text-zinc-400 font-medium">Why:</span> {action.why}
                    </p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* FOOTER */}
        <section className="py-16 text-center">
          <p className="text-[13px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-8">
            This analysis was generated from your uploaded data.<br />
            Want to discuss the findings?
          </p>
          <a href="mailto:linda@irlai.com" className="px-6 py-2.5 rounded-lg border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-white/[0.15] transition-colors">
            Book a Call
          </a>
        </section>
      </div>
    </main>
  );
}

// ─── Deep Dive Block ────────────────────────────────────────────────────────

type AnyIntent = IntentResult | ClaudeIntentResult;

function DeepDiveBlock({ intent, isLast, isClaude }: { intent: AnyIntent; isLast: boolean; isClaude: boolean }) {
  const sev = intent.severity === "performing" ? "warning" : intent.severity;
  const severityBadge = sev === "critical"
    ? "bg-red-500/[0.12] border border-red-500/20 text-red-400"
    : "bg-amber-500/[0.12] border border-amber-500/20 text-amber-400";

  const claudeIntent = isClaude ? (intent as ClaudeIntentResult) : null;
  const keywordIntent = !isClaude ? (intent as IntentResult) : null;

  return (
    <div className={isLast ? "" : "mb-12"}>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h3 className="font-mono text-sm font-bold text-white">{intent.name}</h3>
        <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${severityBadge}`}>
          {sev === "critical" ? "Critical" : "Warning"}
        </span>
      </div>
      <p className="font-mono text-[11px] text-zinc-500 mb-4">
        {intent.sessions} sessions &middot; {Math.round(intent.successRate * 100)}% success
      </p>

      {/* Root cause (Claude only) */}
      {claudeIntent?.rootCause && (
        <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">{claudeIntent.rootCause}</p>
      )}

      {/* Failure breakdown */}
      {intent.failureBreakdown.length > 0 && (
        <>
          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">
            {isClaude ? "Failure breakdown" : "Outcome breakdown"}
          </p>
          <div className="space-y-2 mb-6">
            {intent.failureBreakdown.map((row, i) => {
              const color = row.label.toLowerCase().includes("success")
                ? "bg-emerald-400/70"
                : row.label.toLowerCase().includes("escalat")
                  ? "bg-amber-400/70"
                  : "bg-red-400";
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-10 shrink-0 text-right">
                    <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.percentage}%</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${row.percentage}%` }} />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Claude example conversation */}
      {claudeIntent?.exampleConversation && (
        <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
          <div className="space-y-0.5">
            {claudeIntent.exampleConversation.messages.slice(0, 8).map((msg, i) => (
              <Chat key={i} role={msg.role === "user" ? "user" : "ai"}>{msg.message}</Chat>
            ))}
            {claudeIntent.exampleConversation.messages.length > 8 && (
              <Chat role="system">{claudeIntent.exampleConversation.messages.length - 8} more messages...</Chat>
            )}
          </div>
          {claudeIntent.exampleConversation.annotation && (
            <Annotation>{claudeIntent.exampleConversation.annotation}</Annotation>
          )}
        </div>
      )}

      {/* Keyword example conversation */}
      {keywordIntent?.exampleConversation && keywordIntent.exampleConversation.messages.length > 0 && (
        <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Example conversation</p>
          <div className="space-y-0.5">
            {keywordIntent.exampleConversation.messages.slice(0, 8).map((msg, i) => (
              <Chat key={i} role={msg.role}>{msg.text}</Chat>
            ))}
          </div>
          <Annotation>
            Outcome: {keywordIntent.exampleConversation.outcome} &middot; Intent: {keywordIntent.exampleConversation.intentDisplayName}
          </Annotation>
        </div>
      )}

      {/* Downstream impact (Claude only) */}
      {claudeIntent?.downstreamImpact && (
        <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2">Downstream impact</p>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{claudeIntent.downstreamImpact}</p>
        </div>
      )}
    </div>
  );
}

// ─── Pattern Block ──────────────────────────────────────────────────────────

type AnyPattern = { name: string; label: string; count: number; description: string } & (
  | { examples: ClassifiedConversation[] }
  | { examples: ClaudePatternExample[]; emoji?: string; insight?: string; severity?: string }
);

function PatternBlock({ pattern, isClaude }: { pattern: AnyPattern; isClaude: boolean }) {
  const claudePattern = isClaude ? (pattern as unknown as ClaudePatternResult) : null;

  const badgeColors: Record<string, string> = {
    critical: "bg-red-500/[0.12] border border-red-500/20 text-red-400",
    warning: "bg-amber-500/[0.12] border border-amber-500/20 text-amber-400",
    info: "bg-zinc-500/[0.12] border border-zinc-500/20 text-zinc-400",
    polite_churner: "bg-red-500/[0.12] border border-red-500/20 text-red-400",
    exhaustion_loop: "bg-amber-500/[0.12] border border-amber-500/20 text-amber-400",
    frustration_signal: "bg-red-500/[0.12] border border-red-500/20 text-red-400",
  };

  const badge = claudePattern
    ? badgeColors[claudePattern.severity] || badgeColors.info
    : badgeColors[pattern.name] || badgeColors.info;

  return (
    <div className="mb-10">
      <div className="flex items-center gap-2.5 mb-1">
        {claudePattern?.emoji && <span className="text-base">{claudePattern.emoji}</span>}
        <h3 className="text-base font-bold text-white">{pattern.label}</h3>
        <span className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge}`}>
          {pattern.count} found
        </span>
      </div>
      <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">{pattern.description}</p>

      {/* Claude insight */}
      {claudePattern?.insight && (
        <p className="text-[12px] text-indigo-400/80 italic leading-relaxed mb-5">{claudePattern.insight}</p>
      )}

      {/* Claude pattern examples */}
      {claudePattern && claudePattern.examples.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {(claudePattern.examples as ClaudePatternExample[]).slice(0, 4).map((ex, i) => (
            <div key={i} className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
              <p className="text-[9px] font-mono text-zinc-600 mb-2">{ex.conversationId}</p>
              <p className="text-[12px] text-zinc-400 leading-snug mb-2">&ldquo;{ex.lastUserMessage}&rdquo;</p>
              <div className="space-y-0.5">
                <p className="text-[10px] font-mono text-emerald-400/60">{ex.reportedStatus}</p>
                <p className="text-[10px] font-mono text-red-400">{ex.actualStatus}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Keyword pattern examples */}
      {!isClaude && (pattern as { examples: ClassifiedConversation[] }).examples.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {((pattern as { examples: ClassifiedConversation[] }).examples).slice(0, 2).map((ex) => (
            <div key={ex.id} className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">{ex.id}</p>
              <div className="space-y-0.5">
                {ex.messages.slice(-4).map((msg, i) => (
                  <Chat key={i} role={msg.role}>{msg.text}</Chat>
                ))}
              </div>
              <div className="mt-2">
                <span className="text-[9px] font-mono text-zinc-600">{ex.outcome} &middot; {ex.messageCount} messages</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

export default function UploadPage() {
  const [state, setState] = useState<AppState>("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ conversation_id: null, role: null, message: null, timestamp: null });
  const [briefingData, setBriefingData] = useState<BriefingData | AnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Store raw rows for fallback
  const rawRowsRef = useRef<RawMessage[]>([]);

  const handleFileLoaded = useCallback((file: File, hdrs: string[], data: Record<string, string>[], count: number) => {
    setFileName(file.name);
    setFileSize(file.size);
    setRowCount(count);
    setHeaders(hdrs);
    setCsvData(data);
    setMapping(autoDetectMapping(hdrs));
    setState("preview");
  }, []);

  const handleMappingChange = useCallback((field: keyof ColumnMapping, value: string | null) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleRunAnalysis = useCallback(() => {
    setAnalysisError(null);
    setBriefingData(null);

    // Convert CSV rows using mapping
    const rows: RawMessage[] = csvData
      .map((row) => ({
        conversation_id: mapping.conversation_id ? row[mapping.conversation_id] : "",
        role: mapping.role ? row[mapping.role] : "",
        message: mapping.message ? row[mapping.message] : "",
        timestamp: mapping.timestamp ? row[mapping.timestamp] : undefined,
      }))
      .filter((r) => r.conversation_id && r.role && r.message);

    rawRowsRef.current = rows;

    // Group into conversations for the API
    const grouped = new Map<string, { role: string; text: string }[]>();
    for (const row of rows) {
      const id = row.conversation_id.trim();
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id)!.push({
        role: row.role.toLowerCase().includes("user") ? "user" : "assistant",
        text: row.message.trim(),
      });
    }
    const conversations = Array.from(grouped.entries()).map(([id, messages]) => ({ id, messages }));

    // Compute date range
    const timestamps = rows
      .filter((r) => r.timestamp)
      .map((r) => new Date(r.timestamp!))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    const dateRange = {
      start: timestamps[0]?.toISOString().split("T")[0] || "unknown",
      end: timestamps[timestamps.length - 1]?.toISOString().split("T")[0] || "unknown",
    };

    // Enter processing state immediately
    setState("processing");

    // Start API call
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversations,
            metadata: { fileName, totalRows: rowCount, dateRange },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        // Read streamed response
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let text = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }

        // Parse JSON — handle potential code fences
        let jsonStr = text.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        if (!jsonStr.startsWith("{")) {
          const match = jsonStr.match(/\{[\s\S]*\}/);
          if (match) jsonStr = match[0];
        }

        const result: AnalysisResponse = JSON.parse(jsonStr);
        if (!result.summary || !result.intents) {
          throw new Error("Invalid analysis response structure");
        }
        setBriefingData(result);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Claude analysis failed, falling back to keyword:", err);
        const fallback = analyzeConversations(rawRowsRef.current);
        setBriefingData(fallback);
        setAnalysisError(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, [csvData, mapping, fileName, rowCount]);

  const handleSampleData = useCallback(() => {
    window.location.href = "/";
  }, []);

  const handleNewAnalysis = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState("upload");
    setFileName("");
    setFileSize(0);
    setRowCount(0);
    setHeaders([]);
    setCsvData([]);
    setMapping({ conversation_id: null, role: null, message: null, timestamp: null });
    setBriefingData(null);
    setAnalysisError(null);
  }, []);

  // Count conversations for processing view
  const convIdCol = mapping.conversation_id;
  const convCount = convIdCol ? new Set(csvData.map((r) => r[convIdCol])).size : 0;

  return (
    <div className="min-h-screen bg-[#0a0b10] text-zinc-300 flex flex-col">
      <TopBar onNewAnalysis={handleNewAnalysis} showNew={state === "briefing"} />

      {state === "upload" && (
        <UploadView onFileLoaded={handleFileLoaded} onSampleData={handleSampleData} />
      )}

      {state === "preview" && (
        <PreviewView
          fileName={fileName} fileSize={fileSize} rowCount={rowCount} headers={headers}
          previewRows={csvData} mapping={mapping} onMappingChange={handleMappingChange}
          onRunAnalysis={handleRunAnalysis} onBack={handleNewAnalysis}
        />
      )}

      {state === "processing" && (
        <ProcessingView
          convCount={convCount}
          dataReady={briefingData !== null}
          error={analysisError}
          onComplete={() => setState("briefing")}
          onRetry={handleRunAnalysis}
        />
      )}

      {state === "briefing" && briefingData && (
        <BriefingView data={briefingData} fileName={fileName} analysisError={analysisError} />
      )}

      <footer className="border-t border-white/[0.05] py-6 text-center">
        <p className="text-[10px] text-zinc-700">IRL AI &middot; See what&rsquo;s actually happening</p>
      </footer>
    </div>
  );
}
