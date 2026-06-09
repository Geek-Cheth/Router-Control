import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RouterInfo, SignalInfo } from "@/lib/router-types";
import { cn } from "@/lib/utils";
import { Radio, Router, Signal, Wifi } from "lucide-react";

interface Props {
  info: RouterInfo;
  signal: SignalInfo;
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right",
          mono ? "font-mono tabular-nums text-foreground" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function displaySignal(value: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      {label ? (
        <span className="text-[11px] text-muted-foreground">{label}</span>
      ) : null}
      <div className="h-px flex-1 bg-border/40" />
    </div>
  );
}

export function RouterInfoCard({ info, signal }: Props) {
  const networkType = signal.networkType?.trim();

  return (
    <Card className="gap-0 border-border/30 bg-card/60 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between px-4 pt-4 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Router Info
          </CardTitle>
          <CardDescription className="text-xs">
            Network, device, and LTE status
          </CardDescription>
        </div>
        <Router className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div>
          <SectionDivider label="Network" />
          <div className="divide-y divide-border/40">
            <InfoRow
              label="SSID"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                  <span className="font-medium">{info.ssid}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 px-1.5 text-[10px] font-medium",
                      info.wifiState
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-border/50 text-muted-foreground"
                    )}
                  >
                    {info.wifiState ? "ON" : "OFF"}
                  </Badge>
                </span>
              }
            />
            <InfoRow label="WAN IP" value={info.wanIp} mono />
            <InfoRow label="LAN IP" value={info.lanIp} mono />
          </div>
        </div>

        <div>
          <SectionDivider label="Device" />
          <div className="divide-y divide-border/40">
            <InfoRow label="Firmware" value={info.firmware} mono />
            <InfoRow label="IMEI" value={info.imei || "-"} mono />
            <InfoRow label="Max clients" value={info.maxClients} mono />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Signal className="h-3 w-3" />
              LTE Signal
            </div>
            {networkType ? (
              <Badge variant="outline" className="h-4 gap-1 px-1.5 text-[10px]">
                <Radio className="h-2.5 w-2.5" />
                {networkType}
              </Badge>
            ) : (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
                N/A
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-border/40 border border-border/30">
            <div className="px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">RSRP</p>
              <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                {displaySignal(signal.rsrp)}
              </p>
            </div>
            <div className="px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">SINR</p>
              <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                {displaySignal(signal.sinr)}
              </p>
            </div>
            <div className="px-2 py-2 text-center">
              <p className="text-[10px] text-muted-foreground">Band</p>
              <p className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                {displaySignal(signal.band)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
