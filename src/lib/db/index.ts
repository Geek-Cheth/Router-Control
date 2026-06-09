import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import * as schema from "./schema";
import { getDefaultDbPath } from "@/lib/app-config";

const defaultPath = join(process.cwd(), "data", "router-control.db");

function resolveDbFilePath() {
  if (process.env.DB_PATH) return process.env.DB_PATH.replace(/^file:/, "");
  if (process.env.APP_DATA_DIR) return getDefaultDbPath();
  return defaultPath;
}

function runMigrations(client: Client) {
  client.execute(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const statements = [
    `CREATE TABLE IF NOT EXISTS monthly_usage (
      year_month TEXT PRIMARY KEY,
      tx_bytes INTEGER NOT NULL DEFAULT 0,
      rx_bytes INTEGER NOT NULL DEFAULT 0,
      total_bytes INTEGER NOT NULL DEFAULT 0,
      quota_gb INTEGER,
      alert_percent INTEGER,
      router_date_month TEXT,
      base_tx_bytes INTEGER NOT NULL DEFAULT 0,
      base_rx_bytes INTEGER NOT NULL DEFAULT 0,
      last_router_tx INTEGER NOT NULL DEFAULT 0,
      last_router_rx INTEGER NOT NULL DEFAULT 0,
      finalized INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS quota_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      limit_gb INTEGER NOT NULL DEFAULT 80,
      alert_percent INTEGER NOT NULL DEFAULT 80,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'app'
    )`,
    `CREATE TABLE IF NOT EXISTS settings_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_type TEXT NOT NULL,
      changed_at INTEGER NOT NULL,
      success INTEGER NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS usage_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at INTEGER NOT NULL,
      monthly_tx_bytes INTEGER NOT NULL,
      monthly_rx_bytes INTEGER NOT NULL,
      year_month TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS data_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount_gb INTEGER NOT NULL,
      purchased_at INTEGER NOT NULL,
      start_at INTEGER,
      expires_at INTEGER,
      notes TEXT,
      baseline_bytes INTEGER NOT NULL,
      used_bytes INTEGER,
      closed_at INTEGER,
      alert_percent INTEGER NOT NULL DEFAULT 80
    )`,
    `CREATE INDEX IF NOT EXISTS idx_monthly_usage_updated ON monthly_usage(updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_data_purchases_active ON data_purchases(closed_at, purchased_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_usage_snapshots_month ON usage_snapshots(year_month, captured_at DESC)`,
  ];

  for (const sql of statements) {
    client.execute(sql);
  }

  // Backfill lifecycle columns for existing DBs created before this feature.
  // SQLite does not support IF NOT EXISTS for ADD COLUMN across all versions,
  // so we attempt ALTER TABLE and ignore failures.
  const DEFAULT_PLAN_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;
  try {
    client.execute(`ALTER TABLE data_purchases ADD COLUMN start_at INTEGER`);
  } catch {}
  try {
    client.execute(`ALTER TABLE data_purchases ADD COLUMN expires_at INTEGER`);
  } catch {}
  try {
    client.execute(`
      UPDATE data_purchases
      SET start_at = purchased_at
      WHERE start_at IS NULL
    `);
    client.execute(
      `
      UPDATE data_purchases
      SET expires_at = purchased_at + ${DEFAULT_PLAN_VALIDITY_MS}
      WHERE expires_at IS NULL
    `
    );
  } catch {}

  const now = Date.now();
  client.execute({
    sql: `INSERT OR IGNORE INTO quota_settings (id, enabled, limit_gb, alert_percent, updated_at)
          VALUES (1, 1, 80, 80, ?)`,
    args: [now],
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  // eslint-disable-next-line no-var
  var __libsql: Client | undefined;
}

export function getDb() {
  if (!global.__db) {
    const filePath = resolveDbFilePath();
    const url = filePath.startsWith("file:") ? filePath : `file:${filePath}`;
    mkdirSync(dirname(filePath.replace(/^file:/, "")), { recursive: true });
    const client = createClient({ url });
    runMigrations(client);
    global.__libsql = client;
    global.__db = drizzle(client, { schema });
  }
  return global.__db;
}

export { schema };
