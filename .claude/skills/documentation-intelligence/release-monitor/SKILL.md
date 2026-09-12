---
name: release-monitor
description: Build project-aware recurring monitoring specifications for software releases, API changes, deprecations, security advisories, firmware updates, compatibility changes, EOL notices, and dependency changes while minimizing irrelevant alerts.
---

# Release Monitor

## Mission

Turn a known technical baseline into a precise recurring monitoring specification.

This skill does not merely say "watch for updates." It defines exactly:

- what to monitor
- which authoritative sources matter
- which versions/components are relevant
- which events should trigger an alert
- which events should be ignored
- what impact analysis should be performed before notifying

Follow `../shared/SOURCE_POLICY.md`.

## Use When

The user wants recurring tracking for:

- new stable releases
- security advisories
- critical bug fixes
- API/SDK changes
- deprecations
- removals
- breaking changes
- firmware releases
- compatibility changes
- driver/runtime changes
- EOL/EOS announcements
- migration deadlines
- plugin host compatibility
- dependency updates

## Required Baseline

Build the smallest useful baseline:

```yaml
project: Example
components:
  - vendor: Adobe
    product: Photoshop
    current: "26.x"
    watch:
      - stable releases
      - UXP compatibility
      - deprecations
  - vendor: Blackmagic Design
    product: DaVinci Resolve
    current: "20.x"
    watch:
      - stable releases
      - scripting API
      - known issues
```

Avoid broad vendor-wide monitoring when the project uses only one product.

## Monitor Categories

### RELEASE
New stable version.

### PATCH
Bug-fix or patch release.

### SECURITY
Advisory/CVE/mitigation relevant to installed versions.

### BREAKING_CHANGE
Change likely to require code/config/workflow modification.

### DEPRECATION
Currently used capability scheduled for replacement/removal.

### REMOVAL
Capability removed from a release.

### API_CHANGE
Relevant API/SDK behavior or signature change.

### COMPATIBILITY
OS/hardware/runtime/driver/plugin support changed.

### FIRMWARE
Relevant device firmware update.

### KNOWN_ISSUE
New vendor-confirmed issue affecting current/target version.

### FIX
Vendor ships fix for tracked issue.

### EOL
End-of-support/end-of-life announcement or deadline.

### DOC_CHANGE
Material documentation change affecting behavior/requirements.

## Alert Relevance Filter

Notify only if one or more applies:

- affects an installed/current version
- affects a planned target version
- affects a dependency/API used by the project
- fixes a tracked blocking issue
- introduces a required migration
- creates a security action
- changes compatibility with current OS/hardware/host app
- reaches an EOL deadline
- changes licensing/access required for a used capability

Do not alert merely because the vendor published unrelated news.

## Severity

### Critical
Immediate action likely required; security exploit, hard EOL, data risk, or production-breaking change.

### High
Upgrade/migration/compatibility action should be planned promptly.

### Medium
Relevant change with manageable impact.

### Low
Informational; no immediate action.

## Stable vs Preview

Track channels separately:

- Stable / GA
- Beta
- Preview
- Nightly
- RC

Default alerting should prioritize Stable/GA.

Preview should only trigger when:

- project explicitly depends on preview
- preview contains a requested future feature
- the user asked to monitor prereleases

Never report a prerelease as generally available.

## Monitoring Source Set

Per component, define preferred sources:

1. official release notes
2. official security advisory
3. official changelog
4. official developer/API change log
5. official support known-issues page
6. official lifecycle page
7. official repository releases/tags when applicable
8. official firmware page for devices

Store exact source targets when possible.

## Change Processing

For each detected update:

1. confirm publication/release date
2. confirm channel
3. confirm affected versions
4. compare to baseline
5. identify project-used features/APIs
6. classify change
7. assign severity
8. identify required action
9. suppress if irrelevant
10. notify with concise evidence

## Notification Format

### [Severity] Product Version/Event

**What changed**
One concise paragraph.

**Why it matters**
Specific project impact.

**Affected baseline**
Exact component/version.

**Action**
Upgrade / test / migrate / patch / ignore / investigate.

**Deadline**
If official.

**Confidence**
Verified / Strong evidence / Probable.

## Deduplication

Do not repeatedly alert for the same release/advisory unless:

- severity changes
- vendor updates the advisory
- a fix becomes available
- impact assessment changes
- the project baseline changes

Track a stable identifier when possible:

- release version
- advisory ID
- CVE
- issue ID
- firmware version
- lifecycle notice ID/date

## Dependency-Aware Monitoring

For code projects, derive watch targets from:

- package.json / lockfiles
- requirements / lockfiles
- go.mod
- Cargo files
- Gradle/Maven
- Docker images
- plugin manifests
- CI config
- SDK declarations
- runtime config

Prioritize direct dependencies and platform-critical transitive dependencies.

Avoid generating a noisy watchlist for every low-risk transitive package unless security monitoring is explicitly desired.

## Project Relevance Rules

A release can be relevant even when the main product is not upgraded if it changes:

- API quotas
- authentication
- cloud service behavior
- server-side schema
- webhook behavior
- certificates/signing
- minimum client version
- service EOL
- firmware compatibility

## Monitoring Specification Output

When the user asks to set up monitoring, return or configure:

```yaml
monitor:
  project: Example
  cadence: daily
  sources:
    - official release notes
    - official security advisories
  components:
    - name: Product A
      current: "4.2"
      channels: [stable]
      events:
        - security
        - breaking_change
        - deprecation
        - fix
  notify_when:
    - affects_current_version
    - affects_used_api
    - requires_action
  suppress:
    - unrelated_vendor_news
    - preview_without_relevance
```

Cadence should be proportional to risk:

- critical security/service dependency: hourly/daily
- active developer platforms: daily/weekly
- firmware/manual/lifecycle: weekly/monthly

Do not invent a high-frequency cadence when there is no meaningful benefit.

## Baseline Update

When the project upgrades, update the baseline before continuing monitoring.

Otherwise the system will continue alerting against obsolete versions.

## Escalation

Use `../version-intelligence/SKILL.md` to analyze a detected release.

Use `../api-validator/SKILL.md` when a detected release changes a symbol the project uses.

Use `../docs-search/SKILL.md` when a new manual/reference or archived source must be located.

# V2 Project-Aware Processing

When a project baseline is available, a detected event should not be sent directly to the user merely because it is new.

Process it through:

1. `../version-intelligence/SKILL.md` — normalize and verify the change.
2. `../impact-engine/SKILL.md` — intersect it with project dependencies, API usage, features, and environments.
3. `../api-validator/SKILL.md` — validate changed symbols when relevant.
4. `../compatibility-solver/SKILL.md` — solve changed support constraints when relevant.
5. `../evidence-graph/SKILL.md` — update evidence/decision state for material changes.

Default notification rule:

> New is not enough. Notify when new AND project-relevant, security-relevant, deadline-relevant, or explicitly watched.
