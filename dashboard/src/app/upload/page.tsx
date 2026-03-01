"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { useAnalysis } from "@/lib/analysis-context";

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim();
const POLL_INTERVAL = 3000;

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "processing" | "complete" | "error";

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const { setResults } = useAnalysis();

  const [state, setState] = useState<UploadState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup polling on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Upload file ─────────────────────────────────────────────────────────────
  const uploadFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setState("uploading");
      setError(null);

      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch(`${API_BASE}/api/upload/`, {
          method: "POST",
          body: form,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.detail || `Upload failed (${res.status})`);
        }

        const { job_id } = await res.json();
        setJobId(job_id);
        setState("processing");
        startPolling(job_id);
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Poll for status ─────────────────────────────────────────────────────────
  function startPolling(id: string) {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${id}/status`);
        if (!res.ok) throw new Error("Failed to fetch job status");

        const { status } = await res.json();

        if (status === "complete") {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          await fetchResults(id);
        } else if (status === "failed") {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setState("error");
          setError("Analysis failed. Please try again.");
        }
        // "pending" / "processing" → keep polling
      } catch {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setState("error");
        setError("Lost connection while checking status.");
      }
    }, POLL_INTERVAL);
  }

  // ── Fetch results and navigate ──────────────────────────────────────────────
  async function fetchResults(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/jobs/${id}/results`);
      if (!res.ok) throw new Error("Failed to fetch results");

      const data = await res.json();
      setResults({ job_id: id, data });
      setState("complete");
      router.push("/");
    } catch {
      setState("error");
      setError("Failed to load analysis results.");
    }
  }

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) uploadFile(accepted[0]);
    },
    [uploadFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
    disabled: state === "uploading" || state === "processing",
  });

  // ── Reset ───────────────────────────────────────────────────────────────────
  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("idle");
    setJobId(null);
    setError(null);
    setFileName(null);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
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

        {(state === "uploading" || state === "processing") && (
          <div className="border border-white/[0.08] rounded-2xl p-10 text-center">
            <div className="flex flex-col items-center gap-5">
              {/* Spinner */}
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-500 animate-spin" />
              </div>

              <div>
                <p className="text-sm text-white font-medium">
                  {state === "uploading"
                    ? "Uploading..."
                    : "Analyzing your conversations with AI..."}
                </p>
                {fileName && (
                  <p className="text-xs text-zinc-500 mt-1">{fileName}</p>
                )}
                {jobId && (
                  <p className="text-[10px] text-zinc-700 mt-2 font-mono">
                    Job: {jobId}
                  </p>
                )}
              </div>

              {state === "processing" && (
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
