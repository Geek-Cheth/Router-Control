"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyUsageMiniChart } from "@/components/dashboard/daily-usage-chart";
import { formatBytes, formatDays } from "@/lib/format";
import type { PlanPrediction, UsageAnalytics } from "@/lib/router-types";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowRight, BarChart3, CalendarClock, TrendingUp } from "lucide-react";

interface Props {
  analytics: UsageAnalytics | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
}

function predictionHeadline(prediction: PlanPrediction): string {
  switch (prediction.limitingFactor) {
    case "already_depleted":
      return "Plan depleted";
    case "insufficient_data":
      return "Collecting usage data";
    case "expiry":
      return `Expires in ${formatDays(prediction.daysUntilExpiry)}`;
    case "burn_rate":
      return `~${formatDays(prediction.daysUntilDepletion)} at current pace`;
    default: {
      const _exhaustive: never = prediction.limitingFactor;
      return _exhaustive;
    }
  }
}

function predictionDetail(prediction: PlanPrediction): string {
  const sampleLabel =
    prediction.sampleDays > 0
      ? ` · ${prediction.sampleDays}-day pace`
      : "";

  switch (prediction.limitingFactor) {
    case "already_depleted":
      return "Record a new data purchase in Settings.";
    case "insufficient_data":
      return "Need a few days of usage history before projecting depletion.";
    case "expiry":
      return `Plan expires before data runs out · ${formatBytes(prediction.averageDailyBytes)}/day avg${sampleLabel}`;
    case "burn_rate":
    default:
      return `At ${formatBytes(prediction.averageDailyBytes)}/day · expires in ${formatDays(prediction.daysUntilExpiry)}${sampleLabel}`;
  }
}

export function UsageAnalyticsSummary({
  analytics,
  loading,
  error,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
        <CardHeader className="px-4 pt-4 pb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
        <CardContent className="flex items-center gap-2 px-4 py-4 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  const { averageDailyBytes, sampleDays, daily, prediction } = analytics;
  const recentDaily = daily.slice(-14);
  const hasRecentUsage = recentDaily.some((d) => d.totalBytes > 0);
  const forecastSampleDays = prediction?.sampleDays ?? sampleDays;

  return (
    <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Usage Analytics
          </CardTitle>
          <CardDescription className="text-xs">
            {forecastSampleDays > 0
              ? prediction
                ? `Forecast uses ${forecastSampleDays}-day pace · chart shows ${sampleDays} days`
                : `Based on ${sampleDays} day${sampleDays === 1 ? "" : "s"} of local history`
              : "Waiting for usage snapshots"}
          </CardDescription>
        </div>
        <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        {!compact && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/40 bg-muted/10 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Avg daily
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight">
                {hasRecentUsage || sampleDays > 0
                  ? formatBytes(prediction?.averageDailyBytes ?? averageDailyBytes)
                  : "—"}
              </p>
            </div>

            {prediction ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2.5",
                  prediction.limitingFactor === "already_depleted"
                    ? "border-destructive/30 bg-destructive/5"
                    : prediction.limitingFactor === "insufficient_data"
                      ? "border-border/40 bg-muted/10"
                      : "border-cyan-500/20 bg-cyan-500/5"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <CalendarClock className="h-3 w-3 text-muted-foreground/70" />
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Plan forecast
                  </p>
                </div>
                <p
                  className={cn(
                    "mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight",
                    prediction.limitingFactor === "already_depleted" && "text-destructive",
                    prediction.limitingFactor === "burn_rate" && "text-cyan-400"
                  )}
                >
                  {predictionHeadline(prediction)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {predictionDetail(prediction)}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/50 bg-muted/10 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Plan forecast
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record a data plan in Settings to see depletion forecast.
                </p>
              </div>
            )}
          </div>
        )}

        {hasRecentUsage && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {compact ? "Recent daily usage" : "Last 14 days"}
              </p>
              <Badge variant="outline" className="font-mono text-[10px] tabular-nums">
                {recentDaily.filter((d) => d.totalBytes > 0).length} active
              </Badge>
            </div>
            <DailyUsageMiniChart daily={recentDaily} />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full border-border/50 font-mono text-[11px] uppercase tracking-wide"
          render={<Link href="/usage" />}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          View daily chart
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
