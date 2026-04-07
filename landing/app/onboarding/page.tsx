"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;
type Platform = "retell" | "vapi" | "other";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0A0A0F" }} />}>
      <OnboardingInner />
    </Suspense>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      style={S.copyBtn}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied \u2713" : "Copy"}
    </button>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.codeRow}>
      <div style={S.codeLabel}>{label}</div>
      <div style={S.codeBlock}>
        <code style={S.codeText}>{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 2
  const [platform, setPlatform] = useState<Platform | null>(null);

  // From API
  const [webhookSecret, setWebhookSecret] = useState("");

  async function handleGetStarted() {
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account");

      setWebhookSecret(data.webhook_secret || "");
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handlePlatformSelect(p: Platform) {
    setPlatform(p);
    setStep(3);
  }

  const webhookUrls: Record<Platform, string> = {
    retell: "https://convometrics.vercel.app/api/webhooks/retell",
    vapi: "https://convometrics.vercel.app/api/webhooks/vapi",
    other: "https://convometrics.vercel.app/api/webhooks/generic",
  };

  return (
    <div style={S.page}>
      {/* Step indicator */}
      <div style={S.stepRow}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={S.stepItem}>
            <div style={{
              ...S.stepDot,
              background: n <= step ? "#7C6EF8" : "#2A2A38",
            }} />
            <span style={{
              ...S.stepLabel,
              color: n <= step ? "#F0EEF8" : "#4A4A5E",
            }}>
              {n === 1 ? "Your email" : n === 2 ? "Platform" : "Connect"}
            </span>
          </div>
        ))}
      </div>

      <div style={S.card}>
        {/* Logo */}
        <a href="/" style={S.logo}>
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="6" width="3" height="8" rx="1" fill="#7C6EF8" />
            <rect x="6" y="1" width="3" height="14" rx="1" fill="#7C6EF8" />
            <rect x="11" y="4" width="3" height="10" rx="1" fill="#7C6EF8" />
          </svg>
          <span>ConvoMetrics</span>
        </a>

        {/* ── STEP 1: Email ── */}
        {step === 1 && (
          <>
            <h1 style={S.h1}>Connect your agent</h1>
            <p style={S.sub}>Get your webhook URL and start seeing resolution data in minutes.</p>

            <div style={S.fields}>
              <div style={S.field}>
                <label style={S.label}>Email address</label>
                <input
                  style={S.input}
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleGetStarted()}
                  autoFocus
                />
              </div>
              <div style={S.field}>
                <label style={S.label}>First name <span style={{ color: "#4A4A5E", fontWeight: 400 }}>(optional)</span></label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGetStarted()}
                />
              </div>
            </div>

            <button
              style={{ ...S.btn, opacity: loading || !email ? 0.5 : 1 }}
              onClick={handleGetStarted}
              disabled={loading || !email}
            >
              {loading ? "Setting up..." : "Get started"}
            </button>

            {error && <p style={S.error}>{error}</p>}
          </>
        )}

        {/* ── STEP 2: Platform ── */}
        {step === 2 && (
          <>
            <h1 style={S.h1}>Which platform are you using?</h1>
            <p style={S.sub}>We&rsquo;ll show you exactly where to paste your webhook URL.</p>

            <div style={S.platformGrid}>
              {([
                { id: "retell" as Platform, label: "Retell", desc: "Voice AI platform" },
                { id: "vapi" as Platform, label: "Vapi", desc: "Voice AI platform" },
                { id: "other" as Platform, label: "Other", desc: "Webhook / custom" },
              ]).map((p) => (
                <button
                  key={p.id}
                  style={{
                    ...S.platformBtn,
                    borderColor: platform === p.id ? "#7C6EF8" : "#2A2A38",
                    background: platform === p.id ? "rgba(124,110,248,0.1)" : "#111118",
                  }}
                  onClick={() => handlePlatformSelect(p.id)}
                >
                  <div style={S.platformName}>{p.label}</div>
                  <div style={S.platformDesc}>{p.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 3: Instructions ── */}
        {step === 3 && platform === "retell" && (
          <>
            <h1 style={S.h1}>Add your webhook in Retell</h1>
            <div style={S.steps}>
              <div style={S.instrStep}><span style={S.instrNum}>1</span> Go to your Retell dashboard &rarr; select your agent</div>
              <div style={S.instrStep}><span style={S.instrNum}>2</span> Click <strong style={{ color: "#F0EEF8" }}>&ldquo;Post-call webhook&rdquo;</strong> in agent settings</div>
              <div style={S.instrStep}>
                <span style={S.instrNum}>3</span> Paste this URL:
                <CodeBlock label="Webhook URL" value={webhookUrls.retell} />
              </div>
              <div style={S.instrStep}>
                <span style={S.instrNum}>4</span> Add this secret in the webhook secret field:
                <CodeBlock label="Secret" value={webhookSecret} />
              </div>
              <div style={S.instrStep}><span style={S.instrNum}>5</span> Save and make a test call</div>
            </div>
            <button style={S.btn} onClick={() => router.push("/demo")}>
              I&rsquo;ve added the webhook &rarr; Go to my dashboard
            </button>
            <button style={S.backBtn} onClick={() => setStep(2)}>&larr; Back</button>
          </>
        )}

        {step === 3 && platform === "vapi" && (
          <>
            <h1 style={S.h1}>Add your webhook in Vapi</h1>
            <div style={S.steps}>
              <div style={S.instrStep}><span style={S.instrNum}>1</span> Go to your Vapi dashboard &rarr; select your assistant</div>
              <div style={S.instrStep}><span style={S.instrNum}>2</span> Click <strong style={{ color: "#F0EEF8" }}>&ldquo;Server URL&rdquo;</strong> in assistant settings</div>
              <div style={S.instrStep}>
                <span style={S.instrNum}>3</span> Paste this URL:
                <CodeBlock label="Server URL" value={webhookUrls.vapi} />
              </div>
              <div style={S.instrStep}>
                <span style={S.instrNum}>4</span> Add this as a query param or header:
                <CodeBlock label="Secret" value={webhookSecret} />
              </div>
              <div style={S.instrStep}><span style={S.instrNum}>5</span> Save and make a test call</div>
            </div>
            <button style={S.btn} onClick={() => router.push("/demo")}>
              I&rsquo;ve added the webhook &rarr; Go to my dashboard
            </button>
            <button style={S.backBtn} onClick={() => setStep(2)}>&larr; Back</button>
          </>
        )}

        {step === 3 && platform === "other" && (
          <>
            <h1 style={S.h1}>Connect via webhook</h1>
            <p style={S.sub}>Send call data to this endpoint when a call ends.</p>

            <CodeBlock label="Webhook URL" value={webhookUrls.other} />
            <CodeBlock label="Secret (send as header)" value={webhookSecret} />

            <div style={S.codeRow}>
              <div style={S.codeLabel}>Header</div>
              <div style={S.codeBlock}>
                <code style={S.codeText}>x-webhook-secret: {webhookSecret}</code>
                <CopyButton text={`x-webhook-secret: ${webhookSecret}`} />
              </div>
            </div>

            <div style={S.codeRow}>
              <div style={S.codeLabel}>Payload format</div>
              <div style={{ ...S.codeBlock, flexDirection: "column", alignItems: "stretch" }}>
                <pre style={S.pre}>{`{
  "call_id": "unique-call-id",
  "transcript": "Agent: Hi... Customer: ...",
  "duration_seconds": 94
}`}</pre>
                <CopyButton text={`{
  "call_id": "unique-call-id",
  "transcript": "Agent: Hi... Customer: ...",
  "duration_seconds": 94
}`} />
              </div>
            </div>

            <button style={S.btn} onClick={() => router.push("/demo")}>
              Go to my dashboard
            </button>
            <button style={S.backBtn} onClick={() => setStep(2)}>&larr; Back</button>
          </>
        )}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
    background: "#0A0A0F",
  },
  stepRow: {
    display: "flex",
    gap: 32,
  },
  stepItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.3s",
  },
  stepLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    transition: "color 0.3s",
  },
  card: {
    background: "#16161F",
    border: "1px solid #2A2A38",
    borderRadius: 12,
    padding: "36px 32px",
    maxWidth: 480,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 500,
    color: "#F0EEF8",
    textDecoration: "none",
    marginBottom: 20,
  },
  h1: {
    fontSize: 20,
    fontWeight: 600,
    color: "#F0EEF8",
    textAlign: "center" as const,
    margin: "0 0 4px",
    lineHeight: 1.3,
  },
  sub: {
    fontSize: 14,
    color: "#8B8A9E",
    textAlign: "center" as const,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  fields: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
    width: "100%",
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
  },
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    color: "#8B8A9E",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "#111118",
    border: "1px solid #2A2A38",
    borderRadius: 6,
    color: "#F0EEF8",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },
  btn: {
    width: "100%",
    padding: "11px 20px",
    background: "#7C6EF8",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 16,
    transition: "opacity 0.2s",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#8B8A9E",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 10,
    padding: 0,
  },
  error: {
    color: "#EF4444",
    fontSize: 13,
    marginTop: 8,
    fontFamily: "'IBM Plex Mono', monospace",
    textAlign: "center" as const,
  },
  platformGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 10,
    width: "100%",
  },
  platformBtn: {
    padding: "20px 14px",
    border: "1px solid #2A2A38",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s",
  },
  platformName: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: "#F0EEF8",
  },
  platformDesc: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "#4A4A5E",
  },
  steps: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  instrStep: {
    fontSize: 14,
    color: "#8B8A9E",
    lineHeight: 1.6,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },
  instrNum: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    fontWeight: 500,
    color: "#7C6EF8",
    marginRight: 6,
  },
  codeRow: {
    width: "100%",
    marginTop: 8,
  },
  codeLabel: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    color: "#4A4A5E",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: 4,
  },
  codeBlock: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#111118",
    border: "1px solid #2A2A38",
    borderRadius: 6,
    padding: "8px 12px",
  },
  codeText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    color: "#F0EEF8",
    flex: 1,
    wordBreak: "break-all" as const,
  },
  pre: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    color: "#8B8A9E",
    margin: 0,
    whiteSpace: "pre" as const,
    lineHeight: 1.6,
  },
  copyBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    fontWeight: 500,
    padding: "4px 8px",
    background: "rgba(124,110,248,0.12)",
    color: "#7C6EF8",
    border: "1px solid rgba(124,110,248,0.2)",
    borderRadius: 3,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
};
