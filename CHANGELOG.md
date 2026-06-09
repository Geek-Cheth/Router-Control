# Changelog

All notable changes to **Router Control** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- (nothing yet)

## [0.1.1] - 2026-06-10

### Added
- Comprehensive project documentation (README, ARCHITECTURE, CONTRIBUTING)
- GitHub CI and release workflows with semver versioning
- `.env.example` for development setup

### Changed
- Router client and live speed polling refinements
- Dashboard layout and speed card UI polish
- Electron preload and TypeScript build configuration updates

### Fixed
- Select component and global styling tweaks

### Removed
- Unused UI components, dependencies, and redundant investigation scripts
- Orphaned quota API route (no UI consumer yet)

## [0.1.0] - 2026-06-07

### Added
- Dialog 4G router control dashboard (web + Electron desktop app)
- Router login, status, reboot, and live speed monitoring
- Connected devices, MAC filtering, and usage history
- Data purchase plans with FIFO consumption tracking
- Windows NSIS installer via electron-builder

[Unreleased]: https://github.com/Geek-Cheth/Router-Control/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Geek-Cheth/Router-Control/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Geek-Cheth/Router-Control/releases/tag/v0.1.0
