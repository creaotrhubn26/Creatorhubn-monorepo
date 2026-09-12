---
name: compatibility-solver
description: Solve multi-component technical compatibility constraints across application, SDK, plugin, runtime, OS, architecture, hardware, driver, firmware, protocol, edition, and permission requirements using authoritative evidence and explicit constraint reasoning.
---

# Compatibility Solver

## Mission

Determine whether a concrete stack configuration is supported, conditionally supported, incompatible, or unknown.

This is a constraint solver, not a generic compatibility table generator.

Examples:

- Photoshop 27 + UXP 9 + plugin manifest v6 + macOS 16 + Apple Silicon
- Resolve 20.2 + Python 3.12 + Fusion scripting + Windows ARM
- CUDA version + GPU driver + framework version
- camera model + hardware revision + firmware + control application
- database server + client driver + ORM + runtime

## Inputs

A compatibility query should define:

- components
- versions
- environment
- desired capability
- optional target upgrade

Example:

```yaml
capability: photoshop_plugin_export
stack:
  photoshop: "27.0"
  uxp: "9.1"
  manifest: "6"
  os: "macOS 16"
  architecture: arm64
```

## Constraint Types

Model constraints as:

### Minimum
`A >= version`

### Maximum
`A <= version`

### Range
`x <= A < y`

### Exact
`A == version`

### Exclusion
`A != version`

### Dependency
`A version x requires B version y+`

### Conditional
`A supported only when B/C condition holds`

### Capability Gate
`Feature F requires edition, permission, hardware, or version`

### Region Gate
`Capability differs by region`

### Architecture Gate
`Feature/library available only on x86_64/arm64/etc.`

### Channel Gate
`Preview feature only in beta/RC`

## Evidence Rule

Every material constraint should have evidence.

Examples:

```text
UXP 9.1 requires Photoshop >= 27
Plugin Manifest v6 requires UXP >= 9
Feature X is unavailable on Windows ARM
```

If one constraint is inferred rather than documented, label it.

## Solving Workflow

1. Normalize component names and version schemes.
2. Resolve current/target versions.
3. Gather exact-version compatibility evidence.
4. Convert evidence into constraints.
5. Evaluate all constraints together.
6. Identify the first blocking constraint(s).
7. Calculate alternate valid configurations when useful.
8. Return unsupported/unknown edges explicitly.

## Status

### SUPPORTED
All required constraints are verified satisfied.

### SUPPORTED_WITH_CONDITIONS
Supported if explicit conditions are met.

### INCOMPATIBLE
At least one verified blocking constraint fails.

### EXPERIMENTAL
Only preview/beta/experimental support exists.

### UNKNOWN
Evidence is insufficient for at least one critical edge.

Do not convert UNKNOWN into SUPPORTED.

## Capability-Specific Compatibility

A stack may be generally supported but not support a specific capability.

Example:

```text
Application launches: supported
Plugin runtime: supported
GPU AI feature: unsupported on current GPU
```

Always solve against the capability the user actually cares about when one is stated.

## Constraint Conflict Explanation

Return human-readable reasoning:

```text
INCOMPATIBLE

Photoshop 27.0 satisfies the host requirement.
UXP 9.1 satisfies the SDK requirement.
Manifest v6 is valid.
However, Plugin Dependency X supports macOS only through version 15.
Therefore the requested macOS 16 stack is blocked by Dependency X.
```

## Alternative Set Generation

When useful, find minimal changes that produce a supported stack.

Examples:

- upgrade plugin X to 4.2
- stay on macOS 15
- use host version 26.4
- switch manifest version
- disable optional capability Y

Prefer the smallest operational change unless the user asks for latest versions.

## Compatibility Matrix

Generate a matrix only after solving the actual constraints.

Statuses:

- Supported
- Conditional
- Incompatible
- Experimental
- Unknown

## Temporal Compatibility

Compatibility can change over time.

Record:

- source date
- release/version scope
- support/EOL date

Do not assume a historically supported combination remains supported today.

## Output

### Query
Requested stack/capability.

### Verdict
SUPPORTED / SUPPORTED_WITH_CONDITIONS / INCOMPATIBLE / EXPERIMENTAL / UNKNOWN.

### Blocking Constraints
If any.

### Satisfied Constraints
Important verified edges.

### Unknowns
Evidence gaps.

### Minimal Valid Alternatives
When useful.

### Project Impact
If a repo baseline exists.

### Confidence
Verified / Strong evidence / Probable / Unverified.

## Escalation

Use:

- `docs-search` to find support matrices/manuals
- `version-intelligence` for historical support changes
- `api-validator` for capability-specific symbol availability
- `migration-engine` when moving to a valid stack requires changes
- `impact-engine` to map the stack change into project code/workflows

## Never Do

- Do not infer compatibility from installation success alone.
- Do not assume latest components are mutually compatible.
- Do not collapse unknown evidence into "probably supported."
- Do not ignore architecture, edition, permissions, or region when material.
