# Changelog skeleton

<!-- Reader: someone upgrading who wants to know if it will break. -->

<!-- Order by impact: breaking first, then notable, then minor. -->

<!-- Format follows Keep a Changelog (keepachangelog.com). -->

<!-- Pair with Semantic Versioning (semver.org). -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- WebSocket support for real-time task status updates.

## [2.0.0] - 2025-03-01

### Changed

- **BREAKING:** `createPipeline()` now requires an `options` object
  instead of positional arguments.
- Task retry logic uses exponential backoff (was fixed 1s delay).

### Removed

- **BREAKING:** Drop Node 16 support.

### Fixed

- Race condition when two workers claim the same task.

## [1.3.0] - 2025-01-15

### Added

- `pipeline.pause()` and `pipeline.resume()` methods.

### Fixed

- CSV parser handles quoted newlines correctly.

<!-- Entry guidelines: -->

<!-- - Use Added / Changed / Deprecated / Removed / Fixed / Security. -->

<!-- - Start each entry with the user-visible effect, not the implementation. -->

<!-- - "Fixed race condition when two workers claim the same task" -->

<!--   not "Added mutex lock in TaskQueue._claim()". -->

<!-- - Link to the issue or PR if your project uses a tracker. -->

[1.3.0]: https://github.com/org/project/releases/tag/v1.3.0
[2.0.0]: https://github.com/org/project/compare/v1.3.0...v2.0.0
[unreleased]: https://github.com/org/project/compare/v2.0.0...HEAD
