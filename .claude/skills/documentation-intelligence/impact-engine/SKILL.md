---
name: impact-engine
description: Convert external technical changes and evidence into project-specific impact by tracing releases, API changes, advisories, compatibility changes, or documentation drift through the repository baseline to affected files, functions, features, environments, tests, users, and actions.
---

# Impact Engine

## Mission

Answer the question that generic release-note summaries do not:

> What does this change mean for OUR project?

The Impact Engine accepts one or more external changes plus a repository/project baseline and computes a traceable project-specific impact assessment.

It should minimize noise. If 150 vendor release-note items exist and only 3 intersect the project, focus on those 3.

## Inputs

At minimum:

- change/event evidence
- project baseline from `repo-intelligence`

Optional:

- API validation results
- compatibility solver results
- historical decisions
- test coverage
- feature criticality
- deployment environments
- previous impact report

## Change Types

Handle:

- release
- patch
- API addition
- API signature change
- API behavior change
- deprecation
- removal
- security advisory
- known issue
- bug fix
- runtime requirement change
- OS/hardware compatibility change
- authentication/permission change
- protocol/schema change
- pricing/licensing/access change where technically relevant
- firmware update
- documentation drift
- lifecycle/EOL event

## Impact Trace

Trace each change through:

```text
External Change
  -> Product/Version
  -> API/Capability/Requirement
  -> Project Component
  -> Source Usage
  -> Feature/Workflow
  -> Environment
  -> Test Coverage
  -> User/Operational Outcome
```

Never jump directly from release-note wording to code impact without establishing the relationship.

## Intersection Logic

A change is **directly relevant** if it matches:

- a dependency in the baseline
- an API/symbol used in code
- an operating system/runtime target
- a hardware/firmware dependency
- a permission/scope/manifest field used by the project
- a tracked known issue
- a target upgrade version

A change is **indirectly relevant** if it changes a dependency of a dependency, host requirement, auth mechanism, or environment that constrains a direct component.

Otherwise classify it as **non-impacting / informational** unless uncertainty is material.

## Impact Dimensions

Score separately:

### Functional Impact
Will behavior stop, change, or improve?

### Compatibility Impact
Will supported environments change?

### Security Impact
Does exposure or required remediation change?

### Data Impact
Could schema, persistence, serialization, or migration behavior change?

### Operational Impact
Does deployment, signing, authentication, monitoring, or support process change?

### UX Impact
Will the end-user workflow or visible behavior change?

### Development Impact
Will code, tests, build, tooling, or developer workflow change?

## Severity

### Critical
Likely production outage, data/security risk, mandatory urgent action, or hard incompatibility on a core path.

### High
Major user workflow or integration likely fails without planned intervention.

### Medium
Project modification/testing required; impact is bounded.

### Low
Minor or optional effect.

### None
No meaningful intersection found.

Severity must be explained by evidence plus project topology, not by vendor marketing language.

## Confidence

Return a separate confidence value:

- Verified
- Strong evidence
- Probable
- Unverified
- Contradicted

A high-severity but low-confidence finding should trigger validation, not panic.

## Impact Score

When numerical prioritization is useful, compute an internal score using factors such as:

```text
severity_weight
x criticality_weight
x exposure_weight
x change_certainty
x environment_reach
x inverse_test_confidence
```

Do not present a pseudo-precise number unless the factors are exposed and useful.

Recommended primary output remains categorical severity.

## Blast Radius

For each material change list:

- affected files
- affected functions/classes/modules
- affected features
- affected P0/P1 workflows
- affected deployment targets
- related tests
- related permissions/manifests

Distinguish:

- **Confirmed affected**
- **Potentially affected**
- **Not affected**

## Fix Benefit Detection

Not every impact is negative.

For bug fixes or new capabilities identify:

- tracked workaround that can be removed
- code simplification opportunity
- performance opportunity
- reliability improvement
- previously blocked feature now possible
- tests that should be re-enabled

## Noise Suppression

Summarize irrelevant changes rather than enumerating them.

Example:

> 142 release-note items reviewed. 4 intersect the project baseline: 1 High, 2 Medium, 1 Low. 138 have no detected project impact.

This is preferable to reproducing the full changelog.

## Recommended Action Types

Use one or more:

- NO_ACTION
- DOCUMENT_ONLY
- TEST
- INVESTIGATE
- VALIDATE_API
- PIN_VERSION
- UPGRADE
- DELAY_UPGRADE
- MIGRATE
- PATCH
- CHANGE_CONFIG
- CHANGE_PERMISSION
- UPDATE_RUNTIME
- UPDATE_OS_TARGET
- REMOVE_WORKAROUND
- ROLLBACK_READY

## Decision Gate

For upgrade decisions, return one of:

### GO
Evidence indicates the upgrade is compatible with acceptable risk.

### GO_WITH_TESTS
No blocker found, but defined test gates should pass first.

### HOLD
Known incompatibility, unresolved high-risk uncertainty, or migration work remains.

### NO_GO
Confirmed blocker or unacceptable risk.

## Output

# Project Impact Report

### Event
Product/version/change.

### Verdict
GO / GO_WITH_TESTS / HOLD / NO_GO / informational.

### Relevant Changes
Only project-intersecting items.

### Blast Radius
Files, symbols, features, environments.

### Severity + Confidence
Per material finding.

### Required Actions
Prioritized.

### Test Gates
Exact tests/workflows to run.

### Non-Impacting Changes
Count/summarize to demonstrate filtering.

### Evidence Links
Reference evidence graph nodes.

## Escalation

Use:

- `api-validator` when symbol semantics are not verified
- `compatibility-solver` when multiple version constraints interact
- `migration-engine` when code/config/data changes are required
- `evidence-graph` to persist traceability

## Never Do

- Do not infer impact from keyword overlap alone.
- Do not call every major release High risk.
- Do not hide uncertainty behind a severity score.
- Do not enumerate irrelevant release-note noise.
- Do not recommend code changes before validating the underlying API claim.
