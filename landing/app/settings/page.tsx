"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  webhook_secret: string;
  vapi_api_key: string | null;
  retell_api_key: string | null;
  posthog_api_key: string | null;
  mixpanel_token: string | null;
  slack_webhook_url: string | null;
  linear_api_key: string | null;
  has_vapi: boolean;
  has_retell: boolean;
  has_posthog: boolean;
  has_mixpanel: boolean;
  has_slack: boolean;
  has_linear: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [posthogKey, setPosthogKey] = useState("");
  const [mixpanelToken, setMixpanelToken] = useState("");
  const [slackUrl, setSlackUrl] = useState("");
  const [linearKey, setLinearKey] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => {
        if (r.status === 401) { router.push("/onboarding"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setSettings(data);
        setLoading(false);
      });
  }, [router]);

  async function handleSave() {
    setSaving(true);
    const body: Record<string, string> = {};
    if (posthogKey) body.posthog_api_key = posthogKey;
    if (mixpanelToken) body.mixpanel_token = mixpanelToken;
    if (slackUrl) body.slack_webhook_url = slackUrl;
    if (linearKey) body.linear_api_key = linearKey;

    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Refresh settings
    const r = await fetch("/api/settings");
    if (r.ok) setSettings(await r.json());
  }

  function copyWebhook() {
    if (!settings) return;
    navigator.clipboard.writeText(
      `https://convometrics.vercel.app/api/webhooks/generic?secret=${settings.webhook_secret}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div style={s.page}><p style={s.muted}>Loading...</p></div>;
  }

  if (!settings) {
    return <div style={s.page}><p style={s.muted}>Not authenticated</p></div>;
  }

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <a href="/demo" style={s.navLogo}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="6" width="3" height="8" rx="1" fill="#7C6EF8" />
            <rect x="6" y="1" width="3" height="14" rx="1" fill="#7C6EF8" />
            <rect x="11" y="4" width="3" height="10" rx="1" fill="#7C6EF8" />
          </svg>
          ConvoMetrics
        </a>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/demo" style={s.navLink}>Dashboard</a>
          <a href="/calls" style={s.navLink}>Call Logs</a>
          <a href="/settings" style={{ ...s.navLink, color: "#7C6EF8" }}>Settings</a>
        </div>
      </nav>

      <div style={s.content}>
        <h1 style={s.h1}>Settings</h1>

        {/* Connected platform */}
        <div style={s.section}>
          <h2 style={s.h2}>Connected Platform</h2>
          {settings.has_vapi && (
            <div style={s.row}>
              <span style={s.label}>Vapi</span>
              <span style={s.masked}>{settings.vapi_api_key}</span>
            </div>
          )}
          {settings.has_retell && (
            <div style={s.row}>
              <span style={s.label}>Retell</span>
              <span style={s.masked}>{settings.retell_api_key}</span>
            </div>
          )}
          {!settings.has_vapi && !settings.has_retell && (
            <p style={s.muted}>No platform connected. <a href="/onboarding?step=platform" style={s.link}>Connect now</a></p>
          )}
        </div>

        {/* Webhook */}
        <div style={s.section}>
          <h2 style={s.h2}>Webhook URL</h2>
          <p style={s.muted2}>Point your platform's webhook to this URL to receive calls.</p>
          <div style={s.webhookRow}>
            <code style={s.code}>
              POST /api/webhooks/generic?secret={settings.webhook_secret}
            </code>
            <button style={s.copyBtn} onClick={copyWebhook}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Integrations */}
        <div style={s.section}>
          <h2 style={s.h2}>Integrations</h2>
          <div style={s.fields}>
            <div>
              <label style={s.fieldLabel}>PostHog API key {settings.has_posthog && <span style={s.connected}>connected</span>}</label>
              <input style={s.input} placeholder={settings.posthog_api_key || "phk_..."} value={posthogKey} onChange={(e) => setPosthogKey(e.target.value)} />
            </div>
            <div>
              <label style={s.fieldLabel}>Mixpanel token {settings.has_mixpanel && <span style={s.connected}>connected</span>}</label>
              <input style={s.input} placeholder={settings.mixpanel_token || "Token..."} value={mixpanelToken} onChange={(e) => setMixpanelToken(e.target.value)} />
            </div>
            <div>
              <label style={s.fieldLabel}>Slack webhook URL {settings.has_slack && <span style={s.connected}>connected</span>}</label>
              <input style={s.input} placeholder={settings.slack_webhook_url || "https://hooks.slack.com/..."} value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} />
            </div>
            <div>
              <label style={s.fieldLabel}>Linear API key {settings.has_linear && <span style={s.connected}>connected</span>}</label>
              <input style={s.input} placeholder={settings.linear_api_key || "lin_api_..."} value={linearKey} onChange={(e) => setLinearKey(e.target.value)} />
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0A0A0F" },
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    height: 52,
    background: "#111118",
    borderBottom: "0.5px solid #2A2A38",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
  },
  navLogo: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 14,
    fontWeight: 500,
    color: "#F0EEF8",
    textDecoration: "none",
  },
  navLink: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    fontWeight: 500,
    color: "#8B8A9E",
    textDecoration: "none",
    padding: "6px 12px",
    borderRadius: 4,
  },
  content: { maxWidth: 640, margin: "0 auto", padding: "32px 24px" },
  h1: { fontSize: 22, fontWeight: 600, marginBottom: 32 },
  section: {
    background: "#16161F",
    border: "0.5px solid #2A2A38",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 16,
  },
  h2: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    color: "#8B8A9E",
    marginBottom: 14,
  },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" },
  label: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 500, color: "#F0EEF8" },
  masked: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#4A4A5E" },
  muted: { fontSize: 13, color: "#8B8A9E" },
  muted2: { fontSize: 12, color: "#4A4A5E", marginBottom: 12 },
  link: { color: "#7C6EF8", textDecoration: "none" },
  webhookRow: { display: "flex", gap: 8, alignItems: "center" },
  code: {
    flex: 1,
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    color: "#8B8A9E",
    background: "#111118",
    padding: "8px 12px",
    borderRadius: 4,
    border: "1px solid #2A2A38",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  copyBtn: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    padding: "8px 12px",
    background: "rgba(124,110,248,0.12)",
    color: "#7C6EF8",
    border: "1px solid rgba(124,110,248,0.2)",
    borderRadius: 4,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  fields: { display: "flex", flexDirection: "column" as const, gap: 14 },
  fieldLabel: {
    display: "block",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    color: "#8B8A9E",
    marginBottom: 6,
  },
  connected: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 10,
    color: "#34D399",
    marginLeft: 8,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    background: "#111118",
    border: "1px solid #2A2A38",
    borderRadius: 6,
    color: "#F0EEF8",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 12,
    outline: "none",
  },
  saveBtn: {
    marginTop: 20,
    padding: "10px 24px",
    background: "#7C6EF8",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
