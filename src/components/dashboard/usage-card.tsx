import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import type { PurchaseStatus, TrafficStats } from "@/lib/router-types";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Database } from "lucide-react";

interface Props {
  traffic: TrafficStats;
  purchaseStatus?: PurchaseStatus;
  stored?: {
    yearMonth: string;
    txBytes: number;
    rxBytes: number;
    totalBytes: number;
  };
}

export function UsageCard({ traffic, purchaseStatus, stored }: Props) {
  const displayTx = stored ? stored.txBytes : traffic.monthlyTxBytes;
  const displayRx = stored ? stored.rxBytes : traffic.monthlyRxBytes;
  const displayTotal = stored ? stored.totalBytes : traffic.totalBytes;
  const uploadPercent = displayTotal > 0 ? (displayTx / displayTotal) * 100 : 0;
  const downloadPercent = displayTotal > 0 ? (displayRx / displayTotal) * 100 : 0;

  const hasActivePurchase = purchaseStatus != null;
  const usedLabel = hasActivePurchase
    ? formatBytes(purchaseStatus!.usedBytes)
    : formatBytes(displayTotal);
  const limitLabel = hasActivePurchase
    ? `${purchaseStatus!.amountGb} GB`
    : "-";
  const remainingBytes = hasActivePurchase ? purchaseStatus!.remainingBytes : 0;
  const usagePercent = hasActivePurchase ? purchaseStatus!.usagePercent : 0;
  const alertPercent = hasActivePurchase ? purchaseStatus!.alertPercent : 80;
  const isHighUsage =
    hasActivePurchase &&
    !purchaseStatus!.isDepleted &&
    usagePercent >= alertPercent;
  const isDepleted = hasActivePurchase && purchaseStatus!.isDepleted;

  return (
    <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Data Plan Usage
          </CardTitle>
          {hasActivePurchase ? (
            <CardDescription className="text-xs">
              {isDepleted ? (
                <span className="font-medium text-destructive">Plan depleted</span>
              ) : (
                <span className="tabular-nums">
                  {formatBytes(remainingBytes)} remaining
                </span>
              )}
              {stored && stored.totalBytes > traffic.totalBytes && (
                <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
                  Traffic breakdown includes locally saved usage
                </span>
              )}
            </CardDescription>
          ) : (
            <CardDescription className="text-xs">No active data plan</CardDescription>
          )}
        </div>
        <Database className="h-3.5 w-3.5 text-muted-foreground/60" />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3">
        {hasActivePurchase ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">
                  {usedLabel}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  of <span className="font-mono tabular-nums">{limitLabel}</span>
                </p>
              </div>
              <Badge
                variant={isDepleted || isHighUsage ? "destructive" : "outline"}
                className={cn(
                  "shrink-0 font-mono text-[10px] tabular-nums",
                  !isDepleted &&
                    !isHighUsage &&
                    "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                )}
              >
                {usagePercent.toFixed(1)}%
              </Badge>
            </div>
            <div className="space-y-1">
              <Progress
                value={usagePercent}
                className={cn(
                  "h-1.5 gap-0 [&_[data-slot=progress-track]]:bg-border/20",
                  isDepleted || isHighUsage
                    ? "[&_[data-slot=progress-indicator]]:bg-destructive"
                    : "[&_[data-slot=progress-indicator]]:bg-cyan-400"
                )}
              />
              {isDepleted && (
                <p className="text-[11px] font-medium text-destructive">
                  Data plan used up - record a new purchase in Settings
                </p>
              )}
              {isHighUsage && !isDepleted && (
                <p className="text-[11px] font-medium text-destructive">
                  Approaching plan limit - {formatBytes(remainingBytes)} left
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="border-t border-dashed border-border/40 py-5 text-center">
            <p className="text-xs text-muted-foreground">
              Record a data purchase in Settings to track your plan usage.
            </p>
          </div>
        )}
      </CardContent>
      <div className="flex items-stretch divide-x divide-border/40 border-t border-border/30 px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
          <ArrowUp className="h-3 w-3 shrink-0 text-cyan-400/80" />
          <div className="min-w-0 text-xs leading-tight">
            <span className="text-muted-foreground">Up </span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatBytes(displayTx)}
            </span>
            <span className="text-muted-foreground/70">
              {" "}
              · {uploadPercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-3">
          <ArrowDown className="h-3 w-3 shrink-0 text-sky-400/80" />
          <div className="min-w-0 text-xs leading-tight">
            <span className="text-muted-foreground">Down </span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatBytes(displayRx)}
            </span>
            <span className="text-muted-foreground/70">
              {" "}
              · {downloadPercent.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
