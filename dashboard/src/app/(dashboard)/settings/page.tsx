"use client";

export default function Settings() {
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Dashboard configuration</p>
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] divide-y divide-white/[0.05]">
        {/* Dataset */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Dataset</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Source</span>
              <span className="text-zinc-200 font-mono">tucnguyen/ShareChat</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Platforms</span>
              <span className="text-zinc-200">ChatGPT, Claude, Gemini, Grok, Perplexity</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Language filter</span>
              <span className="text-zinc-200">English only</span>
            </div>
          </div>
        </div>

        {/* Analysis workers */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Analysis Workers</p>
          <div className="space-y-3 text-sm text-zinc-400">
            <p>Run workers from the <code className="bg-white/[0.06] text-zinc-300 px-1 py-0.5 rounded text-xs">backend/</code> directory:</p>
            <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-300 space-y-1">
              <p className="text-zinc-600"># Test run (1,000 conversations)</p>
              <p>python -m scripts.test_workers</p>
              <p className="text-zinc-600 mt-2"># Custom sample size</p>
              <p>python -m scripts.test_workers --target 5000 --min-turns 3</p>
              <p className="text-zinc-600 mt-2"># Failure pattern clustering</p>
              <p>python -m workers.failure_cluster</p>
            </div>
          </div>
        </div>

        {/* Environment */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Required Environment Variables</p>
          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-400 space-y-1">
            <p><span className="text-zinc-600"># backend/.env</span></p>
            <p>SUPABASE_URL=...</p>
            <p>SUPABASE_KEY=...</p>
            <p>OPENAI_API_KEY=...</p>
            <p className="mt-2"><span className="text-zinc-600"># dashboard/.env.local</span></p>
            <p>NEXT_PUBLIC_SUPABASE_URL=...</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
