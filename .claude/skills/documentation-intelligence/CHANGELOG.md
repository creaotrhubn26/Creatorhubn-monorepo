# Changelog

## v2

### Added operational intelligence layer

- Repository Intelligence
- Compatibility Solver
- Impact Engine
- Migration Engine
- Evidence Graph

### Added production guardrails

- External API Emission Guard
- PR Guardian policy

### Added machine contracts

- Project Intelligence schema
- Impact Report schema
- Evidence Graph schema
- Cross-skill contracts

### Changed

- Umbrella router now routes project-aware questions through repository, compatibility, impact, and migration analysis.
- Release Monitor now filters detected events through project impact before notification.
- Architecture now separates external research truth from project/action reasoning.
