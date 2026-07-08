"use client";

import { Button } from "@/components/ui/button";
import type { DashboardData } from "@/lib/router-types";
import { ProfileSwitcher } from "@/components/dashboard/profile-switcher";
import { RefreshCw, Router } from "lucide-react";

interface DashboardHeaderProps {
  data: DashboardData | null;
  loading: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export function DashboardHeader({
  data,
  loading,
  lastUpdated,
  onRefresh,
}: DashboardHeaderProps) {
  const connected = !!data;

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border/50 bg-card/50">
            <Router className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90">
              Router Control
            </h1>
            {data ? (
              <p className="truncate font-mono text-xs text-muted-foreground">
                <span className="text-foreground/85">{data.info.ssid}</span>
                <span className="mx-1.5 text-border/80">/</span>
                <span>{data.info.wanIp}</span>
              </p>
            ) : (
              <p className="font-mono text-[10px] text-muted-foreground">
                Dialog 4G CPE
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ProfileSwitcher />
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                connected
                  ? "bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400/0.7)]"
                  : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {connected ? "Connected" : "Offline"}
            </span>
          </div>

          {lastUpdated && (
            <span className="hidden font-mono text-[10px] tabular-nums text-muted-foreground/70 md:inline">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-8 border-border/50 px-2.5 font-mono text-[11px] uppercase tracking-wide"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 sm:mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
