# Router Control

Desktop dashboard for **Dialog 4G CPE** routers (TZTEK/Huawei-style firmware). Monitor live speed, data usage, connected devices, and MAC filtering — with local SQLite history that survives router counter resets.

Built with **Next.js 16** (web UI + API) and **Electron** (Windows desktop app).

## Features

- **Live speed** — upload/download throughput polled every second
- **Dashboard** — firmware, IMEI, SSID, Wi‑Fi state, LAN/WAN IP, LTE signal (RSRP/RSRQ/SINR/band)
- **Connected devices** — MAC, IP, hostname, uptime via `station_list`
- **MAC filtering** — view and set whitelist, blacklist, or disabled mode
- **Data usage** — router monthly TX/RX + local persistence with reset detection
- **Data purchase plans** — record GB plans with FIFO consumption tracking
- **Usage history** — monthly rows, snapshots, and purchase management
- **Router actions** — reboot and admin password change
- **Audit trail** — logs reboots, password changes, MAC filter updates, purchases

## Supported hardware

Tested on **Dialog 4G CPE** at `http://192.168.8.1` (firmware `S10_1.23.1`). Other TZTEK/Huawei goform routers may work partially.

## Prerequisites

- Node.js **20+**
- Windows 10/11 (primary target; NSIS installer for x64)
- Router reachable on your LAN

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure router credentials

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `ROUTER_PASSWORD` (required).

### 3. Run

**Web only** (browser at `http://localhost:3000`):

```bash
npm run dev
```

**Desktop app** (Electron + Next dev server):

```bash
npm run electron:dev
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ROUTER_URL` | No | `http://192.168.8.1` | Router admin URL |
| `ROUTER_USERNAME` | No | `user` | Admin username |
| `ROUTER_PASSWORD` | **Yes** | *(empty)* | Admin password |
| `NEXT_PUBLIC_ROUTER_URL` | No | `192.168.8.1` | Display-only in dashboard header |

### Packaged app

On first launch, Electron seeds `config.json` from `.env.local` if present:

| Path | Purpose |
|------|---------|
| `%APPDATA%/Router Control/config.json` | Persistent router credentials |
| `%APPDATA%/Router Control/router-control.db` | SQLite database |
| `%APPDATA%/Router Control/server.log` | Embedded Next.js server logs |

Config precedence: process env (Electron) → `config.json` → defaults in `src/lib/app-config.ts`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run electron:dev` | Electron shell + Next dev |
| `npm run build` | Next.js production build |
| `npm run ci` | Lint + Next build + Electron compile (CI) |
| `npm run electron:pack` | Unpacked Windows build (`release/win-unpacked/`) |
| `npm run electron:dist` | NSIS installer (`release/`) |
| `npm run release:win` | Full Windows release build |
| `npm run lint` | ESLint |

## Project structure

```
electron/          Electron main process, tray, embedded server
src/app/           Next.js App Router UI and API routes
src/components/    Dashboard panels and UI primitives
src/hooks/         Data polling hooks
src/lib/           Router client, DB, config, formatting
scripts/           Build pipeline + router API investigation tools
docs/              API investigation and design notes
```

## API routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/router/dashboard` | GET | Full dashboard + usage sync |
| `/api/router/speed` | GET | Live TX/RX throughput |
| `/api/router/reboot` | POST | Reboot router |
| `/api/router/password` | POST | Change admin password |
| `/api/router/mac-filter` | GET, POST | MAC filter state |
| `/api/usage/monthly` | GET | Monthly usage history |
| `/api/usage/active` | GET | Current month + active purchase |
| `/api/usage/purchases` | GET, POST | Data purchase plans |
| `/api/usage/purchases/[id]` | PUT, DELETE | Update/delete plan |

## Known limitations

- **No per-device byte counters** — firmware exposes aggregate traffic only. See [docs/per-device-usage.md](./docs/per-device-usage.md).
- **Reboot is real** — `REBOOT_DEVICE` reboots even with `isTest=true`. See [docs/router-api-investigation.md](./docs/router-api-investigation.md).
- Speed values from firmware are **centi-Kbps** (divide by 100 for Kbps display).

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, Electron bootstrap, DB schema |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow and safety rules |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |
| [VERSIONING.md](./VERSIONING.md) | Semver policy |
| [docs/router-api-investigation.md](./docs/router-api-investigation.md) | Full goform API reference |
| [docs/per-device-usage.md](./docs/per-device-usage.md) | Per-device usage strategy |
| [docs/backend-db-design.md](./docs/backend-db-design.md) | Original DB design notes |

## Releases

Windows installers are published on [GitHub Releases](https://github.com/Geek-Cheth/Router-Control/releases).

```bash
npm run release:win
```

Output: `release/Router Control Setup X.Y.Z.exe`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Router login failed" | Check `ROUTER_PASSWORD` in `.env.local` or `config.json` |
| Dashboard blank in packaged app | Check `server.log` in app data directory |
| Speed values look wrong | Firmware returns centi-Kbps; app divides by 100 |
| Port 3000 in use | Stop other dev servers before `electron:dev` |

## Security

- Never commit `.env.local` or `config.json` with real passwords
- Passwords are base64-encoded for the router API only; not stored in SQLite
- Embedded Next.js server binds to `127.0.0.1` only

## License

Private — see repository owner for terms.
