# Architecture

Router Control is a local-first desktop app: Electron hosts an embedded Next.js server that proxies all router communication server-side.

## High-level flow

```
┌─────────────┐     HTTP       ┌──────────────────┐     goform HTTP    ┌──────────────┐
│  Electron   │ ──────────────▶│  Next.js server  │ ──────────────────▶│ Dialog 4G    │
│  BrowserWin │  127.0.0.1     │  API routes      │  192.168.8.1       │ CPE Router   │
└─────────────┘                └────────┬─────────┘                    └──────────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │ SQLite (libSQL)  │
                               │ router-control.db│
                               └──────────────────┘
```

## Electron bootstrap

### `electron/main.ts`

- **Single-instance lock** — second launch focuses the existing window
- **Config** — reads/writes `config.json` in userData; seeds from `.env.local` on first run
- **Window** — 1280×800, menu bar hidden, external links open in system browser
- **Tray** — minimize-to-tray; Quit from context menu
- **Dev** (`ELECTRON_DEV=1`) — loads `http://127.0.0.1:3000` (existing Next dev server)
- **Production** — finds a free port, spawns standalone Next server with router env vars

### `electron/server-manager.ts`

- Spawns `standalone/server.js` using Electron's Node runtime (`ELECTRON_RUN_AS_NODE=1`)
- Logs to `{userData}/server.log`
- Polls until HTTP responds (30s timeout)
- Windows: `taskkill /T /F` on shutdown

### `electron/preload.ts`

Minimal preload — adds `electron-app` class to `<html>` for CSS targeting. No IPC bridge yet.

### `electron/paths.ts`

| Function | Path |
|----------|------|
| `getUserDataDir()` | Electron `app.getPath("userData")` |
| `getConfigPath()` | `{userData}/config.json` |
| `getDbPath()` | `{userData}/router-control.db` |
| `getStandaloneDir()` | `{resourcesPath}/standalone` (packaged) or `.next/standalone` |
| `getIconPath()` | `{resourcesPath}/icon.png` |

## Configuration layering

1. **Development** — `.env.local` provides `ROUTER_URL`, `ROUTER_USERNAME`, `ROUTER_PASSWORD`
2. **Packaged** — Electron writes `config.json`; `applyConfigToEnv()` in `src/lib/app-config.ts` loads it once per process
3. **RouterClient** — reads from `process.env` after config is applied

`NEXT_PUBLIC_ROUTER_URL` is display-only in the UI footer. Actual API calls use server-side `ROUTER_URL`.

## Router client (`src/lib/router-client.ts`)

Singleton `RouterClient` on `global.__routerClient` — session cookies persist across API requests in the same Node process.

### Protocol

TZTEK/Huawei-style **goform** endpoints:

| Endpoint | Method | Role |
|----------|--------|------|
| `/goform/goform_get_cmd_process` | GET | Read state (`cmd=...`) |
| `/goform/goform_set_cmd_process` | POST | Actions (`goformId=LOGIN`, etc.) |

### Authentication

1. GET `/main.html` (seed cookies)
2. POST login with base64-encoded credentials
3. Success when `result` is `"0"` or `"4"`
4. Append cookie `pageForward=home`
5. Session TTL: 5 minutes before re-login

### Key commands

| Feature | Command |
|---------|---------|
| Live speed | `realtime_tx_thrpt,realtime_rx_thrpt` |
| Monthly traffic | `monthly_tx_bytes,monthly_rx_bytes` |
| Devices | `station_list` / `lan_station_list` |
| MAC filter | `ACL_mode,wifi_mac_white_list,wifi_mac_black_list` |
| Signal | `network_type,rsrp,rsrq,sinr,band` |
| Reboot | `REBOOT_DEVICE` |
| Password | `CHANGE_PASSWORD` |

Throughput values are **centi-Kbps** (divide by 100 for display).

## Frontend polling

| Hook | Interval | Endpoint |
|------|----------|----------|
| `useRouterData` | 10s | `/api/router/dashboard` |
| `useLiveSpeed` | 1s | `/api/router/speed` |

Speed endpoint uses request coalescing to avoid duplicate in-flight router calls.

## Database (`src/lib/db/`)

**Engine:** `@libsql/client` (SQLite file)  
**ORM:** Drizzle  
**Migrations:** Inline SQL in `index.ts` on first `getDb()` call

### Tables

| Table | Purpose |
|-------|---------|
| `monthly_usage` | One row per `YYYY-MM`; cumulative TX/RX with reset detection |
| `quota_settings` | Local quota cache (single row) |
| `audit_log` | Immutable action log |
| `settings_history` | Setting change events |
| `usage_snapshots` | Time-series every 15 min during sync |
| `data_purchases` | User-defined GB plans with FIFO consumption |

### Usage sync

Called on every dashboard poll:

1. **Reset detection** — if router total drops below 50% of last reading (and last > 5 MB), roll counters into `base_*` columns
2. **Finalization** — past months marked `finalized=true`
3. **Snapshots** — inserted at most every 15 minutes

### Data purchase ledger

Plans sorted by `startAt` (FIFO). Walks `usage_snapshots` to allocate byte deltas. Tracks wasted bytes on expiry and overage when no plan covers usage.

### Paths

| Mode | Database path |
|------|---------------|
| Development | `data/router-control.db` |
| Electron | `{userData}/router-control.db` |

> **Note:** [docs/backend-db-design.md](./docs/backend-db-design.md) describes an earlier design using `better-sqlite3` and a `devices` table. The current implementation uses `@libsql/client` with inline migrations and no `devices` table.

## API layer

All routes use `export const dynamic = "force-dynamic"`. Router failures return HTTP 502.

Mutations (reboot, password, MAC filter, purchases) write to `audit_log` and/or `settings_history`.

## Build and packaging

```
npm run build              → .next/standalone
npm run prepare:standalone → electron-resources/standalone/
npm run build:electron     → dist-electron/
npm run release:win        → release/*.exe (NSIS)
```

### `scripts/after-pack.mjs`

electron-builder strips `node_modules` from extraResources. This hook restores the full standalone tree including native `@libsql` modules.

### `electron-builder.yml`

- App ID: `com.browser-control.app`
- Windows NSIS x64
- ASAR with unpack for `*.node`, `@libsql/**`, `libsql/**`
- GitHub publish provider for releases

## Security model

- Router credentials in `.env.local` (dev) or `config.json` (prod) — never in SQLite
- Next.js server binds `127.0.0.1` only
- No router API exposure to the browser — all calls go through server-side API routes
