import Link from "next/link";

const COLORS = {
  critical: { bar: "bg-red-400", text: "text-red-400", bg: "bg-red-400/[0.06] border-red-400/[0.12]" },
  warning: { bar: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-400/[0.06] border-amber-400/[0.12]" },
  good: { bar: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-400/[0.06] border-emerald-400/[0.12]" },
  info: { bar: "bg-zinc-500", text: "text-zinc-400", bg: "bg-zinc-500/[0.06] border-zinc-500/[0.12]" },
};

export function IntentBlock({ name, sessions, success, status, href }: {
  name: string;
  sessions: number;
  success: number | null;
  status: "critical" | "warning" | "good" | "info";
  href?: string;
}) {
  const c = COLORS[status];
  const content = (
    <div className={`rounded-lg border p-3 ${c.bg} ${href ? "hover:brightness-125 transition-all cursor-pointer" : ""}`}>
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

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
