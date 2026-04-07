"use client";

import React from 'react';

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
  className?: string;
}

/**
 * Chart container that handles dimension issues during SSR/static generation
 * Provides proper fallback dimensions for ResponsiveContainer components
 */
export default function ChartContainer({ 
  children, 
  height = 300, 
  className = "" 
}: ChartContainerProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div 
        className={`flex items-center justify-center bg-[#13141b] rounded-lg ${className}`}
        style={{ height, minHeight: height, minWidth: 200 }}
      >
        <div className="text-zinc-500 text-sm">Loading chart...</div>
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={{ height, minHeight: height, minWidth: 200 }}
    >
      {children}
    </div>
  );
}