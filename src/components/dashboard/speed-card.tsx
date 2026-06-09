"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatSpeed } from "@/lib/format";
import type { LiveSpeed, TrafficStats } from "@/lib/router-types";
import { cn } from "@/lib/utils";
import { Activity, ArrowDown, ArrowUp } from "lucide-react";

interface Props {
  traffic: TrafficStats;
  live?: LiveSpeed | null;
}

export function SpeedCard({ traffic, live }: Props) {
  const downloadKbps = live?.realtimeRxKbps ?? traffic.realtimeRxKbps;
  const uploadKbps = live?.realtimeTxKbps ?? traffic.realtimeTxKbps;
  const totalKbps = downloadKbps + uploadKbps;
  const isIdle = totalKbps === 0;

  const downloadShare = totalKbps > 0 ? (downloadKbps / totalKbps) * 100 : 50;
  const uploadShare = totalKbps > 0 ? (uploadKbps / totalKbps) * 100 : 50;

  return (
    <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2 shrink-0">
              {!isIdle && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  isIdle ? "bg-muted-foreground/25" : "bg-cyan-400"
                )}
              />
            </span>
            Live Speed
          </CardTitle>
          <CardDescription className="text-xs tabular-nums">
            {isIdle
              ? "No active traffic"
              : `${formatSpeed(totalKbps)} down+up · 1s refresh`}
          </CardDescription>
        </div>
        <Activity
          className={cn(
            "h-3.5 w-3.5",
            isIdle ? "text-muted-foreground/30" : "text-cyan-400/70"
          )}
        />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isIdle ? (
          <div className="space-y-3 py-1">
            <div
              className="relative h-8 w-full overflow-hidden"
              aria-hidden
            >
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/50" />
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-px bg-muted-foreground/15"
                    style={{ height: i % 3 === 0 ? 6 : 3 }}
                  />
                ))}
              </div>
            </div>
            <p className="text-center text-[11px] text-muted-foreground/70">
              Speeds will appear when data is flowing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex h-1 w-full overflow-hidden rounded-full bg-border/20">
              <div
                className="h-full bg-sky-400 transition-[width] duration-75 ease-out"
                style={{ width: `${downloadShare}%` }}
              />
              <div
                className="h-full bg-cyan-400 transition-[width] duration-75 ease-out"
                style={{ width: `${uploadShare}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowDown className="h-3 w-3 text-sky-400" />
                  Download
                  <span className="ml-auto font-mono tabular-nums text-muted-foreground/70">
                    {downloadShare.toFixed(0)}%
                  </span>
                </div>
                <p className="font-mono text-3xl font-bold tabular-nums tracking-tight transition-[color,opacity] duration-75">
                  {formatSpeed(downloadKbps)}
                </p>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ArrowUp className="h-3 w-3 text-cyan-400" />
                  Upload
                  <span className="ml-auto font-mono tabular-nums text-muted-foreground/70">
                    {uploadShare.toFixed(0)}%
                  </span>
                </div>
                <p className="font-mono text-3xl font-bold tabular-nums tracking-tight transition-[color,opacity] duration-75">
                  {formatSpeed(uploadKbps)}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
