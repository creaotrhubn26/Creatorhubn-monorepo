---
name: migration-engine
description: Turn verified version/API/compatibility changes into a staged, testable, reversible migration plan linked to affected repository files, symbols, configuration, data, permissions, infrastructure, rollout gates, and rollback conditions.
---

# Migration Engine

## Mission

Translate a verified technical change into an executable migration strategy.

This skill should answer:

- What exactly must change?
- In what order?
- Which files and systems are affected?
- Which migrations are reversible?
- What must be tested before rollout?
- What is the safe rollback boundary?
- Can the migration be split into preparatory and cutover phases?

## Inputs

Prefer:

- project baseline from `repo-intelligence`
- impact report from `impact-engine`
- compatibility result from `compatibility-solver`
- API validation results
- official migration guides/release notes
- deployment topology
- tests and CI configuration

## Migration Domains

Handle changes across:

- source code
- API calls
- dependency versions
- runtime versions
- host application versions
- plugin manifests
- permissions/scopes/entitlements
- authentication
- configuration
- environment variables
- schemas/data
- storage formats
- infrastructure
- CI/CD
- signing/notarization
- build tooling
- deployment targets
- firmware
- operational procedures

## Migration Strategy Types

### In-Place
Change existing implementation directly.

### Compatibility Bridge
Support old and new versions simultaneously for a period.

### Feature Flag
Introduce new behavior behind a controlled switch.

### Adapter Layer
Abstract old/new APIs behind a stable internal interface.

### Parallel Run
Operate old and new paths and compare outcomes.

### Staged Upgrade
Move through mandatory intermediate versions.

### Blue/Green
Run separate old/new deployments.

### Data Backfill
Migrate existing persisted data separately from code cutover.

Select the strategy based on technical constraints, not preference alone.

## Plan Structure

Every non-trivial migration should contain phases.

### Phase 0 — Preconditions

- evidence verified
- backups/snapshots available
- required versions acquired
- test environment ready
- observability ready
- rollback feasibility confirmed

### Phase 1 — Compatibility Preparation

Examples:

- remove deprecated usage
- add adapter
- expand schema compatibly
- update tests
- add feature flags
- pin dependencies

### Phase 2 — Upgrade / Cutover

- change versions
- change runtime/host
- activate new API
- run data migration
- rotate auth/permissions if required

### Phase 3 — Validation

- smoke tests
- integration tests
- critical workflow tests
- data integrity checks
- performance checks
- log/error checks

### Phase 4 — Cleanup

- remove compatibility code
- remove obsolete config
- remove workaround
- update documentation/baseline
- close migration flags

## File-Level Plan

When repository context exists, produce explicit targets:

```text
src/photoshop/export.ts
  - replace deprecated API X with Y
  - update error handling for new return type

tests/photoshop/export.test.ts
  - add coverage for modal execution requirement

plugin/manifest.json
  - raise manifest version
  - add permission Z
```

Do not generate file changes unsupported by the impact/API evidence.

## Data Migration Safety

For persisted data/schema migrations capture:

- forward transformation
- backward compatibility window
- irreversible steps
- backup requirement
- validation query/check
- rollback path
- data loss risk

Flag irreversible migrations prominently.

## Rollback Model

Classify rollback:

### Easy
Version/config rollback is sufficient.

### Conditional
Rollback works before a certain schema/data/firmware step.

### Hard
Requires data restore, manual remediation, or vendor procedure.

### Impossible / Unsupported
Vendor does not support downgrade or transformation is irreversible.

Never say "rollback available" without defining the boundary.

## Test Gates

Tests should map to affected functionality.

Required categories as applicable:

- unit
- integration
- contract
- end-to-end
- host/plugin integration
- auth/permission
- migration/data validation
- performance
- security regression
- platform matrix
- manual production workflow

Use P0/P1 critical paths from repo intelligence to prioritize gates.

## Stop Conditions

Define conditions that block rollout:

- API validation failure
- compatibility UNKNOWN on a P0 path
- migration script mismatch
- critical test failure
- unsupported OS/runtime combination
- data integrity variance
- unacceptable performance regression
- vendor-documented known issue affecting core flow

## Migration Confidence

Rate:

- Ready
- Ready with validation gates
- Blocked
- Insufficient evidence

This is separate from impact severity.

## Output

# Migration Plan

### From / To
Versions and stack.

### Strategy
Chosen migration type and rationale.

### Preconditions
What must be true first.

### Changes
File/config/data/infrastructure targets.

### Ordered Phases
Execution sequence.

### Test Gates
Must-pass validation.

### Rollback
Method and boundary.

### Stop Conditions
Explicit blockers.

### Post-Migration
Update baseline, monitoring, and decision ledger.

## Escalation

Use:

- `api-validator` before migrating uncertain symbols
- `compatibility-solver` before selecting target stack
- `impact-engine` when blast radius is incomplete
- `evidence-graph` to preserve rationale and traceability

## Never Do

- Do not generate a migration plan from generic release notes alone when repo context is available.
- Do not hide irreversible steps.
- Do not recommend direct upgrades that violate vendor-supported paths.
- Do not treat a successful build as sufficient migration validation.
