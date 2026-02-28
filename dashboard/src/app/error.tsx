'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/[0.12] border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-bold text-white mb-2">Analysis Error</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Something went wrong while processing your conversation data. This might be a temporary issue.
          </p>
          
          <div className="bg-[#13141b] border border-white/[0.07] rounded-lg p-3 mb-6">
            <p className="text-xs font-mono text-red-400 break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs font-mono text-zinc-600 mt-1">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-[#8178ff] text-white text-sm font-semibold hover:bg-[#9490ff] hover:shadow-[0_0_20px_rgba(129,120,255,0.3)] transition-all"
          >
            Try Again
          </button>
          <a 
            href="/"
            className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-white/[0.15] transition-colors"
          >
            Back to Demo
          </a>
        </div>
        
        <div className="mt-8">
          <p className="text-xs text-zinc-600">
            If this problem persists, contact{' '}
            <a href="mailto:linda@convometrics.com" className="text-[#8178ff] hover:text-[#9490ff]">
              linda@convometrics.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}