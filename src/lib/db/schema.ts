import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/** One row per calendar month — preserved even if router counters reset */
export const monthlyUsage = sqliteTable("monthly_usage", {
  yearMonth: text("year_month").primaryKey(), // YYYY-MM
  txBytes: integer("tx_bytes").notNull().default(0),
  rxBytes: integer("rx_bytes").notNull().default(0),
  totalBytes: integer("total_bytes").notNull().default(0),
  quotaGb: integer("quota_gb"),
  alertPercent: integer("alert_percent"),
  routerDateMonth: text("router_date_month"),
  baseTxBytes: integer("base_tx_bytes").notNull().default(0),
  baseRxBytes: integer("base_rx_bytes").notNull().default(0),
  lastRouterTx: integer("last_router_tx").notNull().default(0),
  lastRouterRx: integer("last_router_rx").notNull().default(0),
  finalized: integer("finalized", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Local quota override / cache — syncs with router when possible */
export const quotaSettings = sqliteTable("quota_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  limitGb: integer("limit_gb").notNull().default(80),
  alertPercent: integer("alert_percent").notNull().default(80),
  updatedAt: integer("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
  source: text("source").notNull().default("app"),
});

export const settingsHistory = sqliteTable("settings_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  settingType: text("setting_type").notNull(),
  changedAt: integer("changed_at").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  detailsJson: text("details_json").notNull().default("{}"),
});

export const usageSnapshots = sqliteTable("usage_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  capturedAt: integer("captured_at").notNull(),
  monthlyTxBytes: integer("monthly_tx_bytes").notNull(),
  monthlyRxBytes: integer("monthly_rx_bytes").notNull(),
  yearMonth: text("year_month").notNull(),
});

/** Rolled-up daily traffic totals derived from snapshots and live sync */
export const dailyUsage = sqliteTable("daily_usage", {
  date: text("date").primaryKey(), // YYYY-MM-DD (local)
  txBytes: integer("tx_bytes").notNull().default(0),
  rxBytes: integer("rx_bytes").notNull().default(0),
  totalBytes: integer("total_bytes").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

/** User-recorded data purchases tracked against cumulative usage */
export const dataPurchases = sqliteTable("data_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  amountGb: integer("amount_gb").notNull(),
  purchasedAt: integer("purchased_at").notNull(),
  // Plan lifecycle (for FIFO consumption + wasted-data at expiry)
  startAt: integer("start_at"),
  expiresAt: integer("expires_at"),
  notes: text("notes"),
  baselineBytes: integer("baseline_bytes").notNull(),
  usedBytes: integer("used_bytes"),
  closedAt: integer("closed_at"),
  alertPercent: integer("alert_percent").notNull().default(80),
});

