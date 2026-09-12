---
name: version-intelligence
description: Analyze release notes, changelogs, firmware histories, breaking changes, migrations, compatibility, lifecycle, known issues, bug-fix versions, and feature introduction/removal timelines.
---

# Version Intelligence

## Mission

Turn release history into actionable engineering intelligence.

Use this skill for:

- release notes
- changelogs
- version comparisons
- feature introduction dates
- feature removal/deprecation
- bug-fix version tracing
- migration planning
- breaking changes
- known issues
- compatibility matrices
- firmware histories
- product lifecycle and EOL
- upgrade risk analysis
- documentation diffs between versions

Follow `../shared/SOURCE_POLICY.md`.

## Version Resolution

Identify separately:

- product version
- API version
- SDK version
- firmware version
- protocol/schema version
- runtime version
- dependency/package version
- plugin version
- OS version

A change in one does not imply a change in the others.

## Release Timeline Workflow

1. Determine current version.
2. Determine target version or comparison range.
3. Gather first-party release notes for every relevant intermediate release.
4. Gather migration guides.
5. Gather known issues.
6. Gather compatibility/system requirement changes.
7. Trace referenced PRs/issues only when release notes are insufficient.
8. Build a chronological change set.
9. Map changes to project impact.

## Version Comparison Categories

Classify each material change as:

### Added
New capability.

### Changed
Existing behavior changed.

### Fixed
Bug or defect resolved.

### Deprecated
Still available but scheduled or advised for replacement.

### Removed
No longer available.

### Security
Security-sensitive change or fix.

### Compatibility
Change in supported OS, hardware, architecture, dependency, protocol, browser, GPU, driver, firmware, or host application.

### Known Issue
Officially acknowledged defect or limitation.

### Documentation-only
Documentation changed without an explicitly documented product change.

## Breaking Change Severity

### Critical
Expected to stop the application/workflow or corrupt/invalidate required behavior without intervention.

### High
Major integration or workflow failure likely.

### Medium
Code/configuration/workflow modification required but localized.

### Low
Minor behavioral, UI, performance, or workflow impact.

For each breaking change include:

- affected versions
- affected component
- trigger
- expected failure
- migration action
- test required
- rollback consideration

## Upgrade Risk Score

Assess:

- number of major-version boundaries
- removed APIs
- changed defaults
- database/schema migration
- auth/permission changes
- plugin incompatibilities
- runtime changes
- hardware/OS requirements
- irreversible data migrations
- security urgency
- vendor-supported upgrade path

Return:

- Low
- Medium
- High
- Critical

Explain the drivers.

## Migration Plan

When an upgrade is requested, produce:

1. current version
2. target version
3. supported upgrade path
4. mandatory intermediate versions
5. prerequisites
6. dependency upgrades
7. API migrations
8. configuration changes
9. auth/permission changes
10. data/schema migration
11. plugin/extension checks
12. test plan
13. rollout plan
14. rollback plan
15. post-upgrade verification

Never recommend skipping vendor-required intermediate versions.

## Feature Introduction

To answer "when was X added?":

1. search current docs
2. search release notes backwards
3. inspect prior docs/releases
4. inspect official repository tags/PRs if needed

Use wording:

- **Introduced in:** only when proven
- **Earliest verified version:** when earlier absence cannot be conclusively established

## Feature Removal

Determine:

- last verified version containing feature
- first verified version where absent/removed
- replacement feature/API
- migration path
- removal rationale if documented

## Bug-Fix Tracing

For "which version fixed this?":

1. exact error/issue search
2. official known-issues page
3. release notes
4. issue tracker
5. linked PR
6. release tag containing fix

Return:

- affected version range
- fixed version
- issue/PR if authoritative
- workaround
- regression status if known

## Firmware

For firmware research, capture:

- device model/revision
- firmware version
- release date
- changes
- bug fixes
- security fixes
- compatibility
- downgrade availability/restrictions
- required updater/app/OS
- region restrictions

Never assume one firmware branch applies to every hardware revision.

## Compatibility Matrix

Build a matrix when components interact.

Possible axes:

- host app ↔ plugin
- app ↔ SDK
- OS ↔ app
- firmware ↔ hardware revision
- runtime ↔ framework
- GPU ↔ driver ↔ application
- API ↔ auth scheme
- browser ↔ feature
- database ↔ server version

Use explicit statuses:

- Supported
- Supported with conditions
- Partial
- Experimental
- Unsupported
- Unknown

## Lifecycle

Identify:

- active development
- maintained
- maintenance-only
- deprecated
- legacy
- end of sale
- end of support
- end of life

Capture dates and migration recommendation when official.

## Documentation Diff

When release notes are incomplete, compare versioned documentation.

Look for:

- new sections
- removed sections
- signature changes
- parameter requirement changes
- warning additions
- changed default values
- changed examples
- renamed terminology

Mark these as documentation-diff findings unless the product behavior is separately confirmed.

## Project Impact Mapping

For every important change ask:

- Does the project use this feature/API?
- Is the affected dependency installed?
- Is the target OS/hardware affected?
- Is this path exercised in production?
- Does the change affect build, runtime, deployment, data, security, or UX?
- Is remediation mandatory now or only before a future upgrade?

Prioritize project-relevant changes over exhaustive release-note repetition.

## Output

# Version Intelligence

### Current
Version/environment.

### Target or Comparison
Version/range.

### Executive Conclusion
Upgrade/release impact in plain technical language.

### Material Changes
Only changes that matter to the request/project.

### Breaking Changes
Severity + remediation.

### Compatibility
Matrix or concise findings.

### Known Issues
Relevant official issues.

### Migration
Required steps.

### Risk
Low / Medium / High / Critical.

### Confidence
Per major finding.

## Escalation

Route to `../api-validator/SKILL.md` when a specific API symbol must be checked.

Route to `../docs-search/SKILL.md` when authoritative historical/manual material still needs discovery.

Route to `../release-monitor/SKILL.md` only when the user wants recurring future tracking.
