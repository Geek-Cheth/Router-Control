# Backend Database Design — browser-control

Local persistence for a single-user Windows Next.js app that controls a Dialog 4G router via goform API (`src/lib/router-client.ts`).

## Stack decision

**SQLite via `better-sqlite3` + Drizzle ORM.**

- Single file, zero ops, works offline
- Safe concurrent reads; WAL mode handles occasional writes from API routes
- Typed schema matches existing TypeScript (`ConnectedDevice`, etc.)
- JSON files rejected: no transactions, corruption risk on crash, poor query ergonomics

DB path: `data/router-control.db` (override: `DB_PATH` env). Add `data/` to `.gitignore`.

## Schema

### devices

Tracks every MAC ever seen on the LAN/WiFi (router only returns currently connected).

| Column | Type | Notes |
|--------|------|-------|
| `mac` | TEXT PK | Uppercase, colon-separated |
| `hostname` | TEXT | Last known; nullable |
| `first_seen_at` | INTEGER | Unix ms |
| `last_seen_at` | INTEGER | Unix ms |
| `last_ip` | TEXT | Optional |
| `notes` | TEXT | User alias/notes |

Index: `last_seen_at DESC` for recent devices.

### usage_snapshots

Time-series of router traffic counters.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `captured_at` | INTEGER | Unix ms |
| `monthly_tx_bytes` | INTEGER | From goform `monthly_tx_bytes` |
| `monthly_rx_bytes` | INTEGER | From goform `monthly_rx_bytes` |
| `realtime_tx_kbps` | REAL | Optional |
| `realtime_rx_kbps` | REAL | Optional |
| `devices_json` | TEXT | JSON snapshot of `station_list` at capture time |

Per-device byte counters are **not** available from the current router API. Store device list in JSON for “who was online when” analysis.

### audit_log

Immutable log of actions performed through this app.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `action` | TEXT | e.g. `mac_filter.update`, `password.change` |
| `details_json` | TEXT | Structured metadata — **no secrets** |
| `created_at` | INTEGER | Unix ms |
| `source` | TEXT | `app` \| `system` |

### settings_history

Records that a setting changed, never the value.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `setting_type` | TEXT | `admin_password`, `wifi_psk`, `wifi_ssid`, `mac_filter_mode` |
| `changed_at` | INTEGER | Unix ms |
| `success` | INTEGER | 0 \| 1 |
| `details_json` | TEXT | e.g. `{ method: "CHANGE_PASSWORD" }` only |

**Never store:** plaintext passwords, base64 passwords, WiFi PSK, password hashes.

Router credentials remain in `.env.local` only.

## Local vs live data

| Local (SQLite) | Live (router goform) |
|----------------|----------------------|
| Device history & aliases | `station_list` |
| Usage trend snapshots | `monthly_tx/rx_bytes`, realtime throughput |
| Audit trail | Current MAC filter state |
| “Password changed at …” events | Signal, firmware, SSID, WAN/LAN IPs |
| Retention policy config | Session cookies (`RouterClient` in-memory) |

## Sync rules

1. **Dashboard poll** — upsert each device from `getDevices()`; update `last_seen_at`, `hostname`, `last_ip`.
2. **Usage snapshot** — insert row every 15 minutes with traffic from `getTrafficStats()` + optional `devices_json`.
3. **Mutations** — on successful `setMacFilter()` (and future password/WiFi routes), write `audit_log`; on password change, also write `settings_history`.
4. **Retention** — optional prune: delete `usage_snapshots` older than 90 days.

## File layout

```
src/lib/db/
├── index.ts          # singleton better-sqlite3 + drizzle
├── schema.ts         # table definitions
├── migrate.ts        # run pending migrations on startup
└── repositories/
    ├── devices.ts
    ├── usage.ts
    ├── audit.ts
    └── settings-history.ts
drizzle/
└── 0000_init.sql
data/
└── router-control.db   # gitignored
```

## Migrations

1. Define tables in `src/lib/db/schema.ts`
2. `npx drizzle-kit generate` → `drizzle/0000_init.sql`
3. `src/lib/db/migrate.ts` runs on first server import

## Integration hooks

- `src/app/api/router/dashboard/route.ts` — after `getDashboard()`, upsert devices + maybe snapshot
- `src/app/api/router/mac-filter/route.ts` — after `setMacFilter()`, insert `audit_log` row
