"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/format";
import type { DataPurchase } from "@/lib/router-types";
import { AlertCircle, BarChart3, History, Info } from "lucide-react";

interface MonthlyUsageRow {
  month: string;
  txBytes: number;
  rxBytes: number;
  totalBytes: number;
  quotaGB: number | null;
}

function parseMonthlyResponse(json: unknown): MonthlyUsageRow[] {
  if (Array.isArray(json)) return json as MonthlyUsageRow[];
  if (json && typeof json === "object" && "months" in json) {
    const months = (json as { months: unknown }).months;
    return Array.isArray(months) ? (months as MonthlyUsageRow[]) : [];
  }
  return [];
}

function formatMonthLabel(month: string): string {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
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
  const [yyyy, mm, dd] = dateInput.split("-").map((n) => Number(n));
  const base = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  if (opts.endExclusive) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 0, 0, 0, 0).getTime();
  }
  return base.getTime();
}

function purchaseRemainingLabel(purchase: DataPurchase): string {
  switch (purchase.status) {
    case "active":
      return `${formatBytes(purchase.remainingBytes)} remaining`;
    case "depleted":
      return "Depleted";
    case "expired":
      return `${formatBytes(purchase.wastedBytes ?? purchase.remainingBytes)} wasted`;
    case "scheduled":
    default:
      return "Scheduled";
  }
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex items-stretch gap-3 rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-5">
      <div className="w-0.5 shrink-0 rounded-full bg-cyan-500/40" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export function UsageHistoryPanel() {
  const [purchases, setPurchases] = useState<DataPurchase[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DataPurchase | null>(null);
  const [editAmountGb, setEditAmountGb] = useState(80);
  const [editNotes, setEditNotes] = useState("");
  const [editAlertPercent, setEditAlertPercent] = useState(80);
  const [editStartDate, setEditStartDate] = useState("");
  const [editExpiresDate, setEditExpiresDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [purchasesRes, monthlyRes] = await Promise.all([
          fetch("/api/usage/purchases"),
          fetch("/api/usage/monthly"),
        ]);
        const purchasesJson = await purchasesRes.json();
        const monthlyJson = await monthlyRes.json();

        if (!purchasesRes.ok) {
          throw new Error(purchasesJson.error ?? "Failed to load purchase history");
        }
        if (!monthlyRes.ok) {
          throw new Error(monthlyJson.error ?? "Failed to load usage history");
        }

        if (!cancelled) {
          setPurchases(purchasesJson.purchases ?? []);
          setMonthlyRows(parseMonthlyResponse(monthlyJson));
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load usage history"
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

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-cyan-400" />
          <CardTitle className="text-base">Usage History</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Data purchase records and calendar month traffic totals.
        </CardDescription>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-8 border-border/50 font-mono text-[11px] uppercase tracking-wide"
          render={<Link href="/usage" />}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Daily usage chart
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="border-border/50 bg-muted/20">
          <Info className="size-4 text-cyan-400" />
          <AlertDescription className="text-xs">
            Purchase history tracks data plans you record. Calendar month totals
            persist locally even if the router resets its counters.
          </AlertDescription>
        </Alert>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Purchase History
                </h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {purchases.length} records
                </span>
              </div>
              {purchases.length === 0 ? (
                <EmptySection message="No data purchases recorded yet." />
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          Start
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Expiry
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Amount
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Used
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Remaining
                        </TableHead>
                        <TableHead className="h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          Notes
                        </TableHead>
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow
                          key={purchase.id}
                          className="border-border/30 hover:bg-cyan-500/[0.03]"
                        >
                          <TableCell className="px-2 py-1.5 text-xs">
                            {formatPurchaseDate(purchase.startAt)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                            {formatPurchaseDate(purchase.expiresAt - 1)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {purchase.amountGb} GB
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {purchase.usedBytes != null
                              ? formatBytes(purchase.usedBytes)
                              : "-"}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                            {purchaseRemainingLabel(purchase)}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate px-2 py-1.5 text-xs text-muted-foreground">
                            {purchase.notes ?? "-"}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  setEditTarget(purchase);
                                  setEditAmountGb(purchase.amountGb);
                                  setEditNotes(purchase.notes ?? "");
                                  setEditAlertPercent(purchase.alertPercent);
                                  setEditStartDate(
                                    toDateInputValue(purchase.startAt)
                                  );
                                  setEditExpiresDate(
                                    toDateInputValue(purchase.expiresAt - 1)
                                  );
                                  setEditOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={async () => {
                                  const ok = window.confirm(
                                    "Delete this data plan?"
                                  );
                                  if (!ok) return;
                                  await fetch(
                                    `/api/usage/purchases/${purchase.id}`,
                                    { method: "DELETE" }
                                  );
                                  window.location.reload();
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="space-y-2 border-t border-border/40 pt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Calendar Month Totals
                </h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {monthlyRows.length} months
                </span>
              </div>
              {monthlyRows.length === 0 ? (
                <EmptySection message="No monthly usage recorded yet." />
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="h-8 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          Month
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
                        <TableHead className="h-8 px-2 text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                          Quota
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyRows.map((row) => (
                        <TableRow
                          key={row.month}
                          className="border-border/30 hover:bg-cyan-500/[0.03]"
                        >
                          <TableCell className="px-2 py-1.5 text-xs">
                            {formatMonthLabel(row.month)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {formatBytes(row.txBytes)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {formatBytes(row.rxBytes)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {formatBytes(row.totalBytes)}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right font-mono text-xs tabular-nums">
                            {row.quotaGB != null ? `${row.quotaGB} GB` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Data Plan</DialogTitle>
                  <DialogDescription>
                    Update the plan amount and lifecycle. Usage allocations will
                    be recalculated.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-amount" className="text-xs text-muted-foreground">
                        Amount (GB)
                      </Label>
                      <Input
                        id="edit-amount"
                        type="number"
                        min={1}
                        max={9999}
                        value={editAmountGb}
                        onChange={(e) => setEditAmountGb(Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-alert" className="text-xs text-muted-foreground">
                        Alert at (%)
                      </Label>
                      <Input
                        id="edit-alert"
                        type="number"
                        min={1}
                        max={100}
                        value={editAlertPercent}
                        onChange={(e) => setEditAlertPercent(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-start" className="text-xs text-muted-foreground">
                        Start date
                      </Label>
                      <Input
                        id="edit-start"
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-expires" className="text-xs text-muted-foreground">
                        Expiry date
                      </Label>
                      <Input
                        id="edit-expires"
                        type="date"
                        value={editExpiresDate}
                        onChange={(e) => setEditExpiresDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes" className="text-xs text-muted-foreground">
                      Notes (optional)
                    </Label>
                    <Input
                      id="edit-notes"
                      type="text"
                      placeholder="e.g. March top-up"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editTarget) return;
                      setEditSaving(true);
                      try {
                        const startAt = parseDateInputToMs(editStartDate, {
                          endExclusive: false,
                        });
                        const expiresAt = parseDateInputToMs(editExpiresDate, {
                          endExclusive: true,
                        });

                        const res = await fetch(
                          `/api/usage/purchases/${editTarget.id}`,
                          {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              amountGb: editAmountGb,
                              alertPercent: editAlertPercent,
                              notes: editNotes.trim() || undefined,
                              startAt,
                              expiresAt,
                            }),
                          }
                        );
                        const json = await res.json().catch(() => null);
                        if (!res.ok) {
                          throw new Error(
                            json?.error ?? "Failed to update plan"
                          );
                        }
                        setEditOpen(false);
                        window.location.reload();
                      } catch (err) {
                        const message =
                          err instanceof Error ? err.message : "Failed to update plan";
                        window.alert(message);
                      } finally {
                        setEditSaving(false);
                      }
                    }}
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
