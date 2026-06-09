"use client";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DevicesTable } from "@/components/dashboard/devices-table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MacFilterPanel } from "@/components/dashboard/mac-filter-panel";
import { RouterInfoCard } from "@/components/dashboard/router-info-card";
import { SpeedCard } from "@/components/dashboard/speed-card";
import { UsageCard } from "@/components/dashboard/usage-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POLL_INTERVAL, useRouterData } from "@/hooks/use-router-data";
import { useLiveSpeed } from "@/hooks/use-live-speed";
import { formatBytes, formatSpeed } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData, LiveSpeed } from "@/lib/router-types";
import {
  Activity,
  Database,
  History,
  LayoutDashboard,
  Settings,
  Shield,
  Smartphone,
  Wifi,
} from "lucide-react";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { UsageHistoryPanel } from "@/components/dashboard/usage-history-panel";

const TAB_TRIGGER_CLASS =
  "gap-2 rounded-none border-0 px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground shadow-none after:bottom-0 after:h-px after:bg-cyan-400 data-active:bg-transparent data-active:text-cyan-400 data-active:shadow-[0_1px_12px_theme(colors.cyan.400/0.35)] dark:data-active:bg-transparent sm:px-4";

export default function DashboardPage() {
  const { data, error, loading, lastUpdated, refresh } = useRouterData();
  const { speed: liveSpeed } = useLiveSpeed(!!data);

  const routerUrl =
    process.env.NEXT_PUBLIC_ROUTER_URL ?? "192.168.8.1";
  const refreshSeconds = POLL_INTERVAL / 1000;

  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-background"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.22] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 6%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 6%) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden
      />

      <DashboardHeader
        data={data}
        loading={loading}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {loading && !data ? (
          <DashboardSkeleton />
        ) : data ? (
          <Tabs defaultValue="overview" className="space-y-5">
            <TabsList
              variant="line"
              className="h-auto w-full justify-start gap-0 overflow-x-auto border-b border-border/40 bg-transparent p-0"
            >
              <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>
                <LayoutDashboard className="h-3.5 w-3.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="devices" className={TAB_TRIGGER_CLASS}>
                <Smartphone className="h-3.5 w-3.5" />
                Devices
              </TabsTrigger>
              <TabsTrigger value="security" className={TAB_TRIGGER_CLASS}>
                <Shield className="h-3.5 w-3.5" />
                Security
              </TabsTrigger>
              <TabsTrigger value="usage" className={TAB_TRIGGER_CLASS}>
                <History className="h-3.5 w-3.5" />
                Usage
              </TabsTrigger>
              <TabsTrigger value="settings" className={TAB_TRIGGER_CLASS}>
                <Settings className="h-3.5 w-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <OverviewStats data={data} liveSpeed={liveSpeed} />
              <div className="grid gap-3 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <UsageCard
                    traffic={data.traffic}
                    stored={data.storedUsage}
                    purchaseStatus={data.purchaseStatus ?? undefined}
                  />
                </div>
                <div className="lg:col-span-4">
                  <SpeedCard live={liveSpeed} />
                </div>
                <div className="lg:col-span-3">
                  <RouterInfoCard info={data.info} signal={data.signal} />
                </div>
                <div className="lg:col-span-12">
                  <DevicesTable devices={data.devices} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="devices">
              <DevicesTable devices={data.devices} />
            </TabsContent>

            <TabsContent value="security">
              <div className="grid gap-3 lg:grid-cols-2">
                <MacFilterPanel
                  key={`${data.macFilter.mode}-${data.macFilter.blackList.join(",")}-${data.macFilter.whiteList.join(",")}`}
                  macFilter={data.macFilter}
                  devices={data.devices}
                  onUpdate={refresh}
                />
                <DevicesTable devices={data.devices} />
              </div>
            </TabsContent>

            <TabsContent value="usage">
              <UsageHistoryPanel />
            </TabsContent>

            <TabsContent value="settings">
              <SettingsPanel />
            </TabsContent>
          </Tabs>
        ) : error ? (
          <EmptyState
            variant="error"
            message={error}
            onRetry={refresh}
            retrying={loading}
          />
        ) : (
          <EmptyState variant="waiting" />
        )}

        <footer className="flex items-center justify-between border-t border-border/30 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/55">
          <span>auto-refresh / {refreshSeconds}s</span>
          <span className="tabular-nums">{routerUrl}</span>
        </footer>
      </main>
    </div>
  );
}

function OverviewStats({
  data,
  liveSpeed,
}: {
  data: DashboardData;
  liveSpeed: LiveSpeed | null;
}) {
  const downloadKbps = liveSpeed?.realtimeRxKbps ?? 0;
  const isLiveSpeed = liveSpeed !== null;

  const purchase = data.purchaseStatus;
  const dataUsedValue = purchase
    ? `${formatBytes(purchase.usedBytes)} / ${purchase.amountGb} GB`
    : formatBytes(data.storedUsage?.totalBytes ?? data.traffic.totalBytes);

  const stats = [
    {
      label: "Devices",
      value: String(data.devices.length),
      icon: Smartphone,
      live: false,
    },
    {
      label: purchase ? "Plan used" : "Data used",
      value: dataUsedValue,
      icon: Database,
      live: false,
    },
    {
      label: "Download",
      value: formatSpeed(downloadKbps),
      icon: Activity,
      live: isLiveSpeed,
    },
    {
      label: "Wi-Fi",
      value: data.info.wifiState ? "On" : "Off",
      icon: Wifi,
      live: data.info.wifiState,
      isToggle: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="relative overflow-hidden rounded border border-border/40 bg-card/30 px-3 py-2"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {stat.label}
            </p>
            <stat.icon className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          </div>
          {stat.isToggle ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  stat.live
                    ? "bg-cyan-400 shadow-[0_0_6px_theme(colors.cyan.400/0.6)]"
                    : "bg-muted-foreground/50"
                )}
                aria-hidden
              />
              <p
                className={cn(
                  "font-mono text-base font-medium tabular-nums tracking-tight",
                  stat.live ? "text-cyan-400" : "text-muted-foreground"
                )}
              >
                {stat.value}
              </p>
            </div>
          ) : (
            <p
              className={cn(
                "truncate font-mono text-base font-medium tabular-nums tracking-tight",
                stat.live && "text-cyan-400"
              )}
            >
              {stat.value}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  const tabWidths = ["w-24", "w-20", "w-[5.5rem]", "w-16", "w-20"];

  return (
    <div className="space-y-5">
      <div className="flex gap-0 border-b border-border/40 pb-0">
        {tabWidths.map((width, i) => (
          <Skeleton key={i} className={cn("mx-1 h-9 rounded-none", width)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[52px] rounded border-border/40" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-12">
        <Skeleton className="h-48 rounded lg:col-span-5" />
        <Skeleton className="h-48 rounded lg:col-span-4" />
        <Skeleton className="h-48 rounded lg:col-span-3" />
        <Skeleton className="h-64 rounded lg:col-span-12" />
      </div>
    </div>
  );
}
