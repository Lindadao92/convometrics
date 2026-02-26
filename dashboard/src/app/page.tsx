"use client";

// ─── IRL AI — Demo Briefing Page ─────────────────────────────────────────────
// Single scrollable briefing. No tabs, no sidebar. Dense analyst report.

// ─── Top Bar ─────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <header className="sticky top-0 z-50 h-14 shrink-0 border-b border-white/[0.06] bg-[#0a0b10]/90 backdrop-blur-md flex items-center justify-between px-6">
      <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        IRL AI
      </span>
      <button
        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#8178ff] text-white hover:bg-[#9490ff] hover:shadow-[0_0_20px_rgba(129,120,255,0.3)] transition-all cursor-pointer"
      >
        Upload Your Data
      </button>
    </header>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-white/[0.05] py-12 first:pt-10 last:border-b-0">
      {children}
    </section>
  );
}

// ─── Chat bubble ─────────────────────────────────────────────────────────────

function Chat({ role, children }: { role: "user" | "ai" | "system"; children: React.ReactNode }) {
  if (role === "system") {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[10px] font-mono text-zinc-600 italic">{children}</span>
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <div className={`flex gap-2.5 py-1.5 ${isUser ? "" : ""}`}>
      <span className="shrink-0 text-sm mt-0.5">{isUser ? "\uD83D\uDC64" : "\uD83E\uDD16"}</span>
      <p className={`text-[13px] leading-relaxed ${isUser ? "text-zinc-300" : "text-zinc-500"}`}>{children}</p>
    </div>
  );
}

function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-amber-500/30">
      <p className="text-[11px] text-amber-400/80 leading-relaxed italic">{children}</p>
    </div>
  );
}

// ─── Intent Map Item ─────────────────────────────────────────────────────────

function IntentBlock({ name, sessions, success, status }: {
  name: string; sessions: number; success: number | null; status: "critical" | "warning" | "good" | "info";
}) {
  const colors = {
    critical: { bar: "bg-red-400", text: "text-red-400", bg: "bg-red-400/[0.06] border-red-400/[0.12]" },
    warning: { bar: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-400/[0.06] border-amber-400/[0.12]" },
    good: { bar: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/[0.06] border-emerald-400/[0.12]" },
    info: { bar: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/[0.06] border-zinc-500/[0.12]" },
  };
  const c = colors[status];
  return (
    <div className={`rounded-lg border p-3 ${c.bg}`}>
      <p className="font-mono text-[11px] font-semibold text-zinc-300 mb-1.5 truncate">{name}</p>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] text-zinc-500 font-mono">{sessions} sess</span>
        {success !== null ? (
          <span className={`text-[10px] font-mono font-semibold ${c.text}`}>{success}%</span>
        ) : (
          <span className="text-[10px] font-mono text-zinc-600">signal</span>
        )}
      </div>
      {success !== null && (
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${success}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0b10] flex flex-col">
      <TopBar />
      <main className="flex-1">
        <div className="max-w-[720px] mx-auto px-5">

          {/* ── SECTION 1: BRIEFING HEADER ── */}
          <Section>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">IRL Briefing</p>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Flowbase AI Support Agent</h1>
            <p className="text-sm text-zinc-400 mb-2">Analysis of 4,832 conversations &middot; Feb 10&ndash;17, 2025</p>
            <p className="text-[11px] text-zinc-600 bg-white/[0.03] border border-white/[0.06] rounded-md px-3 py-1.5 inline-block">
              Demo analysis &mdash; <a href="#cta" className="text-indigo-400 hover:text-indigo-300 transition-colors">Upload your own data</a> to get your IRL briefing
            </p>
          </Section>

          {/* ── SECTION 2: THE REALITY CHECK ── */}
          <Section id="reality-check">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-6">The Reality Check</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 rounded-xl border border-white/[0.07] overflow-hidden">
              {/* Left — what dashboard says */}
              <div className="bg-[#0e1017] p-5 sm:border-r border-b sm:border-b-0 border-white/[0.07]">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-4">What your dashboard says</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Resolution Rate</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">72%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Avg CSAT</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">3.8<span className="text-base text-zinc-600">/5</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Avg Response Time</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">1.2s</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Conversations Handled</p>
                    <p className="font-mono text-2xl font-semibold text-zinc-500">4,832</p>
                  </div>
                </div>
              </div>

              {/* Right — what's actually happening */}
              <div className="bg-[#13141b] p-5">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/70 mb-4">What&rsquo;s actually happening</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Actual Resolution Rate</p>
                    <p className="font-mono text-2xl font-bold text-red-400">54%</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">847 &ldquo;resolved&rdquo; conversations reopened within 72hrs</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Effective CSAT</p>
                    <p className="font-mono text-2xl font-bold text-red-400">3.1<span className="text-base text-red-400/60">/5</span></p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Excluding false-positive &ldquo;ok thanks&rdquo; closures</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Avg Messages to Resolution</p>
                    <p className="font-mono text-2xl font-bold text-amber-400">8.4</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">Successful resolutions avg 3.2 messages. Your &ldquo;resolved&rdquo; ones avg 8.4 &mdash; most are exhaustion, not resolution</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 mb-0.5">Meaningful Conversations</p>
                    <p className="font-mono text-2xl font-bold text-white">3,614</p>
                    <p className="text-[11px] text-zinc-500 leading-snug mt-0.5">1,218 were loops, dead-ends, or premature closures</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── SECTION 3: INTENT MAP ── */}
          <Section id="intent-map">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Intent Map</p>
            <p className="text-sm text-zinc-400 mb-6">Every conversation classified by user intent and outcome</p>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2">Critical &mdash; failing</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="plan_upgrade_with_conditions" sessions={341} success={11} status="critical" />
                <IntentBlock name="account_access_recovery" sessions={189} success={34} status="critical" />
                <IntentBlock name="cancel_with_retention_offer" sessions={156} success={28} status="critical" />
                <IntentBlock name="billing_proration_inquiry" sessions={124} success={22} status="critical" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-amber-400/60 mb-2">Needs attention</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="team_seat_management" sessions={98} success={52} status="warning" />
                <IntentBlock name="integration_setup_help" sessions={87} success={45} status="warning" />
                <IntentBlock name="data_export_request" sessions={73} success={61} status="warning" />
                <IntentBlock name="custom_field_config" sessions={56} success={48} status="warning" />
              </div>
            </div>

            <div className="mb-3">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-emerald-400/60 mb-2">Performing well</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="order_status_check" sessions={892} success={94} status="good" />
                <IntentBlock name="password_reset" sessions={634} success={91} status="good" />
                <IntentBlock name="basic_pricing_question" sessions={445} success={88} status="good" />
                <IntentBlock name="update_payment_method" sessions={312} success={85} status="good" />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-2">Notable signals</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <IntentBlock name="competitor_comparison" sessions={42} success={null} status="info" />
                <IntentBlock name="feature_request_logging" sessions={67} success={89} status="good" />
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
              <p className="text-[13px] text-zinc-400 leading-relaxed">
                <span className="text-white font-semibold">14 intents classified.</span>{" "}
                4 critical, 4 need attention, 4 performing well.
                Your AI handles simple lookups excellently but fails on anything requiring conditional logic or system write-access.
              </p>
            </div>
          </Section>

          {/* ── SECTION 4: DEEP DIVES ── */}
          <Section id="deep-dives">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Deep Dives</p>
            <p className="text-sm text-zinc-400 mb-8">Full investigation of the 3 worst-performing intents</p>

            {/* ── Deep Dive 1: plan_upgrade_with_conditions ── */}
            <div className="mb-12">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">plan_upgrade_with_conditions</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Critical</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">341 sessions &middot; 11% success</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                Users ask conditional upgrade questions. The AI answers the general upgrade flow confidently while missing their actual question entirely.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 58, label: "AI answered general upgrade flow, missed the conditional question entirely", color: "bg-red-400" },
                  { pct: 24, label: "AI acknowledged the condition but gave incorrect information", color: "bg-red-400/70" },
                  { pct: 12, label: 'AI correctly identified the question but said "contact support for billing questions"', color: "bg-amber-400/70" },
                  { pct: 6, label: "Successful — AI actually answered the conditional question", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I want to upgrade to Team but I have 3 months left on annual. Do I keep unused months as credit?</Chat>
                  <Chat role="ai">Great choice! To upgrade, go to Settings &rarr; Billing &rarr; Change Plan. The Team plan includes collaboration tools, shared workspaces, and priority support!</Chat>
                  <Chat role="user">I know how to upgrade. I&rsquo;m asking what happens to the 3 months I already paid for</Chat>
                  <Chat role="ai">When you upgrade, your new plan starts immediately. You can view billing history in Settings &rarr; Billing &rarr; History.</Chat>
                  <Chat role="user">That doesn&rsquo;t answer my question at all</Chat>
                  <Chat role="ai">I apologize for any confusion! For specific billing inquiries about proration, I&rsquo;d recommend reaching out to our billing team at billing@flowbase.com. Is there anything else I can help with?</Chat>
                  <Chat role="user">no thanks</Chat>
                  <Chat role="system">Resolved &middot; Sentiment: Neutral</Chat>
                </div>
                <Annotation>&ldquo;User asked about credit proration. AI responded with upgrade instructions. The actual question was never addressed in 6 messages.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">89%</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">subsequently contacted human support</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">14 min</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">avg human handle time (vs 6 min normal)</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">Escalations consistently start with user frustration about the AI, adding emotional labor for the human agent. Estimated cost: <span className="text-white font-semibold">~$2,400/week</span> in avoidable human support time.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deep Dive 2: account_access_recovery ── */}
            <div className="mb-12">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">account_access_recovery</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Critical</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">189 sessions &middot; 34% success</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                Users locked out of accounts enter a circular dependency &mdash; the verification flow requires access to the email they can&rsquo;t reach.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 44, label: "AI sent verification to the inaccessible email, user pointed this out, AI sent it again", color: "bg-red-400" },
                  { pct: 28, label: 'AI recognized the issue but had no alternative flow, told user to "wait 24 hours and try again"', color: "bg-red-400/70" },
                  { pct: 18, label: "AI escalated to human after 4+ failed attempts", color: "bg-amber-400/70" },
                  { pct: 10, label: "Successful — user had access to backup method", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I can&rsquo;t log in, I changed my email and now I&rsquo;m locked out</Chat>
                  <Chat role="ai">I can help! I&rsquo;ll send a verification code to your email on file. Please check your inbox.</Chat>
                  <Chat role="user">That&rsquo;s the old email. I can&rsquo;t access it. That&rsquo;s why I&rsquo;m locked out.</Chat>
                  <Chat role="ai">I understand. For security purposes, we need to verify your identity. I&rsquo;ll send a new code to your registered email address.</Chat>
                  <Chat role="user">You&rsquo;re sending it to the email I just told you I can&rsquo;t access</Chat>
                  <Chat role="ai">I apologize for the inconvenience. For account security, verification must be sent to the email associated with your account. If you&rsquo;re unable to access this email, please try again in 24 hours or contact our support team.</Chat>
                  <Chat role="user">This is your support team</Chat>
                </div>
                <Annotation>&ldquo;The AI repeated the same inaccessible verification step 3 times. No alternative recovery path exists in the AI&rsquo;s toolkit.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-red-400/[0.04] border border-red-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-red-400 leading-none">82%</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">ended in human escalation (highest of any intent)</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-400 leading-none">3.2</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">avg messages wasted in the loop before giving up</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">Users arrive at human support already frustrated after 4+ failed AI attempts. This is the highest escalation rate of any intent.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deep Dive 3: cancel_with_retention_offer ── */}
            <div>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h3 className="font-mono text-sm font-bold text-white">cancel_with_retention_offer</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/[0.12] border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Warning</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-4">156 sessions &middot; 28% success</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                The AI successfully presents the retention offer, but can&rsquo;t answer follow-up questions about offer terms. It goes generic at the exact moment of highest save-potential.
              </p>

              {/* Failure breakdown */}
              <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Failure breakdown</p>
              <div className="space-y-2 mb-6">
                {[
                  { pct: 52, label: "AI presented offer, user asked follow-up, AI fell back to generic cancellation flow", color: "bg-amber-400" },
                  { pct: 22, label: "AI presented offer, user accepted, but AI couldn't process it (no system write access)", color: "bg-amber-400/70" },
                  { pct: 16, label: "AI skipped the retention offer entirely and processed cancellation", color: "bg-red-400/70" },
                  { pct: 10, label: "Successful save", color: "bg-emerald-400/70" },
                ].map((row, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-10 shrink-0 text-right">
                      <span className="font-mono text-[11px] font-semibold text-zinc-400">{row.pct}%</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 rounded-full bg-white/[0.06] mb-1 overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-snug">{row.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conversation example */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">I want to cancel my subscription</Chat>
                  <Chat role="ai">I&rsquo;m sorry to hear that! Before you go &mdash; we&rsquo;d like to offer you 3 months at 50% off. That&rsquo;s $14.50/month instead of $29. Would you like to continue with this offer?</Chat>
                  <Chat role="user">Maybe. If I take it, can I still cancel after those 3 months without penalty?</Chat>
                  <Chat role="ai">To cancel your subscription, go to Settings &rarr; Billing &rarr; Cancel Plan. You can cancel at any time. Would you like me to walk you through the cancellation process?</Chat>
                  <Chat role="user">No I was asking about the discount offer. Does it lock me in?</Chat>
                  <Chat role="ai">Our subscription is flexible and you can cancel anytime! To proceed with cancellation, please visit Settings &rarr; Billing &rarr; Cancel Plan.</Chat>
                </div>
                <Annotation>&ldquo;User was considering the retention offer. AI interpreted the follow-up question as a cancellation request and abandoned the save attempt.&rdquo;</Annotation>
              </div>

              {/* Downstream impact */}
              <div className="bg-amber-400/[0.04] border border-amber-400/[0.1] rounded-lg p-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-amber-400/60 mb-2.5">Downstream impact</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-400 leading-none">~24</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">saves/week lost to offer follow-up failure</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-amber-400 leading-none">$8,352</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">/year in recoverable revenue</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-zinc-500 leading-relaxed mt-1">The AI had the user&rsquo;s attention and interest &mdash; then lost them. At $29/month average, each lost save compounds.</p>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── SECTION 5: HIDDEN PATTERNS ── */}
          <Section id="patterns">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Hidden Patterns</p>
            <p className="text-sm text-zinc-400 mb-8">Cross-conversation patterns no single-session analysis would catch</p>

            {/* Pattern: The Polite Churner */}
            <div className="mb-10">
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-base font-bold text-white">The Polite Churner</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded">\u26A0 churn risk</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">217 users this week &middot; 34 cancelled within 7 days</p>

              {/* Funnel */}
              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-5">
                <div className="space-y-0">
                  {[
                    { value: "4,832", label: "conversations", w: "100%" },
                    { value: "847", label: 'marked "resolved" after user stopped responding', w: "68%" },
                    { value: "217", label: 'ended with polite language ("ok thanks", "that\'s fine")', w: "40%" },
                    { value: "217", label: "AI flagged: \u2705 Resolved, Positive Sentiment", w: "40%", color: "text-emerald-400/60" },
                    { value: "34", label: "cancelled subscription within 7 days", w: "16%", color: "text-red-400" },
                    { value: "0", label: "were flagged as at-risk by any existing system", w: "4%", color: "text-red-400" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div className="shrink-0 w-16 text-right">
                        <span className={`font-mono text-sm font-bold ${step.color ?? "text-zinc-300"}`}>{step.value}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded-full bg-zinc-600/40" style={{ width: step.w }} />
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 flex-[2]">{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real examples */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { msg: "Ok I'll figure it out, thanks anyway", result: "Cancelled 3 days later" },
                  { msg: "That's fine, don't worry about it", result: "Cancelled 5 days later" },
                  { msg: "No that's all, thanks for your help", result: "Downgraded 2 days later" },
                ].map((ex, i) => (
                  <div key={i} className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-3">
                    <p className="text-[12px] text-zinc-400 leading-snug mb-2">&ldquo;{ex.msg}&rdquo;</p>
                    <p className="text-[10px] font-mono text-emerald-400/60 mb-0.5">\u2705 Resolved &middot; Positive</p>
                    <p className="text-[10px] font-mono text-red-400">\u274C {ex.result}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pattern: Frustration Transfer */}
            <div className="mb-10">
              <h3 className="text-base font-bold text-white mb-1">Frustration Transfer</h3>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">847 escalations analyzed</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-red-400/60 mb-3">Path A: User &rarr; AI (fail) &rarr; Human</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-mono text-2xl font-bold text-red-400 leading-none">2.1<span className="text-sm text-red-400/60">/5</span></p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">CSAT</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">18 min</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">avg resolution time</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">68%</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">users arrived frustrated/angry</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4">
                  <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-emerald-400/60 mb-3">Path B: User &rarr; Human (direct)</p>
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-mono text-2xl font-bold text-emerald-400 leading-none">4.2<span className="text-sm text-emerald-400/60">/5</span></p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">CSAT</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">6 min</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">avg resolution time</p>
                    </div>
                    <div>
                      <p className="font-mono text-lg font-bold text-zinc-400 leading-none">12%</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">users arrived frustrated/angry</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  Same agents. Same issue types. Same resolutions. <span className="text-white font-semibold">The only difference is what happened before they got there.</span>
                </p>
              </div>
            </div>

            {/* Pattern: The Exhaustion Loop */}
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h3 className="text-base font-bold text-white">The Exhaustion Loop</h3>
                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/[0.12] border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">new pattern</span>
              </div>
              <p className="font-mono text-[11px] text-zinc-500 mb-5">23% of all failed conversations</p>

              <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                In 23% of failures, users rephrased their question 3&ndash;6 times. The AI gave a slightly different but equally unhelpful response each time. Your analytics platform logs these as &ldquo;high engagement&rdquo; sessions with 8+ messages. IRL, they&rsquo;re your most frustrated users.
              </p>

              <div className="bg-[#0e1017] border border-white/[0.07] rounded-lg p-4 mb-4">
                <p className="text-[9px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-3">Real conversation</p>
                <div className="space-y-0.5">
                  <Chat role="user">How do I transfer my data to the new workspace?</Chat>
                  <Chat role="ai">You can manage your data in Settings &rarr; Data Management. Here you can export, import, and organize your workspace data.</Chat>
                  <Chat role="user">No, I mean migrate between workspaces</Chat>
                  <Chat role="ai">To manage your workspaces, go to Settings &rarr; Workspaces. You can view all your workspaces and their data settings from there.</Chat>
                  <Chat role="user">Transfer. My. Data. From workspace A to workspace B.</Chat>
                  <Chat role="ai">I understand you want to manage your workspace data! In Settings &rarr; Data Management, you can export your data as a CSV file, which you can then use in any workspace.</Chat>
                  <Chat role="user">Forget it</Chat>
                  <Chat role="system">6 messages &middot; High engagement &middot; Resolved</Chat>
                </div>
                <Annotation>&ldquo;Logged as a high-engagement, resolved session. In reality, the user asked the same question 3 times, got the same non-answer 3 times, and gave up.&rdquo;</Annotation>
              </div>
            </div>
          </Section>

          {/* ── SECTION 6: RECOMMENDED ACTIONS ── */}
          <Section id="actions">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-600 mb-1">Recommended Actions</p>
            <p className="text-sm text-zinc-400 mb-6">Prioritized by impact. What to fix this sprint.</p>

            <div className="space-y-4">
              {/* Action 1 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-red-500/[0.12] border border-red-500/20 text-red-400 px-2 py-0.5 rounded">High Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">plan_upgrade_with_conditions</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Add conditional billing logic to upgrade flow</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Medium</p>
                    <p className="text-[10px] text-zinc-600">Requires billing API context</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~160 fewer escalations/wk</p>
                    <p className="text-[10px] text-zinc-600">~$2,400/wk saved</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">CSAT recovery</p>
                    <p className="text-xs text-zinc-400 font-medium">+0.4 projected</p>
                    <p className="text-[10px] text-zinc-600">on human agents</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why first:</span> Highest volume failure with cascading downstream damage. Every missed upgrade question generates an angry escalation that takes 14 min instead of 6.
                </p>
              </div>

              {/* Action 2 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-amber-500/[0.12] border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Medium Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">account_access_recovery</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Add alternative identity verification for locked-out users</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Low</p>
                    <p className="text-[10px] text-zinc-600">Alternative flow, no new integrations</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~125 fewer support calls/wk</p>
                    <p className="text-[10px] text-zinc-600">Eliminates worst AI loop</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Escalation rate</p>
                    <p className="text-xs text-zinc-400 font-medium">82% &rarr; est. &lt;30%</p>
                    <p className="text-[10px] text-zinc-600">with alt verification</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why now:</span> Highest escalation rate (82%) and highest user frustration. The fix is straightforward &mdash; add phone/backup-email as an alternative verification step.
                </p>
              </div>

              {/* Action 3 */}
              <div className="bg-[#13141b] border border-white/[0.07] rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                  <span className="text-[9px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/[0.12] border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">Revenue Impact</span>
                  <span className="font-mono text-[10px] text-zinc-600">cancel_with_retention_offer</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Enable retention offer Q&A and acceptance processing</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Effort</p>
                    <p className="text-xs text-zinc-400 font-medium">Medium</p>
                    <p className="text-[10px] text-zinc-600">Offer terms FAQ + billing write access</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Impact</p>
                    <p className="text-xs text-zinc-400 font-medium">~24 additional saves/wk</p>
                    <p className="text-[10px] text-zinc-600">~$8,352/yr recoverable</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-0.5">Opportunity</p>
                    <p className="text-xs text-zinc-400 font-medium">AI already hooks them</p>
                    <p className="text-[10px] text-zinc-600">Just can&rsquo;t close</p>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <span className="text-zinc-400 font-medium">Why now:</span> The AI already gets the user interested in staying &mdash; it just can&rsquo;t close. This is the rare case where the hard part (changing the user&rsquo;s mind) is already done.
                </p>
              </div>
            </div>
          </Section>

          {/* ── SECTION 7: FOOTER CTA ── */}
          <section id="cta" className="py-16 text-center">
            <p className="text-[13px] text-zinc-500 leading-relaxed max-w-md mx-auto mb-8">
              This is a demo analysis of a fictional AI support agent.<br />
              Want to see what IRL finds in <span className="text-white font-semibold">your</span> conversations?
            </p>
            <div className="flex gap-3 justify-center flex-wrap mb-4">
              <a
                href="mailto:linda@irlai.com"
                className="px-6 py-2.5 rounded-lg bg-[#8178ff] text-white text-sm font-semibold hover:bg-[#9490ff] hover:shadow-[0_0_24px_rgba(129,120,255,0.35)] transition-all"
              >
                Upload Your Data
              </a>
              <a
                href="mailto:linda@irlai.com"
                className="px-6 py-2.5 rounded-lg border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-white/[0.15] transition-colors"
              >
                Book a Call
              </a>
            </div>
            <p className="text-[11px] text-zinc-600">We analyze your first 1,000 conversations free. No credit card. No commitment.</p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.05] py-4 text-center">
        <p className="text-[11px] text-zinc-700">&copy; 2025 IRL AI</p>
      </footer>
    </div>
  );
}
