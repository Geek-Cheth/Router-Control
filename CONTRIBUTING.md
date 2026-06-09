# Contributing

## Development setup

1. Clone the repository and run `npm install`
2. Copy `.env.example` to `.env.local` and set `ROUTER_PASSWORD`
3. Ensure your Dialog 4G CPE is reachable at `http://192.168.8.1`
4. Run `npm run electron:dev` for the full desktop experience, or `npm run dev` for web-only

## Code quality

Before opening a PR:

```bash
npm run ci
```

This runs ESLint, Next.js production build, and Electron TypeScript compilation.

## Project conventions

- **API routes** live under `src/app/api/` — all router communication is server-side
- **Router client** — extend `src/lib/router-client.ts` for new goform commands
- **Types** — shared interfaces in `src/lib/router-types.ts`
- **Database** — schema in `src/lib/db/schema.ts`, queries in `repository.ts`, inline migrations in `index.ts`
- **UI** — dashboard panels in `src/components/dashboard/`, shadcn primitives in `src/components/ui/`

## Router API investigation

The `scripts/` folder contains tools for probing the router goform API. Use these when adding new features:

| Script | Purpose |
|--------|---------|
| `investigate-safe.mjs` | Safe GET/SET probe (recommended starting point) |
| `investigate-get-only.mjs` | GET-only probe (no destructive actions) |
| `investigate-router-api.mjs` | Comprehensive API discovery |
| `parse-service-js.mjs` | Static analysis of firmware `service.js` |
| `bench-speed-poll.mjs` | Speed polling latency benchmark |

All investigation scripts require `ROUTER_PASSWORD` in the environment (via `.env.local` or `scripts/lib/credentials.mjs`).

## Safety rules

When working with live router APIs:

1. **Never call `REBOOT_DEVICE` casually** — it reboots the router even with `isTest=true`
2. **Poll speed at most every 500 ms** — faster polling may overload the CPE
3. **Test GET commands before SET** — use `investigate-get-only.mjs` first
4. **Document findings** — update `docs/router-api-investigation.md` with new commands and test results
5. **Never commit credentials** — `.env.local`, `config.json`, and investigation output JSON are gitignored

## Adding a new feature

1. Investigate the goform command (scripts + `docs/router-api-investigation.md`)
2. Add methods to `RouterClient` in `src/lib/router-client.ts`
3. Create an API route under `src/app/api/router/` or `src/app/api/usage/`
4. Add UI in `src/components/dashboard/`
5. Log mutations via `logAudit()` in `src/lib/db/repository.ts`
6. Update `CHANGELOG.md` under `[Unreleased]`

## Releases

See [VERSIONING.md](./VERSIONING.md) for the release workflow. Tag pushes trigger the GitHub Actions release pipeline.
