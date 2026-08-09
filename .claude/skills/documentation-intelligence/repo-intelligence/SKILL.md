---
name: repo-intelligence
description: Build a project-aware technical baseline from a repository by identifying external dependencies, SDKs, host integrations, runtime targets, exact versions, API usage, manifests, feature boundaries, critical paths, and ownership links for downstream documentation intelligence.
---

# Repository Intelligence

## Mission

Convert a codebase into a structured technical baseline that Documentation Intelligence can reason about.

This skill answers questions such as:

- Which external SDKs and APIs does this repository actually use?
- Which versions are installed versus merely declared?
- Which files and features depend on each vendor API?
- Which integrations are production-critical?
- Which runtime, OS, architecture, host application, plugin manifest, protocol, or firmware constraints exist?
- Which APIs should be validated before code is changed?
- Which dependency changes would have the largest blast radius?

This skill does not primarily research vendor documentation. It extracts the project's side of the truth so the other skills can compare that truth against authoritative external evidence.

Follow `../shared/SOURCE_POLICY.md` for any external claims.

## Inputs

Use whichever project artifacts are available:

- source repository
- package manifests and lockfiles
- plugin manifests
- build files
- CI/CD configuration
- Dockerfiles and container manifests
- infrastructure configuration
- SDK declarations
- generated type definitions
- environment templates
- feature flags
- runtime configuration
- deployment targets
- existing project baseline

## Core Outputs

Produce five linked inventories:

1. **Component Inventory**
2. **Version Baseline**
3. **External API Usage Map**
4. **Feature / Critical Path Map**
5. **Risk Surface Map**

## Component Inventory

Identify components such as:

- host applications
- SDKs
- public APIs
- cloud services
- runtimes
- frameworks
- libraries
- databases
- protocols
- plugins/extensions
- drivers
- native bindings
- CLI tools
- firmware-dependent devices
- operating systems
- CPU/GPU architectures

For every component record:

- canonical name
- vendor/project
- declared version
- resolved version
- source of version evidence
- direct/transitive relationship
- role in project
- production/dev/test scope
- update channel if known

Do not assume a declared range equals the installed version when a lockfile provides a resolved version.

## Version Evidence Priority

Prefer:

1. lockfiles/resolved build metadata
2. runtime/application metadata
3. package manifests
4. generated dependency reports
5. explicit project documentation
6. comments or README references

If evidence conflicts, preserve both values and flag the mismatch.

## External API Usage Map

Extract calls to non-local interfaces that can change independently of the repository.

Examples:

- REST/GraphQL endpoints
- SDK methods
- plugin host APIs
- CLI invocations
- subprocess tools
- cloud service APIs
- native library calls
- protocol messages
- database extensions
- manifest keys
- OAuth scopes
- webhook event names

Record:

- symbol/endpoint/command
- provider
- file
- function/class/module
- feature/workflow
- invocation count if useful
- criticality
- tests covering it
- runtime conditions
- permission/scope dependencies

## Symbol Normalization

Normalize equivalent usages where possible.

Example:

```text
batchPlay
photoshop.action.batchPlay
require("photoshop").action.batchPlay
```

may refer to the same API node.

Preserve the original spellings but assign a canonical symbol.

## Feature Mapping

Map code to product capability.

Examples:

```text
Feature: Export Photoshop mockup
  -> src/photoshop/export.ts
  -> photoshop.action.batchPlay
  -> UXP manifest permission
  -> Photoshop host version
```

```text
Feature: Resolve render automation
  -> integrations/resolve/render.py
  -> Project.GetRenderJobList
  -> DaVinci Resolve scripting API
```

This mapping is required for meaningful downstream impact analysis.

## Criticality

Classify project usage:

### P0 — System Critical
Failure blocks core production or causes data/security risk.

### P1 — Major Workflow
Failure breaks a key user workflow or integration.

### P2 — Important
Feature degraded but system remains useful.

### P3 — Peripheral
Low-impact or optional functionality.

### P4 — Development Only
Build/test/tooling only.

Do not infer business criticality solely from invocation count.

## Risk Surface Map

Flag components/usages with elevated change risk:

- undocumented API
- deprecated API
- preview/beta dependency
- unpinned version
- broad semver range
- runtime download of latest
- host-version conditional code
- OS-specific implementation
- native binary dependency
- fragile CLI parsing
- undocumented response field
- weak/no test coverage
- high fan-out dependency
- authentication/permission dependency
- external service without compatibility lock

## Dependency Fan-Out

Estimate blast radius by linking one dependency/API to all project nodes that rely on it.

Suggested metrics:

- files touched
- modules touched
- features touched
- P0/P1 workflows touched
- tests available
- runtime environments touched

Do not treat fan-out as exact risk. It is an input to `impact-engine`.

## Generated Baseline

Produce a baseline compatible with `../schemas/project-intelligence.schema.json`.

Example concept:

```yaml
project: StageOne
components:
  - id: adobe-uxp
    product: UXP
    resolved_version: "8.4"
    role: plugin_sdk

api_usage:
  - provider: Adobe UXP
    symbol: photoshop.action.batchPlay
    files:
      - src/photoshop/export.ts
    features:
      - mockup_export
    criticality: P1
```

## Drift Detection

When a prior baseline exists, compare repository state and report:

- dependency added/removed
- version changed
- API usage added/removed
- criticality changed
- target platform changed
- manifest permission changed
- previously validated symbol newly used in a different context

This is project drift, not vendor release drift.

## Output

### Project Baseline
Resolved components and environments.

### External Interfaces
SDK/API/CLI/protocol usage.

### Critical Paths
Features linked to external dependencies.

### High-Risk Surfaces
Areas deserving documentation validation.

### Baseline Drift
If comparing against prior state.

### Next Routing
Recommend:

- `api-validator` for unfamiliar/high-risk symbols
- `version-intelligence` for upgrade/release questions
- `compatibility-solver` for multi-component support constraints
- `impact-engine` when an external change must be mapped to the repo

## Never Do

- Do not treat every imported package as equally important.
- Do not claim an API is supported merely because code references it.
- Do not assume a package range is the installed version.
- Do not confuse build-time and runtime dependencies.
- Do not send the entire repository to downstream research when a compact usage graph is sufficient.
