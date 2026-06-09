import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getDb, schema } from "./index";
import type { DataPurchase, PurchaseStatus } from "@/lib/router-types";

export async function logAudit(action: string, details: Record<string, unknown> = {}) {
  await getDb()
    .insert(schema.auditLog)
    .values({
      action,
      detailsJson: JSON.stringify(details),
      createdAt: Date.now(),
      source: "app",
    });
}

export async function logSettingChange(
  settingType: string,
  success: boolean,
  details: Record<string, unknown> = {}
) {
  await getDb()
    .insert(schema.settingsHistory)
    .values({
      settingType,
      changedAt: Date.now(),
      success,
      detailsJson: JSON.stringify(details),
    });
}

export async function listAuditLog(limit = 50) {
  return getDb()
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);
}

export async function getQuotaSettings() {
  const rows = await getDb()
    .select()
    .from(schema.quotaSettings)
    .where(eq(schema.quotaSettings.id, 1));
  return rows[0] ?? { id: 1, enabled: true, limitGb: 80, alertPercent: 80, updatedAt: Date.now() };
}

export async function saveQuotaSettingsLocal(enabled: boolean, limitGb: number, alertPercent: number) {
  const now = Date.now();
  await getDb()
    .insert(schema.quotaSettings)
    .values({ id: 1, enabled, limitGb, alertPercent, updatedAt: now })
    .onConflictDoUpdate({
      target: schema.quotaSettings.id,
      set: { enabled, limitGb, alertPercent, updatedAt: now },
    });
}

export async function listMonthlyUsage() {
  return getDb()
    .select()
    .from(schema.monthlyUsage)
    .orderBy(desc(schema.monthlyUsage.yearMonth));
}

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const RESET_THRESHOLD = 0.5;
const MIN_BYTES_FOR_RESET = 5 * 1024 * 1024;

export async function syncMonthlyUsage(params: {
  txBytes: number;
  rxBytes: number;
  quotaGb?: number;
  alertPercent?: number;
  routerDateMonth?: string;
}) {
  const db = getDb();
  const now = Date.now();
  const yearMonth = currentYearMonth();
  await finalizePastMonths();

  const existingRows = await db
    .select()
    .from(schema.monthlyUsage)
    .where(eq(schema.monthlyUsage.yearMonth, yearMonth));
  const existing = existingRows[0];

  let baseTx = existing?.baseTxBytes ?? 0;
  let baseRx = existing?.baseRxBytes ?? 0;
  const lastTx = existing?.lastRouterTx ?? 0;
  const lastRx = existing?.lastRouterRx ?? 0;

  const resetDetected =
    existing &&
    lastTx + lastRx > MIN_BYTES_FOR_RESET &&
    params.txBytes + params.rxBytes < (lastTx + lastRx) * RESET_THRESHOLD;

  if (resetDetected) {
    baseTx += lastTx;
    baseRx += lastRx;
    await logAudit("usage.router_reset_detected", {
      yearMonth,
      previousRouterTx: lastTx,
      previousRouterRx: lastRx,
      newBaseTx: baseTx,
      newBaseRx: baseRx,
    });
  }

  const txBytes = baseTx + params.txBytes;
  const rxBytes = baseRx + params.rxBytes;
  const totalBytes = txBytes + rxBytes;

  if (existing) {
    await db
      .update(schema.monthlyUsage)
      .set({
        txBytes,
        rxBytes,
        totalBytes,
        baseTxBytes: baseTx,
        baseRxBytes: baseRx,
        lastRouterTx: params.txBytes,
        lastRouterRx: params.rxBytes,
        quotaGb: params.quotaGb ?? existing.quotaGb,
        alertPercent: params.alertPercent ?? existing.alertPercent,
        routerDateMonth: params.routerDateMonth ?? existing.routerDateMonth,
        updatedAt: now,
      })
      .where(eq(schema.monthlyUsage.yearMonth, yearMonth));
  } else {
    await db.insert(schema.monthlyUsage).values({
      yearMonth,
      txBytes,
      rxBytes,
      totalBytes,
      baseTxBytes: baseTx,
      baseRxBytes: baseRx,
      lastRouterTx: params.txBytes,
      lastRouterRx: params.rxBytes,
      quotaGb: params.quotaGb,
      alertPercent: params.alertPercent,
      routerDateMonth: params.routerDateMonth,
      finalized: false,
      updatedAt: now,
      createdAt: now,
    });
  }

  await maybeInsertSnapshot(txBytes, rxBytes, yearMonth, now);
}

let lastSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;

async function maybeInsertSnapshot(tx: number, rx: number, yearMonth: string, now: number) {
  if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
  lastSnapshotAt = now;
  await getDb().insert(schema.usageSnapshots).values({
    capturedAt: now,
    monthlyTxBytes: tx,
    monthlyRxBytes: rx,
    yearMonth,
  });
}

export async function finalizePastMonths() {
  const db = getDb();
  const current = currentYearMonth();
  const rows = await db.select().from(schema.monthlyUsage);
  for (const row of rows) {
    if (row.yearMonth !== current && !row.finalized) {
      await db
        .update(schema.monthlyUsage)
        .set({ finalized: true, updatedAt: Date.now() })
        .where(eq(schema.monthlyUsage.yearMonth, row.yearMonth));
    }
  }
}

export async function getStoredUsageForCurrentMonth() {
  const yearMonth = currentYearMonth();
  const rows = await getDb()
    .select()
    .from(schema.monthlyUsage)
    .where(eq(schema.monthlyUsage.yearMonth, yearMonth));
  return rows[0];
}

const GB_BYTES = 1024 * 1024 * 1024;
const DEFAULT_PLAN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

function currentYearMonthFromTs(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthStartTs(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
}

function nextMonthStartTs(ts: number) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
}

function clampToRange(ts: number, startTs: number, endTs: number) {
  return Math.max(startTs, Math.min(endTs, ts));
}

type NormalizedPlan = {
  id: number;
  amountGb: number;
  purchasedAt: number;
  startAt: number;
  expiresAt: number;
  notes: string | null;
  alertPercent: number;
};

type LedgerPlanState = {
  remainingBytes: number;
  usedBytes: number;
  wastedBytes: number | null;
  started: boolean;
  expired: boolean;
};

async function getAllPlansRaw() {
  return getDb()
    .select({
      id: schema.dataPurchases.id,
      amountGb: schema.dataPurchases.amountGb,
      purchasedAt: schema.dataPurchases.purchasedAt,
      startAt: schema.dataPurchases.startAt,
      expiresAt: schema.dataPurchases.expiresAt,
      notes: schema.dataPurchases.notes,
      alertPercent: schema.dataPurchases.alertPercent,
    })
    .from(schema.dataPurchases)
    .orderBy(desc(schema.dataPurchases.purchasedAt));
}

function normalizePlan(row: {
  id: number;
  amountGb: number;
  purchasedAt: number;
  startAt: number | null;
  expiresAt: number | null;
  notes: string | null;
  alertPercent: number;
}): NormalizedPlan {
  const startAt = row.startAt ?? row.purchasedAt;
  const expiresAt = row.expiresAt ?? row.purchasedAt + DEFAULT_PLAN_VALIDITY_MS;
  return {
    id: row.id,
    amountGb: row.amountGb,
    purchasedAt: row.purchasedAt,
    startAt,
    expiresAt,
    notes: row.notes,
    alertPercent: row.alertPercent,
  };
}

async function getMonthlySnapshotTotals(params: {
  yearMonth: string;
  upToTs: number;
}) {
  // usage_snapshots store cumulative tx/rx totals within each month.
  const snaps = await getDb()
    .select({
      capturedAt: schema.usageSnapshots.capturedAt,
      monthlyTxBytes: schema.usageSnapshots.monthlyTxBytes,
      monthlyRxBytes: schema.usageSnapshots.monthlyRxBytes,
    })
    .from(schema.usageSnapshots)
    .where(
      and(
        eq(schema.usageSnapshots.yearMonth, params.yearMonth),
        lte(schema.usageSnapshots.capturedAt, params.upToTs)
      )
    )
    .orderBy(asc(schema.usageSnapshots.capturedAt));

  return snaps.map((s) => ({
    capturedAt: s.capturedAt,
    totalBytes: (s.monthlyTxBytes ?? 0) + (s.monthlyRxBytes ?? 0),
  }));
}

function binaryPlanByStart(a: NormalizedPlan, b: NormalizedPlan) {
  if (a.startAt !== b.startAt) return a.startAt - b.startAt;
  return a.id - b.id;
}

async function computeLedger(params: {
  upToTs: number;
  fallbackCurrentTotalBytes: number;
}) {
  const rawPlans = await getAllPlansRaw();
  if (rawPlans.length === 0) {
    return {
      plans: [] as NormalizedPlan[],
      stateById: new Map<number, LedgerPlanState>(),
      overageBytes: 0,
    };
  }

  const plans = rawPlans
    .map((r) =>
      normalizePlan({
        id: r.id,
        amountGb: r.amountGb,
        purchasedAt: r.purchasedAt,
        startAt: r.startAt ?? null,
        expiresAt: r.expiresAt ?? null,
        notes: r.notes ?? null,
        alertPercent: r.alertPercent ?? 80,
      })
    )
    // Guard against invalid rows
    .filter((p) => p.amountGb > 0 && p.expiresAt > p.startAt)
    .sort(binaryPlanByStart);

  if (plans.length === 0) {
    return {
      plans: [] as NormalizedPlan[],
      stateById: new Map<number, LedgerPlanState>(),
      overageBytes: 0,
    };
  }

  const minStartTs = plans.reduce((m, p) => Math.min(m, p.startAt), plans[0].startAt);

  const stateById = new Map<number, LedgerPlanState>();
  for (const p of plans) {
    stateById.set(p.id, {
      remainingBytes: p.amountGb * GB_BYTES,
      usedBytes: 0,
      wastedBytes: null,
      started: false,
      expired: false,
    });
  }

  // Active FIFO queue is ordered by startAt asc, which matches "plans" sort order.
  const activeQueue: number[] = [];
  let activeIndex = 0;

  // Precompute start/expires maps to apply at event timestamps.
  const plansByStartAt = new Map<number, NormalizedPlan[]>();
  const plansByExpiresAt = new Map<number, NormalizedPlan[]>();
  for (const p of plans) {
    if (!plansByStartAt.has(p.startAt)) plansByStartAt.set(p.startAt, []);
    plansByStartAt.get(p.startAt)!.push(p);

    if (!plansByExpiresAt.has(p.expiresAt)) plansByExpiresAt.set(p.expiresAt, []);
    plansByExpiresAt.get(p.expiresAt)!.push(p);
  }

  let overageBytes = 0;

  // Walk month-by-month to keep tx/rx counters comparable.
  let cursorMonthTs = monthStartTs(minStartTs);
  while (cursorMonthTs < params.upToTs) {
    const monthStart = cursorMonthTs;
    const monthEnd = nextMonthStartTs(cursorMonthTs);
    const segStart = clampToRange(monthStart, minStartTs, params.upToTs);
    const segEnd = clampToRange(monthEnd, minStartTs, params.upToTs);
    if (segStart >= segEnd) {
      cursorMonthTs = monthEnd;
      continue;
    }

    const yearMonth = currentYearMonthFromTs(segStart);
    const snapshots = await getMonthlySnapshotTotals({
      yearMonth,
      upToTs: params.upToTs,
    });

    const isCurrentMonth = currentYearMonthFromTs(params.upToTs) === yearMonth;

    const startEvTimes = Array.from(plansByStartAt.keys()).filter(
      (t) => t >= segStart && t <= segEnd
    );
    const expireEvTimes = Array.from(plansByExpiresAt.keys()).filter(
      (t) => t >= segStart && t <= segEnd
    );

    const timeline = Array.from(
      new Set([segStart, segEnd, ...startEvTimes, ...expireEvTimes])
    )
      .sort((a, b) => a - b)
      // Avoid allocating on identical timestamps
      .filter((t, i, arr) => i === 0 || t !== arr[i - 1]);

    // Compute monthly total at each timeline timestamp using in-memory snapshot scan.
    const totalsAt: number[] = [];
    let snapIdx = 0;
    let lastTotal = 0;
    for (const t of timeline) {
      while (snapIdx < snapshots.length && snapshots[snapIdx].capturedAt <= t) {
        lastTotal = snapshots[snapIdx].totalBytes;
        snapIdx++;
      }
      if (snapshots.length === 0 && isCurrentMonth && t >= params.upToTs) {
        totalsAt.push(params.fallbackCurrentTotalBytes);
      } else {
        totalsAt.push(lastTotal);
      }
    }

    // State update + allocation.
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i];

      // Expire first so the plan doesn't receive usage from interval starting at t.
      const expirePlans = plansByExpiresAt.get(t) ?? [];
      for (const plan of expirePlans) {
        const st = stateById.get(plan.id);
        if (!st || st.expired) continue;
        if (!st.started) continue;
        st.wastedBytes = st.remainingBytes;
        st.remainingBytes = 0;
        st.expired = true;
      }

      const startPlans = plansByStartAt.get(t) ?? [];
      for (const plan of startPlans) {
        const st = stateById.get(plan.id);
        if (!st || st.started) continue;
        // If it somehow already expired at the same timestamp, ignore.
        if (plan.expiresAt <= t) continue;
        st.started = true;
        activeQueue.push(plan.id);
      }

      // Allocate usage until next event boundary.
      if (i === timeline.length - 1) break;
      const nextT = timeline[i + 1];
      const deltaBytes = Math.max(0, totalsAt[i + 1] - totalsAt[i]);
      let remaining = deltaBytes;
      while (remaining > 0) {
        while (
          activeIndex < activeQueue.length &&
          (() => {
            const st = stateById.get(activeQueue[activeIndex]);
            return !st || st.expired || st.remainingBytes <= 0;
          })()
        ) {
          activeIndex++;
        }

        if (activeIndex >= activeQueue.length) {
          overageBytes += remaining;
          break;
        }

        const planId = activeQueue[activeIndex];
        const st = stateById.get(planId)!;
        const deduct = Math.min(st.remainingBytes, remaining);
        st.remainingBytes -= deduct;
        st.usedBytes += deduct;
        remaining -= deduct;
      }
    }

    cursorMonthTs = monthEnd;
  }

  return { plans, stateById, overageBytes };
}

export async function recordDataPurchase(params: {
  amountGb: number;
  notes?: string;
  alertPercent: number;
  startAt: number;
  expiresAt: number;
}) {
  const now = Date.now();
  const startAt = params.startAt;
  const expiresAt = params.expiresAt;
  if (!Number.isFinite(startAt) || !Number.isFinite(expiresAt)) {
    throw new Error("Invalid startAt/expiresAt");
  }
  if (expiresAt <= startAt) {
    throw new Error("expiresAt must be after startAt");
  }

  await getDb().insert(schema.dataPurchases).values({
    amountGb: params.amountGb,
    purchasedAt: now,
    startAt,
    expiresAt,
    notes: params.notes ?? null,
    // Baseline/used/closed are no longer used for ledger computation,
    // but the table still contains these columns.
    baselineBytes: 0,
    usedBytes: null,
    closedAt: null,
    alertPercent: params.alertPercent,
  });

  await logAudit("purchase.record", {
    amountGb: params.amountGb,
    notes: params.notes,
    alertPercent: params.alertPercent,
    startAt,
    expiresAt,
  });
}

export async function updateDataPurchase(
  id: number,
  params: {
    amountGb: number;
    notes?: string;
    alertPercent: number;
    startAt: number;
    expiresAt: number;
  }
) {
  const startAt = params.startAt;
  const expiresAt = params.expiresAt;
  if (expiresAt <= startAt) throw new Error("expiresAt must be after startAt");

  const now = Date.now();
  const res = await getDb()
    .update(schema.dataPurchases)
    .set({
      amountGb: params.amountGb,
      startAt,
      expiresAt,
      notes: params.notes ?? null,
      baselineBytes: 0,
      usedBytes: null,
      closedAt: null,
      alertPercent: params.alertPercent,
    })
    .where(eq(schema.dataPurchases.id, id));

  await logAudit("purchase.update", { id, ...params, updatedAt: now });
  return res;
}

export async function deleteDataPurchase(id: number) {
  const res = await getDb().delete(schema.dataPurchases).where(eq(schema.dataPurchases.id, id));
  await logAudit("purchase.delete", { id });
  return res;
}

export async function listDataPurchases() {
  const now = Date.now();
  const stored = await getStoredUsageForCurrentMonth();
  const fallbackCurrentTotalBytes =
    stored?.totalBytes ?? 0;

  const ledger = await computeLedger({
    upToTs: now,
    fallbackCurrentTotalBytes,
  });

  const purchases: DataPurchase[] = ledger.plans.map((p) => {
    const st = ledger.stateById.get(p.id)!;
    const limitBytes = p.amountGb * GB_BYTES;
    const usedBytes = st.usedBytes;
    const remainingBytes = st.remainingBytes;
    const usagePercent =
      limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

    const status: DataPurchase["status"] =
      now < p.startAt
        ? "scheduled"
        : now >= p.expiresAt
          ? "expired"
          : remainingBytes <= 0
            ? "depleted"
            : "active";

    return {
      id: p.id,
      amountGb: p.amountGb,
      purchasedAt: p.purchasedAt,
      startAt: p.startAt,
      expiresAt: p.expiresAt,
      notes: p.notes,
      usedBytes,
      remainingBytes,
      wastedBytes: st.wastedBytes,
      alertPercent: p.alertPercent,
      status,
    };
  });

  // Keep UI stable: newest purchase record first.
  purchases.sort((a, b) => b.purchasedAt - a.purchasedAt);
  return purchases;
}

export async function getPurchaseStatus(
  currentTotalBytes: number
): Promise<PurchaseStatus | null> {
  const now = Date.now();
  const ledger = await computeLedger({
    upToTs: now,
    fallbackCurrentTotalBytes: currentTotalBytes,
  });
  if (ledger.plans.length === 0) return null;

  // "Head" is the oldest plan that is currently within its valid window.
  const activeCandidates = ledger.plans
    .filter((p) => p.startAt <= now && now < p.expiresAt)
    .sort((a, b) => a.startAt - b.startAt);
  if (activeCandidates.length === 0) return null;

  const head =
    activeCandidates.find(
      (p) => (ledger.stateById.get(p.id)?.remainingBytes ?? 0) > 0
    ) ?? activeCandidates[0];
  const st = ledger.stateById.get(head.id)!;
  const limitBytes = head.amountGb * GB_BYTES;
  const usedBytes = st.usedBytes;
  const remainingBytes = st.remainingBytes;
  const usagePercent =
    limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  return {
    id: head.id,
    amountGb: head.amountGb,
    startAt: head.startAt,
    expiresAt: head.expiresAt,
    alertPercent: head.alertPercent,
    usedBytes,
    remainingBytes,
    usagePercent,
    isDepleted: remainingBytes <= 0,
  };
}
