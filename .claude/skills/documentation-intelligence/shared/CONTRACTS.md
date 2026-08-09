# Cross-Skill Contracts

These contracts define the conceptual payloads exchanged between Documentation Intelligence skills. A runtime may represent them as JSON, YAML, typed objects, database rows, or tool responses.

## ResearchEvidence

Produced by docs-search, version-intelligence, api-validator.

Required fields:

- claim
- source
- authority_tier
- scope
- confidence

Optional:

- product
- version
- model
- region
- symbol
- section
- published_at
- valid_from
- valid_to
- contradiction_group

## ProjectBaseline

Produced by repo-intelligence.

Contains:

- components
- resolved versions
- environments
- API usage
- feature map
- critical paths
- risk surfaces

## CompatibilityResult

Produced by compatibility-solver.

Contains:

- requested stack
- capability
- verdict
- satisfied constraints
- blocking constraints
- unknown constraints
- alternatives
- evidence references

## ImpactReport

Produced by impact-engine.

Contains:

- event/change
- relevance
- affected project nodes
- severity
- confidence
- blast radius
- recommended actions
- test gates
- evidence references

## MigrationPlan

Produced by migration-engine.

Contains:

- source stack
- target stack
- strategy
- phases
- file/config/data changes
- test gates
- rollback boundary
- stop conditions
- evidence references

## EvidenceGraph

Maintained by evidence-graph.

Contains typed nodes and relationships with provenance and temporal validity.

## Contract Rule

No downstream skill should silently upgrade a confidence level beyond the confidence justified by upstream evidence.

Example:

```text
API evidence: Probable
→ compatibility result cannot claim Verified support based solely on that edge.
```
