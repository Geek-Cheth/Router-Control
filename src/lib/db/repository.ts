import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "./index";
import type {
  DailyUsageRow,
  DataPurchase,
  PlanPrediction,
  PurchaseStatus,
  UsageAnalytics,
} from "@/lib/router-types";

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
  await trackUsageDelta(txBytes, rxBytes, now);
}

let lastSnapshotAt = 0;
const SNAPSHOT_INTERVAL_MS = 15 * 60 * 1000;
let lastTrackedTotals: { tx: number; rx: number; yearMonth: string; at: number } | null =
  null;

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function localDateKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayStartTs(dateKey: string) {
  const [yyyy, mm, dd] = dateKey.split("-").map((n) => Number(n));
  return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0).getTime();
}

type DayMapEntry = { tx: number; rx: number; total: number; updatedAt: number };

function enumerateDateKeys(fromTs: number, toTs: number): string[] {
  const start = Math.min(fromTs, toTs);
  const end = Math.max(fromTs, toTs);
  const keys: string[] = [];
  let cursor = dayStartTs(localDateKey(start));
  const endCursor = dayStartTs(localDateKey(end));
  while (cursor <= endCursor) {
    keys.push(localDateKey(cursor));
    cursor += MS_PER_DAY;
  }
  return keys;
}

function addDeltaToDayMap(
  dayMap: Map<string, DayMapEntry>,
  dateKey: string,
  deltaTx: number,
  deltaRx: number,
  updatedAt: number
) {
  if (deltaTx + deltaRx <= 0) return;
  const existing = dayMap.get(dateKey) ?? { tx: 0, rx: 0, total: 0, updatedAt };
  existing.tx += deltaTx;
  existing.rx += deltaRx;
  existing.total += deltaTx + deltaRx;
  existing.updatedAt = Math.max(existing.updatedAt, updatedAt);
  dayMap.set(dateKey, existing);
}

function distributeDeltaToDayMap(
  dayMap: Map<string, DayMapEntry>,
  deltaTx: number,
  deltaRx: number,
  fromTs: number,
  toTs: number
) {
  const dates = enumerateDateKeys(fromTs, toTs);
  if (dates.length === 0) return;
  const perTx = deltaTx / dates.length;
  const perRx = deltaRx / dates.length;
  for (const date of dates) {
    addDeltaToDayMap(dayMap, date, perTx, perRx, toTs);
  }
}

let dailyBackfillDone = false;

async function ensureDailyBackfill() {
  if (dailyBackfillDone) return;

  const snapRows = await getDb()
    .select({ id: schema.usageSnapshots.id })
    .from(schema.usageSnapshots);
  if (snapRows.length < 2) return;

  await backfillDailyUsageFromSnapshots();
  dailyBackfillDone = true;
}

async function backfillDailyUsageFromSnapshots() {
  const snaps = await getDb()
    .select()
    .from(schema.usageSnapshots)
    .orderBy(asc(schema.usageSnapshots.capturedAt));

  if (snaps.length === 0) return;

  const dayMap = new Map<string, DayMapEntry>();

  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const curr = snaps[i];
    let deltaTx = 0;
    let deltaRx = 0;
    if (prev.yearMonth === curr.yearMonth) {
      deltaTx = Math.max(0, curr.monthlyTxBytes - prev.monthlyTxBytes);
      deltaRx = Math.max(0, curr.monthlyRxBytes - prev.monthlyRxBytes);
    } else {
      deltaTx = curr.monthlyTxBytes;
      deltaRx = curr.monthlyRxBytes;
    }
    if (deltaTx + deltaRx === 0) continue;

    const prevDate = localDateKey(prev.capturedAt);
    const currDate = localDateKey(curr.capturedAt);
    if (prev.yearMonth !== curr.yearMonth) {
      distributeDeltaToDayMap(
        dayMap,
        deltaTx,
        deltaRx,
        monthStartTs(curr.capturedAt),
        curr.capturedAt
      );
    } else if (prevDate !== currDate) {
      distributeDeltaToDayMap(dayMap, deltaTx, deltaRx, prev.capturedAt, curr.capturedAt);
    } else {
      addDeltaToDayMap(dayMap, currDate, deltaTx, deltaRx, curr.capturedAt);
    }
  }

  for (const [date, usage] of dayMap) {
    const todayKey = localDateKey(Date.now());
    const existing = await getDb()
      .select()
      .from(schema.dailyUsage)
      .where(eq(schema.dailyUsage.date, date));
    const row = existing[0];

    if (date === todayKey && row && row.updatedAt > usage.updatedAt) {
      continue;
    }

    await upsertDailyUsageRow({
      date,
      txBytes: usage.tx,
      rxBytes: usage.rx,
      totalBytes: usage.total,
      now: usage.updatedAt,
    });
  }
}

async function ensureLastTrackedTotals() {
  if (lastTrackedTotals) return;

  const yearMonth = currentYearMonth();
  const snaps = await getDb()
    .select()
    .from(schema.usageSnapshots)
    .where(eq(schema.usageSnapshots.yearMonth, yearMonth))
    .orderBy(desc(schema.usageSnapshots.capturedAt))
    .limit(1);

  if (snaps[0]) {
    lastTrackedTotals = {
      tx: snaps[0].monthlyTxBytes,
      rx: snaps[0].monthlyRxBytes,
      yearMonth,
      at: snaps[0].capturedAt,
    };
    return;
  }

  const stored = await getStoredUsageForCurrentMonth();
  if (stored) {
    lastTrackedTotals = {
      tx: stored.txBytes,
      rx: stored.rxBytes,
      yearMonth,
      at: stored.updatedAt,
    };
  }
}

async function distributeAndUpsertDelta(
  deltaTx: number,
  deltaRx: number,
  fromTs: number,
  toTs: number
) {
  const dates = enumerateDateKeys(fromTs, toTs);
  if (dates.length === 0) return;

  const perTx = deltaTx / dates.length;
  const perRx = deltaRx / dates.length;

  for (const date of dates) {
    const existing = await getDb()
      .select()
      .from(schema.dailyUsage)
      .where(eq(schema.dailyUsage.date, date));
    const row = existing[0];
    await upsertDailyUsageRow({
      date,
      txBytes: (row?.txBytes ?? 0) + perTx,
      rxBytes: (row?.rxBytes ?? 0) + perRx,
      totalBytes: (row?.totalBytes ?? 0) + perTx + perRx,
      now: toTs,
    });
  }
}

async function trackUsageDelta(tx: number, rx: number, now: number) {
  await ensureLastTrackedTotals();
  const yearMonth = currentYearMonth();

  if (!lastTrackedTotals) {
    lastTrackedTotals = { tx, rx, yearMonth, at: now };
    return;
  }

  if (lastTrackedTotals.yearMonth !== yearMonth) {
    await backfillDailyUsageFromSnapshots();
    lastTrackedTotals = { tx, rx, yearMonth, at: now };
    return;
  }

  const deltaTx = Math.max(0, tx - lastTrackedTotals.tx);
  const deltaRx = Math.max(0, rx - lastTrackedTotals.rx);

  if (deltaTx + deltaRx > 0) {
    const lastDate = localDateKey(lastTrackedTotals.at);
    const currentDate = localDateKey(now);
    if (lastDate !== currentDate) {
      await distributeAndUpsertDelta(deltaTx, deltaRx, lastTrackedTotals.at, now);
    } else {
      const existing = await getDb()
        .select()
        .from(schema.dailyUsage)
        .where(eq(schema.dailyUsage.date, currentDate));
      const row = existing[0];
      await upsertDailyUsageRow({
        date: currentDate,
        txBytes: (row?.txBytes ?? 0) + deltaTx,
        rxBytes: (row?.rxBytes ?? 0) + deltaRx,
        totalBytes: (row?.totalBytes ?? 0) + deltaTx + deltaRx,
        now,
      });
    }
  }

  lastTrackedTotals = { tx, rx, yearMonth, at: now };
}

async function upsertDailyUsageRow(params: {
  date: string;
  txBytes: number;
  rxBytes: number;
  totalBytes: number;
  now: number;
}) {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.dailyUsage)
    .where(eq(schema.dailyUsage.date, params.date));
  if (existing[0]) {
    await db
      .update(schema.dailyUsage)
      .set({
        txBytes: params.txBytes,
        rxBytes: params.rxBytes,
        totalBytes: params.totalBytes,
        updatedAt: params.now,
      })
      .where(eq(schema.dailyUsage.date, params.date));
  } else {
    await db.insert(schema.dailyUsage).values({
      date: params.date,
      txBytes: params.txBytes,
      rxBytes: params.rxBytes,
      totalBytes: params.totalBytes,
      updatedAt: params.now,
    });
  }
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

const PREDICTION_LOOKBACK_DAYS = 7;
const MIN_BURN_RATE_BYTES = 1024 * 1024; // 1 MB/day

function buildDailySeries(days: number, dayMap: Map<string, DailyUsageRow>): DailyUsageRow[] {
  const now = Date.now();
  const result: DailyUsageRow[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const ts = now - i * MS_PER_DAY;
    const date = localDateKey(ts);
    const existing = dayMap.get(date);
    result.push(
      existing ?? {
        date,
        txBytes: 0,
        rxBytes: 0,
        totalBytes: 0,
      }
    );
  }

  return result;
}

async function loadDailyUsageMap(sinceTs: number) {
  const sinceDate = localDateKey(sinceTs);
  const rows = await getDb()
    .select()
    .from(schema.dailyUsage)
    .where(gte(schema.dailyUsage.date, sinceDate))
    .orderBy(asc(schema.dailyUsage.date));

  const dayMap = new Map<string, DailyUsageRow>();
  for (const row of rows) {
    dayMap.set(row.date, {
      date: row.date,
      txBytes: row.txBytes,
      rxBytes: row.rxBytes,
      totalBytes: row.totalBytes,
    });
  }
  return dayMap;
}

export async function getDailyUsageStats(days = 30): Promise<{
  daily: DailyUsageRow[];
  averageDailyBytes: number;
  sampleDays: number;
}> {
  await ensureDailyBackfill();
  const safeDays = Math.min(Math.max(days, 1), 90);
  const now = Date.now();
  const sinceTs = now - (safeDays - 1) * MS_PER_DAY;
  const dayMap = await loadDailyUsageMap(sinceTs);
  const daily = buildDailySeries(safeDays, dayMap);

  const todayKey = localDateKey(now);
  const sampleRows = daily.filter((d) => d.date !== todayKey && d.totalBytes > 0);
  const rowsForAverage = sampleRows.length > 0 ? sampleRows : daily.filter((d) => d.totalBytes > 0);
  const sampleDays = rowsForAverage.length;
  const averageDailyBytes =
    sampleDays > 0
      ? rowsForAverage.reduce((sum, row) => sum + row.totalBytes, 0) / sampleDays
      : 0;

  return { daily, averageDailyBytes, sampleDays };
}

export async function predictPlanDepletion(
  purchaseStatus: PurchaseStatus | null,
  averageDailyBytes: number,
  sampleDays: number
): Promise<PlanPrediction | null> {
  if (!purchaseStatus) return null;

  const now = Date.now();
  const daysUntilExpiry = Math.max(0, (purchaseStatus.expiresAt - now) / MS_PER_DAY);

  if (purchaseStatus.isDepleted || purchaseStatus.remainingBytes <= 0) {
    return {
      averageDailyBytes,
      daysUntilDepletion: 0,
      daysUntilExpiry,
      estimatedDepletionAt: now,
      limitingFactor: "already_depleted",
      sampleDays,
    };
  }

  if (sampleDays === 0 || averageDailyBytes < MIN_BURN_RATE_BYTES) {
    return {
      averageDailyBytes,
      daysUntilDepletion: null,
      daysUntilExpiry,
      estimatedDepletionAt: null,
      limitingFactor: "insufficient_data",
      sampleDays,
    };
  }

  const daysUntilDepletion = purchaseStatus.remainingBytes / averageDailyBytes;
  const estimatedDepletionAt = now + daysUntilDepletion * MS_PER_DAY;

  let limitingFactor: PlanPrediction["limitingFactor"] = "burn_rate";
  if (daysUntilExpiry <= daysUntilDepletion) {
    limitingFactor = "expiry";
  }

  return {
    averageDailyBytes,
    daysUntilDepletion,
    daysUntilExpiry,
    estimatedDepletionAt,
    limitingFactor,
    sampleDays,
  };
}

export async function getUsageAnalytics(days = 30): Promise<UsageAnalytics> {
  const stored = await getStoredUsageForCurrentMonth();
  const currentTotalBytes = stored?.totalBytes ?? 0;
  const purchaseStatus = await getPurchaseStatus(currentTotalBytes);
  const { daily, averageDailyBytes, sampleDays } = await getDailyUsageStats(days);

  const lookbackSince = Date.now() - PREDICTION_LOOKBACK_DAYS * MS_PER_DAY;
  const lookbackMap = await loadDailyUsageMap(lookbackSince);
  const lookbackDaily = buildDailySeries(PREDICTION_LOOKBACK_DAYS, lookbackMap);
  const todayKey = localDateKey(Date.now());
  const lookbackSample = lookbackDaily.filter(
    (d) => d.date !== todayKey && d.totalBytes > 0
  );
  const predictionSampleDays =
    lookbackSample.length > 0
      ? lookbackSample.length
      : lookbackDaily.filter((d) => d.totalBytes > 0).length;
  let predictionAverage =
    predictionSampleDays > 0
      ? (lookbackSample.length > 0 ? lookbackSample : lookbackDaily.filter((d) => d.totalBytes > 0))
          .reduce((sum, row) => sum + row.totalBytes, 0) / predictionSampleDays
      : 0;
  let effectiveSampleDays = predictionSampleDays;

  if (
    effectiveSampleDays === 0 &&
    sampleDays > 0 &&
    averageDailyBytes >= MIN_BURN_RATE_BYTES
  ) {
    effectiveSampleDays = sampleDays;
    predictionAverage = averageDailyBytes;
  }

  const prediction = await predictPlanDepletion(
    purchaseStatus,
    predictionAverage,
    effectiveSampleDays
  );

  return {
    daily,
    averageDailyBytes,
    sampleDays,
    prediction,
  };
}
