"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDuration } from "@/lib/format";
import type { ConnectedDevice } from "@/lib/router-types";
import { Cable, Check, Copy, Wifi, WifiOff } from "lucide-react";

interface Props {
  devices: ConnectedDevice[];
}

function isWifi(device: ConnectedDevice) {
  return device.dev_type === "wifi";
}

function DeviceTypeBadge({ device }: { device: ConnectedDevice }) {
  const wifi = isWifi(device);
  return (
    <Badge
      variant="outline"
      className="shrink-0 border-border/60 px-1 py-0 text-[10px] font-normal"
    >
      {wifi ? (
        <>
          <Wifi className="size-2.5 text-cyan-400" />
          WiFi
        </>
      ) : (
        <>
          <Cable className="size-2.5" />
          LAN
        </>
      )}
    </Badge>
  );
}

function DeviceName({ hostname }: { hostname: string }) {
  const name = hostname || "Unknown";

  return (
    <Tooltip>
      <TooltipTrigger className="block max-w-[140px] truncate text-left text-sm font-medium sm:max-w-[200px]">
        {name}
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

function CopyMacButton({ mac }: { mac: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mac);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground hover:text-cyan-400"
            onClick={copy}
            aria-label="Copy MAC address"
          />
        }
      >
        {copied ? (
          <Check className="size-3 text-cyan-400" />
        ) : (
          <Copy className="size-3" />
        )}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied!" : "Copy MAC"}</TooltipContent>
    </Tooltip>
  );
}

export function DevicesTable({ devices }: Props) {
  const wifiCount = devices.filter(isWifi).length;
  const ethernetCount = devices.length - wifiCount;

  return (
    <TooltipProvider>
      <Card className="border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connected Devices</CardTitle>
          <CardDescription className="text-xs">
            Live clients on your network with connection duration and addresses.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Badge
                variant="secondary"
                className="border border-cyan-500/20 bg-cyan-500/5 text-[10px] text-cyan-400"
              >
                {devices.length} {devices.length === 1 ? "device" : "devices"}
              </Badge>
              {devices.length > 0 && (
                <>
                  {wifiCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      <Wifi className="size-2.5 text-cyan-400" />
                      {wifiCount}
                    </Badge>
                  )}
                  {ethernetCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      <Cable className="size-2.5" />
                      {ethernetCount}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          {devices.length === 0 ? (
            <div className="flex items-stretch gap-3 rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-5">
              <div className="w-0.5 shrink-0 rounded-full bg-cyan-500/40" />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <WifiOff className="size-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm font-medium">No devices connected</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Clients appear here when they join WiFi or plug into Ethernet.
                  Refresh to poll the router.
                </p>
              </div>
            </div>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Device
                    </TableHead>
                    <TableHead className="hidden h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:table-cell">
                      IP
                    </TableHead>
                    <TableHead className="hidden h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground sm:table-cell">
                      MAC
                    </TableHead>
                    <TableHead className="hidden h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground md:table-cell">
                      Uptime
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow
                      key={device.mac_addr}
                      className="border-border/30 hover:bg-cyan-500/[0.03]"
                    >
                      <TableCell className="px-2 py-1.5">
                        <div className="flex min-w-0 items-start gap-2">
                          {isWifi(device) ? (
                            <Wifi className="mt-0.5 size-3.5 shrink-0 text-cyan-400" />
                          ) : (
                            <Cable className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <DeviceName hostname={device.hostname} />
                              <DeviceTypeBadge device={device} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 sm:hidden">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {device.ip_addr}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">
                                ·
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formatDuration(device.connect_time)}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 sm:hidden">
                              <span className="truncate font-mono text-[10px] text-muted-foreground/80">
                                {device.mac_addr}
                              </span>
                              <CopyMacButton mac={device.mac_addr} />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 font-mono text-xs tabular-nums sm:table-cell">
                        {device.ip_addr}
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 sm:table-cell">
                        <div className="flex items-center gap-0.5">
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {device.mac_addr}
                          </span>
                          <CopyMacButton mac={device.mac_addr} />
                        </div>
                      </TableCell>
                      <TableCell className="hidden px-2 py-1.5 text-right text-xs tabular-nums text-muted-foreground md:table-cell">
                        {formatDuration(device.connect_time)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
