import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage?: number;
    period?: string;
  };
  loading?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const getTrendIcon = (direction: 'up' | 'down' | 'neutral') => {
  switch (direction) {
    case 'up':
      return (
        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'down':
      return (
        <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-3 h-3 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      );
  }
};

const getVariantClasses = (variant: StatCardProps['variant']) => {
  switch (variant) {
    case 'success':
      return 'border-emerald-500/20 bg-emerald-500/5';
    case 'warning':
      return 'border-amber-500/20 bg-amber-500/5';
    case 'danger':
      return 'border-red-500/20 bg-red-500/5';
    default:
      return 'border-white/[0.07] bg-[#13141b]';
  }
};

const getValueColor = (variant: StatCardProps['variant']) => {
  switch (variant) {
    case 'success':
      return 'text-emerald-400';
    case 'warning':
      return 'text-amber-400';
    case 'danger':
      return 'text-red-400';
    default:
      return 'text-white';
  }
};

export const StatCard = React.memo(({ 
  label, 
  value, 
  sub, 
  trend, 
  loading = false, 
  onClick,
  variant = 'default'
}: StatCardProps) => {
  const baseClasses = `rounded-xl border px-4 py-3.5 transition-all duration-200 ${getVariantClasses(variant)}`;
  const interactiveClasses = onClick ? 'cursor-pointer hover:border-indigo-500/30 hover:bg-indigo-500/[0.04]' : '';
  
  if (loading) {
    return (
      <div className={`${baseClasses} ${interactiveClasses}`}>
        <div className="animate-pulse">
          <div className="h-3 bg-white/[0.04] rounded mb-2"></div>
          <div className="h-8 bg-white/[0.04] rounded mb-1"></div>
          <div className="h-3 bg-white/[0.04] rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} ${interactiveClasses}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </p>
        {trend && (
          <div className="flex items-center space-x-1">
            {getTrendIcon(trend.direction)}
            {trend.percentage && (
              <span className={`text-[10px] font-medium ${
                trend.direction === 'up' ? 'text-emerald-400' : 
                trend.direction === 'down' ? 'text-red-400' : 'text-zinc-500'
              }`}>
                {trend.percentage > 0 ? '+' : ''}{trend.percentage}%
              </span>
            )}
          </div>
        )}
      </div>
      
      <p className={`text-2xl font-bold tabular-nums transition-colors ${getValueColor(variant)}`}>
        {value}
      </p>
      
      <div className="flex items-center justify-between mt-1">
        {sub && (
          <p className="text-xs text-zinc-500">{sub}</p>
        )}
        {trend && trend.period && (
          <p className="text-[10px] text-zinc-600">vs {trend.period}</p>
        )}
      </div>
    </div>
  );
});

StatCard.displayName = 'StatCard';