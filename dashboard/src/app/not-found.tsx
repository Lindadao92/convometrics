import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-white mb-2">404</h1>
          <h2 className="text-2xl font-semibold text-zinc-400 mb-4">Page Not Found</h2>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            This conversation got lost in the pattern analysis. Let's get you back on track.
          </p>
        </div>
        
        <div className="flex gap-4 justify-center flex-wrap">
          <Link 
            href="/"
            className="px-6 py-2.5 rounded-lg bg-[#8178ff] text-white text-sm font-semibold hover:bg-[#9490ff] hover:shadow-[0_0_24px_rgba(129,120,255,0.35)] transition-all"
          >
            View Demo
          </Link>
          <Link 
            href="/upload"
            className="px-6 py-2.5 rounded-lg border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-white/[0.15] transition-colors"
          >
            Upload Data
          </Link>
        </div>
        
        <div className="mt-12 text-center">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-500 transition-colors">
            &larr; Back to ConvoMetrics
          </Link>
        </div>
      </div>
    </div>
  )
}