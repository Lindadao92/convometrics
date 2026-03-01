export function Chat({ role, children }: { role: "user" | "ai" | "assistant" | "system"; children: React.ReactNode }) {
  if (role === "system") {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="text-[10px] font-mono text-zinc-600 italic">{children}</span>
      </div>
    );
  }
  const isUser = role === "user";
  return (
    <div className="flex gap-2.5 py-1.5">
      <span className="shrink-0 text-sm mt-0.5">{isUser ? "\uD83D\uDC64" : "\uD83E\uDD16"}</span>
      <p className={`text-[13px] leading-relaxed ${isUser ? "text-zinc-300" : "text-zinc-500"}`}>{children}</p>
    </div>
  );
}

export function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 ml-7 pl-3 border-l-2 border-amber-500/30">
      <p className="text-[11px] text-amber-400/80 leading-relaxed italic">{children}</p>
    </div>
  );
}
