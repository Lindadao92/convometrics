import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IRL AI - Real AI Conversation Analytics",
  description: "Analyze ChatGPT, Claude, Gemini conversations to find hidden patterns traditional metrics miss. See actual success rates, not just completions. Built for AI product teams.",
  keywords: "AI analytics, conversation analysis, ChatGPT analytics, Claude analytics, AI product metrics, conversation intelligence, AI UX research",
  authors: [{ name: "Linda Dao", url: "https://linkedin.com/in/lindadao92" }],
  creator: "Linda Dao",
  publisher: "IRL AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://convometrics.vercel.app",
    siteName: "IRL AI",
    title: "IRL AI - Real AI Conversation Analytics",
    description: "Stop measuring vanity metrics. Start measuring what actually matters in your AI conversations.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "IRL AI - Real AI Conversation Analytics Dashboard"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "IRL AI - Real AI Conversation Analytics",
    description: "Analyze your AI conversations to find patterns traditional metrics miss.",
    creator: "@lindadao92",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
