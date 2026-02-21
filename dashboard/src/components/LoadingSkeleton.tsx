import React from 'react';

interface BoneProps {
  className?: string;
}

const Bone: React.FC<BoneProps> = ({ className = "" }) => {
  return (
    <div className={`animate-pulse rounded bg-white/[0.04] ${className}`} />
  );
};

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Bone className="h-6 w-64 rounded" />
        <Bone className="h-4 w-96 rounded" />
      </div>
      
      {/* Health Score + Stats Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Bone className="h-48 rounded-xl" />
        <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Bone key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="rounded-xl border border-white/[0.07] bg-[#13141b] px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <Bone className="h-3 w-48 rounded" />
          <Bone className="h-3 w-12 rounded" />
        </div>
        <Bone className="h-1.5 w-full rounded-full" />
      </div>
      
      {/* What's Working / What's Not */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Bone className="h-48 rounded-xl" />
        <Bone className="h-48 rounded-xl" />
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;