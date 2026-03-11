import React from 'react';

interface BoneProps {
  className?: string;
  variant?: 'default' | 'shimmer' | 'pulse';
}

const Bone: React.FC<BoneProps> = ({ className = "", variant = 'pulse' }) => {
  const animationClasses = {
    default: 'animate-pulse',
    shimmer: 'animate-shimmer bg-gradient-to-r from-white/[0.02] via-white/[0.06] to-white/[0.02] bg-[length:200%_100%]',
    pulse: 'animate-pulse'
  };

  return (
    <div className={`rounded bg-white/[0.04] ${animationClasses[variant]} ${className}`} />
  );
};

interface LoadingSkeletonProps {
  layout?: 'overview' | 'table' | 'card' | 'list' | 'conversation';
  rows?: number;
  variant?: 'default' | 'shimmer' | 'pulse';
}

// Overview Page Skeleton
const OverviewSkeleton: React.FC<{ variant?: BoneProps['variant'] }> = ({ variant }) => (
  <div className="p-8 max-w-7xl space-y-6">
    {/* Header */}
    <div className="space-y-3">
      <Bone variant={variant} className="h-6 w-64 rounded" />
      <Bone variant={variant} className="h-4 w-96 rounded" />
    </div>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] bg-[#13141b] px-4 py-3.5">
          <Bone variant={variant} className="h-3 w-20 rounded mb-2" />
          <Bone variant={variant} className="h-8 w-16 rounded mb-1" />
          <Bone variant={variant} className="h-3 w-24 rounded" />
        </div>
      ))}
    </div>

    {/* Health Score Gauge */}
    <div className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6">
      <Bone variant={variant} className="h-4 w-24 rounded mb-4" />
      <div className="flex items-center gap-8">
        <div className="w-36 h-36 shrink-0">
          <Bone variant={variant} className="w-full h-full rounded-full" />
        </div>
        <div className="flex-1 space-y-3">
          <Bone variant={variant} className="h-6 w-20 rounded" />
          <Bone variant={variant} className="h-4 w-full rounded" />
          <Bone variant={variant} className="h-4 w-3/4 rounded" />
        </div>
      </div>
    </div>
    
    {/* Two-column section */}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-5">
          <Bone variant={variant} className="h-3 w-32 rounded mb-1" />
          <Bone variant={variant} className="h-3 w-48 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2">
                <Bone variant={variant} className="w-2 h-2 rounded-full" />
                <div className="flex-1">
                  <Bone variant={variant} className="h-4 w-40 rounded mb-1" />
                  <Bone variant={variant} className="h-3 w-24 rounded" />
                </div>
                <div className="text-right">
                  <Bone variant={variant} className="h-4 w-8 rounded mb-1" />
                  <Bone variant={variant} className="h-3 w-12 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Quick nav grid */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-4">
          <Bone variant={variant} className="w-5 h-5 rounded mb-2" />
          <Bone variant={variant} className="h-4 w-24 rounded mb-1" />
          <Bone variant={variant} className="h-3 w-full rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Table Skeleton
const TableSkeleton: React.FC<{ rows?: number; variant?: BoneProps['variant'] }> = ({ rows = 10, variant }) => (
  <div className="rounded-xl border border-white/[0.07] bg-[#13141b] overflow-hidden">
    {/* Header */}
    <div className="px-6 py-4 border-b border-white/[0.07]">
      <div className="flex items-center gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} variant={variant} className="h-4 w-20 rounded" />
        ))}
      </div>
    </div>
    
    {/* Rows */}
    <div className="divide-y divide-white/[0.07]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-4">
          <div className="flex items-center gap-4">
            <Bone variant={variant} className="h-4 w-32 rounded" />
            <Bone variant={variant} className="h-4 w-16 rounded" />
            <Bone variant={variant} className="h-4 w-24 rounded" />
            <Bone variant={variant} className="h-4 w-12 rounded" />
            <Bone variant={variant} className="h-4 w-20 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Card Grid Skeleton
const CardSkeleton: React.FC<{ rows?: number; variant?: BoneProps['variant'] }> = ({ rows = 6, variant }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-xl border border-white/[0.07] bg-[#13141b] p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bone variant={variant} className="w-8 h-8 rounded" />
          <div className="flex-1">
            <Bone variant={variant} className="h-4 w-24 rounded mb-1" />
            <Bone variant={variant} className="h-3 w-16 rounded" />
          </div>
        </div>
        <Bone variant={variant} className="h-6 w-12 rounded mb-2" />
        <Bone variant={variant} className="h-3 w-full rounded mb-1" />
        <Bone variant={variant} className="h-3 w-3/4 rounded" />
      </div>
    ))}
  </div>
);

// List Skeleton
const ListSkeleton: React.FC<{ rows?: number; variant?: BoneProps['variant'] }> = ({ rows = 8, variant }) => (
  <div className="space-y-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.07] bg-[#13141b]">
        <Bone variant={variant} className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1">
          <Bone variant={variant} className="h-4 w-48 rounded mb-2" />
          <Bone variant={variant} className="h-3 w-32 rounded" />
        </div>
        <div className="text-right">
          <Bone variant={variant} className="h-4 w-16 rounded mb-1" />
          <Bone variant={variant} className="h-3 w-12 rounded" />
        </div>
      </div>
    ))}
  </div>
);

// Conversation Skeleton
const ConversationSkeleton: React.FC<{ variant?: BoneProps['variant'] }> = ({ variant }) => (
  <div className="space-y-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className={`flex gap-4 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
        {i % 2 === 0 && <Bone variant={variant} className="w-8 h-8 rounded-full shrink-0" />}
        <div className={`max-w-xs ${i % 2 === 0 ? '' : 'order-first'}`}>
          <div className="rounded-xl bg-[#13141b] p-4">
            <Bone variant={variant} className="h-4 w-full rounded mb-2" />
            <Bone variant={variant} className="h-4 w-3/4 rounded mb-2" />
            <Bone variant={variant} className="h-3 w-1/2 rounded" />
          </div>
        </div>
        {i % 2 !== 0 && <Bone variant={variant} className="w-8 h-8 rounded-full shrink-0" />}
      </div>
    ))}
  </div>
);

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  layout = 'overview', 
  rows, 
  variant = 'pulse' 
}) => {
  switch (layout) {
    case 'table':
      return <TableSkeleton rows={rows} variant={variant} />;
    case 'card':
      return <CardSkeleton rows={rows} variant={variant} />;
    case 'list':
      return <ListSkeleton rows={rows} variant={variant} />;
    case 'conversation':
      return <ConversationSkeleton variant={variant} />;
    default:
      return <OverviewSkeleton variant={variant} />;
  }
};

export default LoadingSkeleton;