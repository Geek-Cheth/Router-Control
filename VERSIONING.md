# Versioning

Router Control uses [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).

## Version scheme

| Bump | When | Example |
|------|------|---------|
| **PATCH** | Bug fixes, internal refactors, copy/UI tweaks | `0.1.1` → `0.1.2` |
| **MINOR** | New features, backward-compatible behavior | `0.1.x` → `0.2.0` |
| **MAJOR** | Breaking changes (config format, removed APIs) | `0.x` → `1.0.0` |

Pre-1.0 releases (`0.x.y`) may include minor breaking changes.

## Release workflow

1. Update `CHANGELOG.md` — move items from `[Unreleased]` into a new version section with date
2. Bump version in `package.json`:
   ```bash
   npm run version:patch   # or version:minor / version:major
   ```
3. Commit: `chore(release): vX.Y.Z`
4. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z"`
5. Push branch + tag — the **Release** workflow builds the Windows installer and publishes to GitHub Releases

**Rule:** Git tag must match `package.json` (tag `v0.1.1` ↔ version `0.1.1`). The release workflow enforces this.

## Artifacts

Each release publishes:

- `Router Control Setup X.Y.Z.exe` — NSIS installer
- `Router Control Setup X.Y.Z.exe.blockmap` — delta update metadata
- `latest.yml` — update manifest (for future auto-update)

## Local build (no publish)

```bash
npm run release:win
```

Output: `release/` (gitignored).
