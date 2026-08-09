# Documentation Intelligence v2

A modular technical-intelligence skill pack for AI engineering agents.

V1 found and validated documentation. V2 adds repository awareness, compatibility solving, project impact analysis, migration planning, and an evidence graph so release/documentation changes can be connected directly to code and engineering decisions.

## Architecture

```text
                     DOCUMENTATION INTELLIGENCE v2

                         ┌─────────────────┐
                         │ Umbrella Router │
                         └────────┬────────┘
                                  │
             ┌────────────────────┴────────────────────┐
             │                                         │
       RESEARCH LAYER                         PROJECT / ACTION LAYER
             │                                         │
   ┌─────────┼──────────┬──────────┐        ┌──────────┼───────────┬───────────┬───────────┐
   │         │          │          │        │          │           │           │           │
 Docs     Version      API      Release     Repo    Compat.      Impact     Migration   Evidence
Search   Intelligence Validator  Monitor  Intelligence Solver    Engine      Engine      Graph
   │         │          │          │        │          │           │           │           │
   └─────────┴──────────┴──────────┴────────┴──────────┴───────────┴───────────┴───────────┘
                                  │
                                  ▼
                     Engineering / Coding Agent
```

## Included Skills

### Research Layer

1. `docs-search` — authoritative manuals/docs/API references/archives
2. `version-intelligence` — releases, changelogs, migrations, lifecycle, known issues
3. `api-validator` — exact symbol/signature/version/permission verification
4. `release-monitor` — project-aware recurring monitoring specification

### Operational Intelligence Layer

5. `repo-intelligence` — maps project dependencies, API usage, features, critical paths, tests
6. `compatibility-solver` — evaluates multi-component support constraints
7. `impact-engine` — maps external changes to affected files/features/workflows
8. `migration-engine` — produces staged, testable, reversible migration plans
9. `evidence-graph` — preserves provenance and technical decision history

## Why V2 Is Different

A normal release-notes tool answers:

> Resolve 20.3 contains 142 changes.

V2 should answer:

> 4 of 142 changes intersect this repository. One affects a P1 render workflow in `services/resolve/render.ts`, two fix tracked workarounds, and one requires validation on Windows. Upgrade verdict: GO_WITH_TESTS.

That is the core design goal.

## Directory Structure

```text
documentation-intelligence-v2/
├── SKILL.md
├── README.md
│
├── docs-search/
│   └── SKILL.md
├── version-intelligence/
│   └── SKILL.md
├── api-validator/
│   └── SKILL.md
├── release-monitor/
│   └── SKILL.md
│
├── repo-intelligence/
│   └── SKILL.md
├── compatibility-solver/
│   └── SKILL.md
├── impact-engine/
│   └── SKILL.md
├── migration-engine/
│   └── SKILL.md
├── evidence-graph/
│   └── SKILL.md
│
├── shared/
│   ├── SOURCE_POLICY.md
│   └── CONTRACTS.md
│
├── policies/
│   ├── API_EMISSION_GUARD.md
│   └── PR_GUARDIAN.md
│
├── schemas/
│   ├── evidence-record.json
│   ├── project-intelligence.schema.json
│   ├── impact-report.schema.json
│   └── evidence-graph.schema.json
│
└── examples/
    ├── project-baseline.yaml
    ├── monitor-spec.yaml
    ├── compatibility-query.yaml
    ├── impact-report.yaml
    ├── migration-plan.yaml
    └── agent-flow.md
```

## Core Workflow

### Example: “Will the new SDK release break our plugin?”

```text
repo-intelligence
  ↓
Find installed SDK + APIs actually used
  ↓
version-intelligence
  ↓
Identify relevant release changes
  ↓
api-validator
  ↓
Validate changed symbols
  ↓
compatibility-solver
  ↓
Check host/runtime/OS/architecture constraints
  ↓
impact-engine
  ↓
Map changes to files/features/tests
  ↓
migration-engine (if required)
  ↓
evidence-graph
```

## Production Guardrails

### API Emission Guard

Unknown external API symbols should not be emitted into production-bound code unless validated or already proven in the project/vendor types.

See `policies/API_EMISSION_GUARD.md`.

### PR Guardian

A PR adding a new external interface can be automatically reviewed for:

- hallucinated APIs
- wrong-version APIs
- missing permissions
- incompatible target stack
- undocumented external behavior
- migration requirements

See `policies/PR_GUARDIAN.md`.

## Suggested Agent Architecture

```text
User / Coding Agent
        │
        ▼
Documentation Intelligence Router
        │
        ├── project question? ──→ Repo Intelligence
        │
        ├── docs question? ─────→ Docs Search
        │
        ├── release question? ──→ Version Intelligence
        │
        ├── symbol question? ───→ API Validator
        │
        └── stack question? ────→ Compatibility Solver
                                  │
                                  ▼
                              Impact Engine
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
              Migration Engine            Evidence Graph
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                           Coding / PR Agent
```

## Ideal Future Runtime Features

The skill pack becomes even stronger when the host runtime provides:

- repository search/AST or language-server access
- exact lockfile parsing
- GitHub releases/issues/PR access
- web search over official vendor domains
- PDF/manual parsing with diagrams
- persistent graph/database storage
- scheduler/automation support
- CI/PR integration
- sandbox runtime testing

The skill definitions intentionally separate evidence collection from project reasoning so those capabilities can be swapped without changing the architecture.

## Installation

Copy the complete folder into your skills directory and preserve relative paths.

Register `SKILL.md` as the umbrella entrypoint. Expose child skills if your runtime supports direct routing.

## Recommended First Integration

If integrating with a coding agent, implement these four operations first:

```text
build_project_baseline(repo)
validate_external_symbol(symbol, project_context)
assess_release_impact(release, project_baseline)
solve_stack_compatibility(stack, capability)
```

Then add migration generation and persistent evidence graph storage.

## Design Principle

The system should transform:

```text
Documentation
→ Evidence
→ Version Context
→ Repository Usage
→ Compatibility
→ Impact
→ Migration
→ Decision
```

rather than letting a coding model jump directly from search results to implementation.
