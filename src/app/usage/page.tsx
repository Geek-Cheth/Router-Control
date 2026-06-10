"use client";

import Link from "next/link";
import { useState } from "react";
import { DailyUsageChart } from "@/components/dashboard/daily-usage-chart";
import { UsageAnalyticsSummary } from "@/components/dashboard/usage-analytics-summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsageAnalytics } from "@/hooks/use-usage-analytics";
import { formatBytes, formatDateLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowLeft, BarChart3, RefreshCw, Router } from "lucide-react";

const RANGE_OPTIONS = [7, 14, 30, 60, 90] as const;

export default function DailyUsagePage() {
  const [days, setDays] = useState<number>(30);
  const { data, loading, error, refresh } = useUsageAnalytics(days);

  return (
    <div className="relative min-h-screen bg-background">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.22] dark:opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(1 0 0 / 6%) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 6%) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-border/50 px-2.5"
              render={<Link href="/" />}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/90">
                <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
                Daily Usage
              </h1>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                Local SQLite history · router snapshots
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="h-8 border-border/50 px-2.5 font-mono text-[11px] uppercase tracking-wide"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6">
        <UsageAnalyticsSummary
          analytics={data}
          loading={loading}
          error={error}
        />

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
            <div>
              <CardTitle className="text-base">Daily traffic chart</CardTitle>
              <CardDescription className="text-xs">
                Upload + download totals per calendar day, stored locally.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={days === option ? "default" : "outline"}
                  size="xs"
                  className={cn(
                    "font-mono text-[10px] tabular-nums",
                    days === option && "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/25"
                  )}
                  onClick={() => setDays(option)}
                >
                  {option}d
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <Skeleton className="h-[320px] w-full rounded-md" />
            ) : data && data.daily.some((d) => d.totalBytes > 0) ? (
              <DailyUsageChart daily={data.daily} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/60 bg-muted/10 px-6 py-16 text-center">
                <Router className="h-8 w-8 text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/90">No daily data yet</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Keep the dashboard open while connected to your router. Usage
                    snapshots are saved every 15 minutes and rolled up into daily totals.
                  </p>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/" />}>
                  Go to dashboard
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {data && data.daily.some((d) => d.totalBytes > 0) && (
          <Card className="border-border/50 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Daily breakdown</CardTitle>
              <CardDescription className="text-xs">
                {days}-day history from local database
              </CardDescription>
            </CardHeader>
            <CardContent className="-mx-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      Upload
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      Download
                    </TableHead>
                    <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.daily].reverse().map((row) => (
                    <TableRow
                      key={row.date}
                      className="border-border/30 hover:bg-cyan-500/[0.03]"
                    >
                      <TableCell className="px-2 py-1.5 text-xs">
                        {formatDateLabel(row.date)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                        {formatBytes(row.txBytes)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                        {formatBytes(row.rxBytes)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-cyan-400/90">
                        {formatBytes(row.totalBytes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
