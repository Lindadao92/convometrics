import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

export const StatCard = React.memo(({ label, value, sub }: StatCardProps) => {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1.5">
        {label}
      </p>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </div>
  );
});

StatCard.displayName = 'StatCard';