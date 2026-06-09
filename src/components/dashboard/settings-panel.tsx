"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  KeyRound,
  Power,
} from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { PurchaseStatus } from "@/lib/router-types";

export function SettingsPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
      <RebootPanel />
      <PasswordChangePanel />
      <DataPurchasePanel className="lg:col-span-2" />
    </div>
  );
}

export function RebootPanel() {
  const [open, setOpen] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReboot() {
    setRebooting(true);
    setError(null);
    try {
      const res = await fetch("/api/router/reboot", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reboot failed");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reboot failed");
    } finally {
      setRebooting(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Power className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Reboot Router</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Restart the router. Connected devices will lose network access briefly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-amber-400/90">Downtime ~60s.</span>{" "}
            All WiFi and Ethernet clients disconnect during restart. NEVER use
            isTest.
          </p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="destructive" className="w-full">
                Reboot Router
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reboot router?</DialogTitle>
              <DialogDescription>
                Network access pauses for about 60 seconds while the router
                restarts. NEVER use isTest.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={rebooting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReboot}
                disabled={rebooting}
              >
                {rebooting ? "Rebooting…" : "Confirm Reboot"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export function PasswordChangePanel() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/router/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Password change failed");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-cyan-400" />
          <CardTitle className="text-base">Change Password</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Update the router admin login password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-password" className="text-xs text-muted-foreground">
              Current password
            </Label>
            <Input
              id="old-password"
              type="password"
              autoComplete="current-password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-xs text-muted-foreground">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="confirm-password"
              className="text-xs text-muted-foreground"
            >
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

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

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface DataPurchasePanelProps {
  className?: string;
}

function formatPurchaseDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInputValue(timestamp: number) {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInputToMs(dateInput: string, opts: { endExclusive: boolean }) {
  // HTML <input type="date"> gives "YYYY-MM-DD" in local date terms.
  const [yyyy, mm, dd] = dateInput.split("-").map((n) => Number(n));
  const base = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (opts.endExclusive) {
    // Treat expiry date as the last active day: expiresAt = next midnight (exclusive).
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0).getTime();
  }
  return base.getTime();
}

export function DataPurchasePanel({ className }: DataPurchasePanelProps) {
  const [amountGb, setAmountGb] = useState(80);
  const [notes, setNotes] = useState("");
  const [alertPercent, setAlertPercent] = useState(80);
  const [activeStatus, setActiveStatus] = useState<PurchaseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const now = Date.now();
    const currentMonthStart = new Date(now);
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    return toDateInputValue(currentMonthStart.getTime());
  });

  const [expiresDate, setExpiresDate] = useState(() => {
    const now = Date.now();
    const currentMonthStart = new Date(now);
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    const expiry = new Date(
      currentMonthStart.getFullYear(),
      currentMonthStart.getMonth(),
      currentMonthStart.getDate() + 29,
      0,
      0,
      0,
      0
    );
    return toDateInputValue(expiry.getTime());
  });

  async function loadActiveStatus() {
    setError(null);
    const res = await fetch("/api/usage/active");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load active purchase");
    setActiveStatus(json.status ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        await loadActiveStatus();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load active purchase"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const startAt = parseDateInputToMs(startDate, { endExclusive: false });
      const expiresAt = parseDateInputToMs(expiresDate, { endExclusive: true });

      const res = await fetch("/api/usage/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountGb,
          notes: notes.trim() || undefined,
          alertPercent,
          startAt,
          expiresAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to record purchase");
      setNotes("");
      await loadActiveStatus();
      setSuccess("Data purchase recorded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record purchase");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={`border-border/50 bg-card/80 backdrop-blur ${className ?? ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-cyan-400" />
          <CardTitle className="text-base">Data Purchase</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Record purchased data to track usage against your plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        ) : (
          <>
            {activeStatus && (
              <div className="rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2.5">
                <p className="text-xs font-medium text-cyan-400">Active plan</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Used
                    </p>
                    <p className="font-mono text-sm tabular-nums">
                      {formatBytes(activeStatus.usedBytes)}{" "}
                      <span className="text-xs text-muted-foreground">
                        / {activeStatus.amountGb} GB
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="text-sm">
                      {activeStatus.usagePercent.toFixed(1)}%{" "}
                      <span className="text-muted-foreground">-</span>{" "}
                      {activeStatus.isDepleted
                        ? "depleted"
                        : `${formatBytes(activeStatus.remainingBytes)} left`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Period
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPurchaseDate(activeStatus.startAt)} to{" "}
                      {formatPurchaseDate(activeStatus.expiresAt - 1)}
                      <span className="text-muted-foreground/60"> · </span>
                      alert {activeStatus.alertPercent}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Record new purchase
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="purchase-amount-gb"
                    className="text-xs text-muted-foreground"
                  >
                    Amount (GB)
                  </Label>
                  <Input
                    id="purchase-amount-gb"
                    type="number"
                    min={1}
                    max={9999}
                    value={amountGb}
                    onChange={(e) => setAmountGb(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="purchase-alert-percent"
                    className="text-xs text-muted-foreground"
                  >
                    Alert at (%)
                  </Label>
                  <Input
                    id="purchase-alert-percent"
                    type="number"
                    min={1}
                    max={100}
                    value={alertPercent}
                    onChange={(e) => setAlertPercent(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="purchase-start-date"
                    className="text-xs text-muted-foreground"
                  >
                    Start date
                  </Label>
                  <Input
                    id="purchase-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="purchase-expiry-date"
                    className="text-xs text-muted-foreground"
                  >
                    Expiry date
                  </Label>
                  <Input
                    id="purchase-expiry-date"
                    type="date"
                    value={expiresDate}
                    onChange={(e) => setExpiresDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase-notes" className="text-xs text-muted-foreground">
                  Notes (optional)
                </Label>
                <Input
                  id="purchase-notes"
                  type="text"
                  placeholder="e.g. March top-up"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {activeStatus && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Usage is deducted from the oldest active plan first (FIFO).
                  Recording another plan adds a new balance bucket with its own
                  start and expiry.
                </p>
              )}

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

              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Recording…" : "Record Purchase"}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
