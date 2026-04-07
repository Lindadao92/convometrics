import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ConvoMetrics",
  description: "Conversation analytics for AI voice agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: "#0A0A0F", color: "#F0EEF8", margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
          input:focus { border-color: #7C6EF8 !important; }
          button:hover:not(:disabled) { filter: brightness(1.1); }
        `}</style>
        {children}
      </body>
    </html>
  );
}
