"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConnectedDevice, MacFilterState } from "@/lib/router-types";
import { AlertCircle, Ban, CheckCircle2, Plus, Shield, Trash2 } from "lucide-react";

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

const MODE_HELP: Record<MacFilterState["mode"], string> = {
  disabled: "All devices can connect. MAC filtering is off.",
  whitelist: "Only devices in the list below are allowed to connect.",
  blacklist: "Listed devices are blocked from connecting.",
};

interface Props {
  macFilter: MacFilterState;
  devices: ConnectedDevice[];
  onUpdate: () => void;
}

function serverMacsForMode(
  filter: MacFilterState,
  mode: MacFilterState["mode"]
): string[] {
  if (mode === "blacklist") return filter.blackList;
  if (mode === "whitelist") return filter.whiteList;
  return [];
}

function macListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].map((m) => m.toUpperCase()).sort();
  const sortedB = [...b].map((m) => m.toUpperCase()).sort();
  return sortedA.every((mac, i) => mac === sortedB[i]);
}

export function MacFilterPanel({ macFilter, devices, onUpdate }: Props) {
  const [mode, setMode] = useState(macFilter.mode);
  const [macs, setMacs] = useState<string[]>(
    mode === "blacklist" ? macFilter.blackList : macFilter.whiteList
  );
  const [newMac, setNewMac] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setMode(macFilter.mode);
    setMacs(
      macFilter.mode === "blacklist" ? macFilter.blackList : macFilter.whiteList
    );
  }, [macFilter]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const activeList =
    mode === "blacklist" ? macFilter.blackList : macFilter.whiteList;

  const hasChanges = useMemo(() => {
    if (mode !== macFilter.mode) return true;
    if (mode === "disabled") return false;
    return !macListsEqual(macs, serverMacsForMode(macFilter, mode));
  }, [mode, macs, macFilter]);

  async function save(nextMode = mode, nextMacs = macs) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/router/mac-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode, macs: nextMacs }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMode(json.mode);
      setMacs(json.mode === "blacklist" ? json.blackList : json.whiteList);
      setSuccess("MAC filter saved successfully.");
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addMac(mac: string) {
    const normalized = mac.trim().toUpperCase();
    if (!normalized) return;
    if (!MAC_REGEX.test(normalized)) {
      setError("Enter a valid MAC address (AA:BB:CC:DD:EE:FF).");
      return;
    }
    if (macs.includes(normalized)) return;
    setError(null);
    const next = [...macs, normalized];
    setMacs(next);
    setNewMac("");
  }

  function removeMac(mac: string) {
    setMacs(macs.filter((m) => m !== mac));
  }

  function blockDevice(mac: string) {
    setMode("blacklist");
    const next = [...new Set([...macFilter.blackList, mac.toUpperCase()])];
    setMacs(next);
    save("blacklist", next);
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-cyan-400" />
          <CardTitle className="text-base">MAC Filter</CardTitle>
          <Badge variant="outline" className="ml-auto capitalize text-[10px]">
            {macFilter.mode}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Block or allow devices by hardware address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="mac-filter-mode" className="text-xs text-muted-foreground">
            Filter mode
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => {
              const m = v as MacFilterState["mode"];
              setMode(m);
              setMacs(serverMacsForMode(macFilter, m));
              setError(null);
            }}
          >
            <SelectTrigger id="mac-filter-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="whitelist">Whitelist (allow only listed)</SelectItem>
              <SelectItem value="blacklist">Blacklist (block listed)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {MODE_HELP[mode]}
          </p>
        </div>

        {mode !== "disabled" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mac-filter-add" className="text-xs text-muted-foreground">
                Add MAC address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="mac-filter-add"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={newMac}
                  onChange={(e) => setNewMac(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addMac(newMac)}
                  className="font-mono text-xs"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="shrink-0"
                  onClick={() => addMac(newMac)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">MAC addresses</Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {macs.length} entries
                </span>
              </div>
              {macs.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 py-3 text-center text-xs text-muted-foreground">
                  No MAC addresses in list
                </p>
              ) : (
                <div className="divide-y divide-border/40 rounded-md border border-border/50">
                  {macs.map((mac) => (
                    <div
                      key={mac}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[11px] tracking-tight text-foreground/90">
                        {mac}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeMac(mac)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {devices.length > 0 && (
          <div className="space-y-2 border-t border-border/40 pt-4">
            <Label className="text-xs text-muted-foreground">
              Quick block from connected devices
            </Label>
            <div className="divide-y divide-border/40 rounded-md border border-border/50">
              {devices.map((d) => {
                const blocked = activeList.includes(d.mac_addr.toUpperCase());
                return (
                  <div
                    key={d.mac_addr}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {d.hostname || "Unknown device"}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {d.mac_addr}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => blockDevice(d.mac_addr)}
                      disabled={blocked}
                    >
                      <Ban className="mr-1 size-3" />
                      {blocked ? "Blocked" : "Block"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border/40 pt-4">
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {error}
            </p>
          )}

          {success && (
            <p className="flex items-center gap-1.5 text-xs text-cyan-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {success}
            </p>
          )}

          <Button
            onClick={() => save()}
            disabled={saving || !hasChanges}
            className="w-full"
          >
            {saving ? "Saving…" : "Apply MAC Filter"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
