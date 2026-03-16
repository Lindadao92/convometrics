# Convometrics System Health Monitoring Improvements

## Overview
Based on the known issues with AI workers, Supabase usage limits, and dashboard stability, I've created a comprehensive system health monitoring solution.

## New Features to Implement

### 1. System Health API Route
**File:** `/dashboard/src/app/api/system-health/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const checkType = searchParams.get("check") || "all";

    const healthData: any = {
      timestamp: new Date().toISOString(),
      status: "healthy",
      checks: {},
    };

    // Database connectivity check
    if (checkType === "all" || checkType === "database") {
      try {
        const { count, error } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true });
        
        if (error) throw error;
        
        healthData.checks.database = {
          status: "healthy",
          totalConversations: count,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        healthData.checks.database = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          lastChecked: new Date().toISOString(),
        };
        healthData.status = "degraded";
      }
    }

    // Supabase usage limits check
    if (checkType === "all" || checkType === "usage") {
      try {
        // Check recent API calls (rough usage estimation)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { count: recentQueries } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", oneHourAgo);

        // Check storage usage by estimating data size
        const { data: sampleConversations } = await supabase
          .from("conversations")
          .select("*")
          .limit(100);

        const avgConversationSize = sampleConversations
          ? JSON.stringify(sampleConversations).length / sampleConversations.length
          : 0;

        const { count: totalConversations } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true });

        const estimatedStorageUsageGB = totalConversations 
          ? (totalConversations * avgConversationSize) / (1024 * 1024 * 1024)
          : 0;

        // Supabase free tier limits
        const FREE_TIER_LIMITS = {
          storageGB: 0.5, // 500MB
          databaseRows: 50000,
          apiRequests: 5000000, // per month, rough estimate
        };

        const usagePercent = {
          storage: Math.min((estimatedStorageUsageGB / FREE_TIER_LIMITS.storageGB) * 100, 100),
          rows: Math.min(((totalConversations || 0) / FREE_TIER_LIMITS.databaseRows) * 100, 100),
          apiCallsPerHour: recentQueries || 0,
        };

        healthData.checks.usage = {
          status: usagePercent.storage > 90 || usagePercent.rows > 90 ? "warning" : "healthy",
          limits: FREE_TIER_LIMITS,
          usage: {
            estimatedStorageUsageGB: Math.round(estimatedStorageUsageGB * 100) / 100,
            totalRows: totalConversations,
            storageUsagePercent: Math.round(usagePercent.storage * 100) / 100,
            rowUsagePercent: Math.round(usagePercent.rows * 100) / 100,
            recentApiCallsPerHour: usagePercent.apiCallsPerHour,
          },
          warnings: [],
          lastChecked: new Date().toISOString(),
        };

        if (usagePercent.storage > 90) {
          healthData.checks.usage.warnings.push("Storage usage above 90% of free tier limit");
        }
        if (usagePercent.rows > 90) {
          healthData.checks.usage.warnings.push("Row count above 90% of free tier limit");
        }
        if (healthData.checks.usage.warnings.length > 0) {
          healthData.status = "warning";
        }
      } catch (error) {
        healthData.checks.usage = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          lastChecked: new Date().toISOString(),
        };
        healthData.status = "degraded";
      }
    }

    // AI Workers health check
    if (checkType === "all" || checkType === "workers") {
      try {
        // Check for recent AI analysis results to infer worker health
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        const { count: recentAnalyses } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .not("intent", "is", null)
          .gte("created_at", oneHourAgo);

        const { count: pendingAnalyses } = await supabase
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .is("intent", null)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        healthData.checks.workers = {
          status: (pendingAnalyses || 0) > 1000 ? "warning" : "healthy",
          recentAnalyses: recentAnalyses || 0,
          pendingAnalyses: pendingAnalyses || 0,
          processingRate: `${recentAnalyses || 0} analyses/hour`,
          warnings: [],
          lastChecked: new Date().toISOString(),
        };

        if ((pendingAnalyses || 0) > 1000) {
          healthData.checks.workers.warnings.push(`High backlog: ${pendingAnalyses} conversations pending analysis`);
          healthData.status = "warning";
        }
        if ((recentAnalyses || 0) === 0) {
          healthData.checks.workers.warnings.push("No recent AI worker activity detected");
          healthData.status = "warning";
        }
      } catch (error) {
        healthData.checks.workers = {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          lastChecked: new Date().toISOString(),
        };
        healthData.status = "degraded";
      }
    }

    // Deployment health
    if (checkType === "all" || checkType === "deployment") {
      healthData.checks.deployment = {
        status: "healthy",
        environment: process.env.NODE_ENV || "unknown",
        vercelRegion: process.env.VERCEL_REGION || "unknown",
        buildId: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || "unknown",
        lastChecked: new Date().toISOString(),
      };
    }

    return NextResponse.json(healthData);
  } catch (error) {
    console.error("System health check error:", error);
    return NextResponse.json(
      { 
        status: "error", 
        error: error instanceof Error ? error.message : "System health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

### 2. System Health Dashboard Page
**File:** `/dashboard/src/app/system-health/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Shell from "../shell";

interface HealthCheck {
  status: "healthy" | "warning" | "error";
  lastChecked: string;
  [key: string]: any;
}

interface SystemHealth {
  timestamp: string;
  status: "healthy" | "warning" | "degraded" | "error";
  checks: {
    database?: HealthCheck;
    usage?: HealthCheck;
    workers?: HealthCheck;
    deployment?: HealthCheck;
  };
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    healthy: "bg-green-500/20 text-green-400 border-green-500/30",
    warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    degraded: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status as keyof typeof colors] || colors.error}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/system-health");
      if (!response.ok) throw new Error("Failed to fetch health data");
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <Shell>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">Error loading system health: {error}</p>
            <button 
              onClick={fetchHealth}
              className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">System Health</h1>
            <p className="text-zinc-400 mt-1">Monitor system status and performance</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={health?.status || "error"} />
            <button 
              onClick={fetchHealth}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {/* Database Health */}
          {health?.checks.database && (
            <div className="bg-[#13141b] border border-white/[0.08] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Database</h3>
                <StatusBadge status={health.checks.database.status} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">
                  Total Conversations: <span className="text-white font-medium">{health.checks.database.totalConversations?.toLocaleString()}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  Last checked: {new Date(health.checks.database.lastChecked).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {/* Usage Limits */}
          {health?.checks.usage && (
            <div className="bg-[#13141b] border border-white/[0.08] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Resource Usage</h3>
                <StatusBadge status={health.checks.usage.status} />
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">Storage</span>
                    <span className="text-white">{health.checks.usage.usage.storageUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(health.checks.usage.usage.storageUsagePercent, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-400">Database Rows</span>
                    <span className="text-white">{health.checks.usage.usage.rowUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(health.checks.usage.usage.rowUsagePercent, 100)}%` }}
                    ></div>
                  </div>
                </div>
                {health.checks.usage.warnings?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-yellow-400 font-medium mb-1">Warnings:</p>
                    {health.checks.usage.warnings.map((warning: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-300">• {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Workers */}
          {health?.checks.workers && (
            <div className="bg-[#13141b] border border-white/[0.08] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">AI Workers</h3>
                <StatusBadge status={health.checks.workers.status} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">
                  Processing Rate: <span className="text-white font-medium">{health.checks.workers.processingRate}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  Pending Analyses: <span className="text-white font-medium">{health.checks.workers.pendingAnalyses}</span>
                </p>
                {health.checks.workers.warnings?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-yellow-400 font-medium mb-1">Warnings:</p>
                    {health.checks.workers.warnings.map((warning: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-300">• {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deployment */}
          {health?.checks.deployment && (
            <div className="bg-[#13141b] border border-white/[0.08] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Deployment</h3>
                <StatusBadge status={health.checks.deployment.status} />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">
                  Environment: <span className="text-white font-medium">{health.checks.deployment.environment}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  Region: <span className="text-white font-medium">{health.checks.deployment.vercelRegion}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  Build: <span className="text-white font-medium">{health.checks.deployment.buildId}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {health?.timestamp && (
          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-500">
              Last updated: {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
```

### 3. Updated Shell Navigation
Add system health to the navigation in `shell.tsx`:

```typescript
// Add to NAV array
{
  href: "/system-health",
  label: "System Health",
  icon: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
},
```

## Benefits

1. **Proactive Monitoring**: Catch issues before they become critical
2. **Resource Management**: Track Supabase free tier limits to avoid service disruption
3. **Worker Health**: Monitor AI worker pipeline status and identify bottlenecks
4. **User Experience**: Visual dashboard for quick system status assessment
5. **Debugging**: Detailed error reporting and status information

## Implementation Steps

1. Create the API route file: `/dashboard/src/app/api/system-health/route.ts`
2. Create the page component: `/dashboard/src/app/system-health/page.tsx`
3. Update shell navigation to include the new page
4. Test with current Supabase data
5. Deploy to Vercel

## Business Impact

- **Prevents Downtime**: Early warning system for resource limits
- **Improves Reliability**: Better monitoring of AI worker pipeline
- **Saves Money**: Prevents unexpected service interruptions that could lose customers
- **Enables Growth**: Clear visibility into when to upgrade Supabase plan

This addresses the known issues with:
- ✅ AI worker pipeline health monitoring
- ✅ Supabase usage limit tracking
- ✅ System reliability improvements
- ✅ Dashboard functionality enhancements