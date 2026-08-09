---
name: documentation-intelligence
description: Technical intelligence operating layer for authoritative documentation research, repository-aware version/API validation, compatibility solving, project impact analysis, migration planning, evidence traceability, and low-noise release monitoring. ALSO use for open improvement questions about products with external integrations ("what could make Post Agent better?", "what do new Resolve/Xcode releases enable?") — route them through docs/impact-reports/ product opportunities and the evidence graph, not from memory.
---

# Documentation Intelligence v2

## Overview

Use this skill as the umbrella entrypoint for technical intelligence work involving external products, SDKs, APIs, releases, manuals, firmware, dependencies, compatibility, upgrades, or project-specific change impact.

The system has two layers.

## Layer 1 — Research Intelligence

These skills establish external technical truth.

- `docs-search/SKILL.md` — find exact authoritative manuals, documentation, API/SDK references, support material, standards, and archives
- `version-intelligence/SKILL.md` — reconstruct releases, changelogs, migrations, lifecycle, bug fixes, breaking changes, and version history
- `api-validator/SKILL.md` — verify exact APIs, signatures, permissions, lifecycle, semantics, and version availability
- `release-monitor/SKILL.md` — define low-noise recurring watches for relevant releases, security advisories, deprecations, fixes, firmware, and EOL events

## Layer 2 — Operational Intelligence

These skills connect external truth to the actual project.

- `repo-intelligence/SKILL.md` — map repository dependencies, versions, external API usage, features, critical paths, tests, and risk surfaces
- `compatibility-solver/SKILL.md` — solve multi-component support constraints instead of guessing whether a stack works
- `impact-engine/SKILL.md` — determine exactly what an external change affects in the repository, workflows, environments, and users
- `migration-engine/SKILL.md` — convert verified change into a staged, testable, reversible migration plan
- `evidence-graph/SKILL.md` — preserve source → claim → API/version → code → feature → decision traceability over time

All skills follow:

- `shared/SOURCE_POLICY.md`
- `shared/CONTRACTS.md`

Recommended production guardrails:

- `policies/API_EMISSION_GUARD.md`
- `policies/PR_GUARDIAN.md`

## Core Principle

The system must not stop at:

> What does the documentation say?

It should continue to:

> Is it true for this exact version and environment?

and, when a project exists:

> Where do we use it, what can break, what should change, how do we test it, and what evidence justifies that decision?

## Default Reasoning Pipeline

For repository-aware technical change questions, prefer:

```text
Repository Intelligence
        ↓
External Research
(docs / releases / API)
        ↓
Compatibility Solver
        ↓
Impact Engine
        ↓
Migration Engine
        ↓
Evidence Graph
```

Not every task needs every stage. Route to the smallest sufficient path.

## Routing

### Find documentation/manuals

Route:

`docs-search`

Add `version-intelligence` when revision/version applicability must be established.

### Ask what changed in a release

Without project context:

`version-intelligence`

With project/repository context:

`repo-intelligence → version-intelligence → impact-engine`

### Validate an API or AI-generated code

Without repository:

`api-validator`

With repository:

`repo-intelligence → api-validator`

If target stack/version is changing:

`repo-intelligence → api-validator → compatibility-solver → impact-engine`

### Decide whether an upgrade is safe

Route:

`repo-intelligence → version-intelligence → api-validator as needed → compatibility-solver → impact-engine`

If changes are required:

`→ migration-engine`

### Migrate to a new SDK/runtime/product version

Route:

`repo-intelligence → version-intelligence → compatibility-solver → api-validator → impact-engine → migration-engine → evidence-graph`

### Diagnose a version-specific bug

Route:

`repo-intelligence if available → version-intelligence → api-validator if symbol-related → impact-engine`

### Monitor future releases

First build/resolve baseline:

`repo-intelligence` when a repository exists.

Then:

`release-monitor`

When a future change is detected, route it through:

`version-intelligence → impact-engine → api-validator/compatibility-solver as needed`

Notify only if project-relevant.

## Project Context Resolution

When project artifacts are available, derive rather than ask for:

- resolved dependency versions
- SDK versions
- runtime versions
- host app assumptions
- API symbols actually used
- manifests and permissions
- OS/architecture targets
- critical integrations
- feature-to-code mapping
- tests covering external integrations

Use `repo-intelligence` to produce the baseline.

## External Context Resolution

Resolve separately:

- vendor
- product
- model/revision
- software version
- firmware version
- API version
- SDK version
- host version
- edition/SKU
- region
- OS
- architecture
- runtime
- channel: GA/stable/beta/preview

Never collapse these into one generic version field when the distinction matters.

## Evidence Discipline

Every load-bearing external technical claim should have traceable evidence.

Examples:

- API availability
- signature
- introduction/deprecation/removal version
- system requirement
- compatibility constraint
- known issue
- bug fix version
- security advisory scope
- lifecycle/EOL status
- firmware compatibility

Confidence values:

- Verified
- Strong evidence
- Probable
- Unverified
- Contradicted

Downstream skills may not silently raise confidence above upstream evidence.

## Evidence Graph Rule

For decisions with lasting engineering consequences, create traceability such as:

```text
Official Release Note
   ↓ supports
Evidence: API X removed in v10
   ↓ describes
API X
   ↑ called by
src/export.ts::exportDocument
   ↑ enables
Feature: PSD export
   ↓ affected by
Migration 2026-08
   ↓ based on
Decision: stay on v9 until adapter is complete
```

This enables later questions such as:

- Why are we pinned to this version?
- Which decisions become stale after this release?
- What breaks if this API disappears?

## Impact-First Output

When a repository exists, lead with project relevance rather than vendor changelog volume.

Preferred:

> 186 changes reviewed. 5 intersect the project: 1 High, 3 Medium, 1 Low. One API used in the render pipeline is deprecated; no confirmed removal in the target release.

Avoid reproducing dozens of irrelevant release-note bullets.

## Upgrade Decision Gate

Use:

- **GO** — compatible and acceptable risk
- **GO_WITH_TESTS** — no blocker, defined validation required
- **HOLD** — migration work or high-risk uncertainty remains
- **NO_GO** — confirmed blocker/incompatibility

Every HOLD/NO_GO should identify the blocking evidence.

## Hallucination Guard

Never invent:

- API symbols
- endpoints
- commands
- flags
- config keys
- manifest permissions
- version numbers
- release dates
- manual links
- migration requirements
- compatibility claims

For production-bound generated code, follow `policies/API_EMISSION_GUARD.md`.

## PR Guardian

For newly introduced external interfaces in a pull request, follow `policies/PR_GUARDIAN.md`.

The ideal behavior is:

```text
PR adds unfamiliar external API
  ↓
repo-intelligence detects usage
  ↓
api-validator verifies symbol/version
  ↓
compatibility-solver checks targets
  ↓
impact-engine checks critical paths
  ↓
merge allowed / warned / blocked with evidence
```

## Temporal Intelligence

Preserve historical states.

Do not overwrite:

- API supported in v8

with:

- API removed in v10

Instead represent lifecycle over time.

This allows questions like:

> Would this implementation have been valid in March 2025?

## Documentation Drift

A vendor may alter documentation without shipping a release.

When a meaningful source changes:

1. identify the changed claim
2. determine whether product behavior is independently confirmed
3. compare against existing evidence graph
4. mark stale/contradicted decisions
5. route project-relevant changes through `impact-engine`

## Minimal Sufficient Routing

Do not over-orchestrate.

Examples:

- “Find the manual” → docs-search only
- “Is `batchPlay` real?” → api-validator only if version context is supplied
- “Will Resolve 20.3 break our Post Agent?” → repo-intelligence + version-intelligence + impact-engine, with api-validator only for changed symbols

## Output Modes

### Research Answer
For isolated documentation questions.

### Project Impact Report
For release/API/compatibility changes affecting a repository.

### Compatibility Verdict
For concrete stack constraints.

### Migration Plan
For implementation changes.

### Monitoring Specification
For recurring release intelligence.

### Evidence Trace
For auditability or “why did we decide this?” questions.

## Schemas

Available contracts:

- `schemas/evidence-record.json`
- `schemas/project-intelligence.schema.json`
- `schemas/impact-report.schema.json`
- `schemas/evidence-graph.schema.json`

## Interaction Rule (interactive sessions)

Before producing analysis for an open question ("what could be improved",
"what does release X mean for us"), ALWAYS ask 1–3 short focus questions
first: which system (Post Agent / iPad apps / Role Room / Leadgrid /
CreatorHub platform / Reknaren / Pondus), which vendor surface, and
risk-focus vs. opportunity-focus. Depth on the chosen focus beats breadth
across everything. Skip this only when the user already specified the focus,
or in autonomous cron/cloud runs (they follow their own prompt).

## Output Contract (token discipline)

Be token-efficient. No filler, no generic advice, no changelog dumps.

Every improvement proposal MUST have exactly these parts, compactly:
1. **What**: the new vendor function/API (with source)
2. **Where**: system + file pointer it improves
3. **Why/benefit**: one sentence — what the user concretely gets
4. **Size**: rough estimate (hours/days)

A proposal missing any part is noise — drop it. Analysis output follows
Impact-First (above): lead with the verdict and the N project-relevant items;
never reproduce vendor release notes wholesale.

## Runtime Notes (Claude Code)

- Only this umbrella file is auto-registered as a skill. Child skills are NOT
  discovered separately — load them with Read on the paths above
  (e.g. `api-validator/SKILL.md`) when routing selects them.
- `sources/vendors.yaml` — pinned Tier 1/2 sources + `drift_watch` per vendor.
  Consult it BEFORE open web search.
- `scripts/build-baseline.mjs` and `scripts/grep-symbols.sh` — mechanical layer
  for repo-intelligence (dependency baseline + external-API usage map). Run
  them instead of hand-collecting.
- Evidence persistence: `docs/evidence/` at repo root (convention in its
  README). Seed cases there are calibration data for the Freshness Rule in
  `shared/SOURCE_POLICY.md`.
- `examples/eval.md` — smoke eval; run after editing this pack.

## Final Objective

Documentation Intelligence v2 should behave less like a search skill and more like a technical intelligence control plane for AI engineering agents.

Its job is to make external technical facts:

**authoritative → version-aware → project-aware → impact-aware → actionable → testable → traceable.**
