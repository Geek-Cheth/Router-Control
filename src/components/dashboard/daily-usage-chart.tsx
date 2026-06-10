"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes, formatDateLabel } from "@/lib/format";
import type { DailyUsageRow } from "@/lib/router-types";
import { cn } from "@/lib/utils";

interface Props {
  daily: DailyUsageRow[];
  className?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: DailyUsageRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="rounded-md border border-border/60 bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label ? formatDateLabel(String(label)) : "—"}
      </p>
      <div className="space-y-0.5 font-mono text-xs tabular-nums">
        <p>
          <span className="text-muted-foreground">Total </span>
          <span className="text-foreground">{formatBytes(row.totalBytes)}</span>
        </p>
        <p>
          <span className="text-cyan-400/80">Up </span>
          <span>{formatBytes(row.txBytes)}</span>
        </p>
        <p>
          <span className="text-sky-400/80">Down </span>
          <span>{formatBytes(row.rxBytes)}</span>
        </p>
      </div>
    </div>
  );
}

export function DailyUsageChart({ daily, className }: Props) {
  const chartData = daily.map((row) => ({
    ...row,
    label: formatDateLabel(row.date),
    totalGb: row.totalBytes / (1024 * 1024 * 1024),
  }));

  const maxGb = Math.max(...chartData.map((d) => d.totalGb), 0.01);

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="oklch(1 0 0 / 8%)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => formatDateLabel(String(value))}
            tick={{ fill: "oklch(0.65 0.02 260)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value) => `${Number(value).toFixed(1)}`}
            tick={{ fill: "oklch(0.65 0.02 260)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            domain={[0, maxGb * 1.15]}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "oklch(0.55 0.14 195 / 8%)" }}
          />
          <Bar
            dataKey="totalGb"
            fill="oklch(0.55 0.14 195)"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
        Daily total (GB)
      </p>
    </div>
  );
}

export function DailyUsageMiniChart({ daily, className }: Props) {
  const chartData = daily.slice(-14).map((row) => ({
    ...row,
    totalGb: row.totalBytes / (1024 * 1024 * 1024),
  }));

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={72}>
        <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Bar
            dataKey="totalGb"
            fill="oklch(0.55 0.14 195 / 70%)"
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
