"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useAnalysis } from "@/lib/analysis-context";
import type { AnalysisResponse } from "@/lib/analyzer";

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadState = "idle" | "parsing" | "analyzing" | "error";

interface ConversationInput {
  id: string;
  messages: { role: string; text: string }[];
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): Record<string, string>[] {
  // Split handling multi-line quoted fields
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === "\n" && !inQuotes) {
      if (current.trim()) rows.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) rows.push(current);

  if (rows.length < 2) return [];

  const headers = parseCSVRow(rows[0]).map((h) => h.toLowerCase().trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const fields = parseCSVRow(rows[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = fields[j] ?? "";
    }
    records.push(record);
  }
  return records;
}

function groupConversations(records: Record<string, string>[]): ConversationInput[] {
  // Sort by conversation_id then timestamp
  const sorted = [...records].sort((a, b) => {
    const cmp = (a.conversation_id ?? "").localeCompare(b.conversation_id ?? "");
    if (cmp !== 0) return cmp;
    return (a.timestamp ?? "").localeCompare(b.timestamp ?? "");
  });

  const groups = new Map<string, { role: string; text: string }[]>();
  for (const row of sorted) {
    const id = row.conversation_id;
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    const role = row.role ?? "unknown";
    const text = row.message ?? row.text ?? "";
    if (text) groups.get(id)!.push({ role, text });
  }

  return Array.from(groups.entries())
    .filter(([, msgs]) => msgs.length > 0)
    .map(([id, messages]) => ({ id, messages }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const { setResults } = useAnalysis();

  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("");

  // ── Process file ─────────────────────────────────────────────────────────
  const processFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setState("parsing");
      setError(null);
      setStatusText("Parsing CSV...");

      try {
        // 1. Read and parse CSV
        const text = await file.text();
        const records = parseCSV(text);

        if (records.length === 0) {
          throw new Error("CSV file is empty or could not be parsed.");
        }

        // 2. Validate required columns
        const columns = Object.keys(records[0]);
        if (!columns.includes("conversation_id")) {
          throw new Error(
            "Missing required column: conversation_id. Found columns: " +
              columns.join(", ")
          );
        }

        // 3. Group by conversation_id
        const conversations = groupConversations(records);

        if (conversations.length < 3) {
          throw new Error(
            `Found only ${conversations.length} conversation(s). Upload at least 3 for a meaningful analysis.`
          );
        }

        setStatusText(
          `Found ${conversations.length} conversations. Sending to Claude for analysis...`
        );
        setState("analyzing");

        // 4. Send to /api/analyze
        const totalMessages = conversations.reduce(
          (sum, c) => sum + c.messages.length,
          0
        );
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversations,
            metadata: {
              fileName: file.name,
              totalConversations: conversations.length,
              totalMessages,
            },
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error || `Analysis failed (${res.status})`
          );
        }

        // 5. Stream and collect response
        setStatusText("Claude is analyzing your conversations...");
        const responseText = await res.text();

        // 6. Strip markdown fences if present
        let jsonText = responseText.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText
            .replace(/^```(?:json)?\s*\n?/, "")
            .replace(/\n?```\s*$/, "");
        }

        // 7. Parse JSON
        let analysisData: AnalysisResponse;
        try {
          analysisData = JSON.parse(jsonText);
        } catch {
          throw new Error(
            "Failed to parse analysis response. The AI returned invalid JSON."
          );
        }

        // 8. Store in context and navigate
        setResults({
          job_id: "upload-" + Date.now(),
          data: analysisData,
        });
        router.push("/");
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [setResults, router]
  );

  // ── Dropzone ────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) processFile(accepted[0]);
    },
    [processFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: state === "parsing" || state === "analyzing",
  });

  // ── Reset ───────────────────────────────────────────────────────────────
  function reset() {
    setState("idle");
    setError(null);
    setFileName(null);
    setStatusText("");
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Upload Conversations
        </h1>
        <p className="text-sm text-zinc-500 mb-8 text-center">
          Upload a CSV file with your AI conversation logs to get started.
        </p>

        {/* Dropzone / Status */}
        {state === "idle" && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${isDragActive
                ? "border-indigo-500 bg-indigo-500/[0.08]"
                : "border-white/[0.1] hover:border-indigo-500/40 hover:bg-white/[0.02]"
              }
            `}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/[0.1] flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-zinc-300 font-medium">
                  {isDragActive ? "Drop your file here" : "Drag & drop your CSV here"}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  or click to browse &middot; .csv only
                </p>
              </div>
            </div>
          </div>
        )}

        {(state === "parsing" || state === "analyzing") && (
          <div className="border border-white/[0.08] rounded-2xl p-10 text-center">
            <div className="flex flex-col items-center gap-5">
              {/* Spinner */}
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
              </div>

              <div>
                <p className="text-sm text-white font-medium">
                  {state === "parsing"
                    ? "Parsing your CSV..."
                    : "Analyzing your conversations with Claude..."}
                </p>
                {fileName && (
                  <p className="text-xs text-zinc-500 mt-1">{fileName}</p>
                )}
                {statusText && (
                  <p className="text-xs text-zinc-400 mt-2">{statusText}</p>
                )}
              </div>

              {state === "analyzing" && (
                <div className="w-full max-w-xs">
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500/60 animate-pulse w-2/3" />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2">
                    This may take a minute depending on file size
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="border border-red-500/20 rounded-2xl p-10 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/[0.1] flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-red-400 font-medium">
                  Something went wrong
                </p>
                <p className="text-xs text-zinc-500 mt-1">{error}</p>
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Required columns hint */}
        {state === "idle" && (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-2">
              Required CSV columns
            </p>
            <div className="flex flex-wrap gap-2">
              {["conversation_id", "role", "message", "timestamp"].map((col) => (
                <span
                  key={col}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] text-[11px] text-zinc-400 font-mono"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
