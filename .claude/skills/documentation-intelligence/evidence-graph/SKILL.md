---
name: evidence-graph
description: Maintain a traceable knowledge and evidence graph linking products, versions, documentation, releases, APIs, repository usages, features, compatibility constraints, decisions, migrations, incidents, and confidence so every important technical conclusion can be audited and revisited.
---

# Evidence Graph

## Mission

Create durable technical traceability across research and implementation decisions.

The graph should make it possible to answer:

- Why do we believe this API is supported?
- Which source proves that?
- Which project feature uses it?
- Which release changed it?
- Which files are affected?
- Which compatibility constraint blocks the upgrade?
- Why did we choose version X instead of Y?
- Is this conclusion still valid after a new release?

The graph is not a generic vector database. It stores explicit relationships and provenance.

## Core Node Types

### Product
Vendor product/platform/device.

### Component
Project dependency/runtime/plugin/service.

### Version
Version or release identity.

### Documentation
Manual, API reference, release note, migration guide, advisory, standard.

### Evidence
A specific supported claim from a source.

### API Symbol
Method, endpoint, command, manifest key, event, schema field.

### Requirement
Compatibility or environment constraint.

### Repository File
Source/config/test file.

### Code Symbol
Function/class/module/local abstraction.

### Feature
User or system capability.

### Workflow
Operational/user flow.

### Environment
OS, architecture, runtime, host, deployment.

### Issue
Known bug, advisory, incident, tracked defect.

### Decision
Technical choice and rationale.

### Migration
Planned/completed technical transition.

### Test
Validation artifact/gate.

## Relationship Types

Use explicit typed edges such as:

```text
PRODUCT HAS_VERSION VERSION
VERSION DOCUMENTED_BY DOCUMENTATION
DOCUMENTATION SUPPORTS_CLAIM EVIDENCE
EVIDENCE VALIDATES API_SYMBOL
VERSION INTRODUCES API_SYMBOL
VERSION DEPRECATES API_SYMBOL
VERSION REMOVES API_SYMBOL
API_SYMBOL REQUIRES REQUIREMENT
CODE_SYMBOL CALLS API_SYMBOL
REPOSITORY_FILE DEFINES CODE_SYMBOL
FEATURE DEPENDS_ON CODE_SYMBOL
WORKFLOW USES FEATURE
COMPONENT REQUIRES COMPONENT
VERSION COMPATIBLE_WITH VERSION
VERSION INCOMPATIBLE_WITH VERSION
ISSUE AFFECTS VERSION
VERSION FIXES ISSUE
DECISION BASED_ON EVIDENCE
MIGRATION IMPLEMENTS DECISION
TEST VALIDATES FEATURE
```

Edges should carry provenance where useful.

## Evidence Node

Every evidence node should include:

- claim
- source identifier/URL
- source type
- authority tier
- source date
- applicable version/model/region
- exact section/symbol
- confidence
- extracted meaning
- ingestion timestamp if maintained

## Temporal Validity

Technical evidence can expire.

Represent:

- valid_from
- valid_to when known
- observed_at
- superseded_by
- source_updated_at

Example:

```text
API X supported in SDK 8.2..8.9
API X deprecated in 9.0
API X removed in 10.0
```

Do not overwrite historical truth with current truth.

## Decision Ledger

Store technical decisions as first-class nodes.

A decision should contain:

- question
- selected option
- rejected alternatives
- rationale
- evidence references
- date
- owner if available
- assumptions
- review trigger
- superseded_by

Example review triggers:

- next major release
- EOL announcement
- new API stabilization
- target OS upgrade
- security advisory

## Contradiction Model

When evidence conflicts:

- preserve both evidence nodes
- create `CONTRADICTS` relationship
- identify scope difference if known
- lower conclusion confidence until resolved

Never delete inconvenient evidence.

## Claim Resolution

A claim can have status:

- VERIFIED
- STRONG_EVIDENCE
- PROBABLE
- UNVERIFIED
- CONTRADICTED
- SUPERSEDED

Resolution should consider:

- authority tier
- exact-version match
- exact-model match
- recency within same scope
- number of independent sources
- contradiction presence

Do not use majority vote across low-quality sources to override one exact first-party source.

## Graph Queries

Support conceptual queries like:

### What breaks if API X is removed?

```text
API X
 <- CALLS - code symbols
 <- DEFINES - files
 <- DEPENDS_ON - features
 <- USES - workflows
```

### Why are we pinned to version 4.2?

```text
Decision: pin 4.2
 -> BASED_ON evidence
 -> blocked compatibility requirement
 -> affected feature
```

### Which conclusions need revalidation after version 5.0?

Find claims/decisions whose review trigger or version validity intersects 5.0.

## Staleness Detection

Mark nodes/claims stale when:

- project baseline version changes
- vendor source is superseded
- source URL/document revision changes materially
- product enters EOL
- API lifecycle state changes
- target OS/runtime changes

Stale does not mean false. It means revalidation is required.

## Output

For human-facing responses, do not dump raw graph data by default.

Return:

### Conclusion
Technical answer.

### Trace
Concise path from source → evidence → project usage → impact/decision.

### Confidence
Current claim status.

### Staleness
Whether revalidation is required.

### Conflicts
Any unresolved contradictory evidence.

## Machine Contract

Use `../schemas/evidence-graph.schema.json` for graph serialization.

## Never Do

- Do not store source-less claims as verified evidence.
- Do not overwrite historical states.
- Do not merge similar product/version nodes without proof they are equivalent.
- Do not hide contradictory evidence.
- Do not treat embeddings similarity as a provenance relationship.
