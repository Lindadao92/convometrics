export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
          <div className="relative">
            <div className="w-16 h-16 border-2 border-zinc-800 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-2 border-[#8178ff] rounded-full animate-spin border-r-transparent border-b-transparent"></div>
          </div>
        </div>
        
        <h2 className="text-lg font-semibold text-white mb-2">Analyzing Conversations</h2>
        <p className="text-sm text-zinc-500">Finding patterns in your AI interactions...</p>
      </div>
    </div>
  )
}