---
name: api-validator
description: Validate exact APIs, SDK symbols, endpoints, commands, configuration keys, permissions, signatures, stability, version availability, and AI-generated code against authoritative version-matched documentation.
---

# API Validator

## Mission

Prevent implementation errors caused by hallucinated, wrong-version, deprecated, unsupported, or misused APIs.

Validate exact technical symbols such as:

- classes
- methods
- functions
- properties
- events
- hooks
- endpoints
- CLI commands
- flags
- configuration keys
- manifest fields
- scopes
- permissions
- entitlements
- enums
- schema fields
- callbacks
- return types

Follow `../shared/SOURCE_POLICY.md`.

## Golden Rule

A symbol that sounds plausible is not a real API until verified.

Never invent a replacement for an unverified symbol.

## Input Resolution

Identify:

- exact symbol
- vendor/product
- package/module/namespace
- project version
- SDK/API version
- host application version
- runtime
- OS/platform
- language
- edition/licensing tier
- relevant manifest/permission model
- error message if present

Extract versions from code/project files when available before asking the user.

## Exact Symbol Protocol

For each symbol:

1. search the exact symbol in official version-matched API docs
2. search the exact fully-qualified symbol
3. inspect the owning class/module/namespace
4. verify signature
5. verify parameter types/defaults
6. verify return type
7. verify async/sync behavior
8. verify lifecycle/context restrictions
9. verify required permissions/scopes/entitlements
10. verify host/platform restrictions
11. verify version introduced
12. verify deprecation/removal status
13. verify examples if semantics remain ambiguous

If not found:

14. search aliases/renames
15. search release notes
16. search migration guides
17. search official repository/tag
18. check older/newer version docs

Only then classify as unverified/nonexistent.

## Classification

Every reviewed symbol should be classified as one of:

### Supported
Officially documented for the project version/environment.

### Newer-Version Only
Real, but introduced after the project version.

### Older-Version Only
Existed historically but not in the target/current version.

### Deprecated
Documented but discouraged and scheduled or recommended for replacement.

### Removed
Explicitly removed.

### Experimental / Preview
Available with stability caveats.

### Platform-Limited
Exists only on certain OS/hardware/architecture/host contexts.

### Permission-Gated
Requires permission, scope, entitlement, manifest entry, role, or license tier.

### Undocumented
Observed in first-party code/runtime but not part of supported public docs.

### Unverified
Could not confirm from sufficiently authoritative evidence.

### Incorrect
The proposed symbol/signature is contradicted by official documentation.

## Signature Validation

Compare:

- symbol name
- namespace/import
- argument count
- parameter names
- parameter types
- optional/required state
- default values
- callback/promise behavior
- overload selection
- return type
- exceptions/errors
- execution context restrictions

A real method with the wrong signature is still an implementation defect.

## Semantic Validation

Do not stop at existence.

Verify what the API actually does.

Common AI-code errors:

- confusing read and write APIs
- assuming mutation where return is immutable
- treating sync API as async
- calling UI-thread-only API from background context
- using a host object after its lifetime ends
- assuming an API operates on selection when it operates on document
- interpreting IDs as indexes
- assuming a returned handle is persistent
- ignoring transaction/modal requirements

## Permission and Manifest Validation

Check:

- OAuth scopes
- API keys
- application roles
- manifest permissions
- browser permissions
- mobile entitlements
- plugin host permissions
- signed/notarized requirements
- enterprise/admin enablement
- paid-tier requirements

Classify missing authorization separately from missing API support.

## AI-Generated Code Audit

When reviewing AI-generated code, flag:

### HALLUCINATED_API
No authoritative evidence the API exists.

### WRONG_VERSION
API exists but not in project version.

### WRONG_SIGNATURE
API exists but call shape is incorrect.

### DEPRECATED_API
Supported but should migrate.

### REMOVED_API
No longer supported.

### WRONG_NAMESPACE
Symbol exists elsewhere.

### WRONG_RUNTIME
Unavailable in the project's execution environment.

### MISSING_PERMISSION
Requires scope/manifest/entitlement.

### UNSUPPORTED_PLATFORM
Not available on target OS/hardware.

### SEMANTIC_MISUSE
API exists but behavior is misunderstood.

### UNDOCUMENTED_DEPENDENCY
Code relies on behavior not covered by supported public contract.

## Replacement Search

When a symbol is deprecated/removed:

1. find official replacement
2. confirm replacement availability in target version
3. compare semantics
4. identify migration notes
5. identify behavior differences
6. provide a minimal verified adaptation

Do not suggest a "similar-looking" API without evidence.

## Codebase Audit Mode

When a repository is available:

1. inventory external API/SDK symbols in relevant files
2. group by vendor/package
3. read current versions from manifests/lockfiles
4. prioritize critical execution paths
5. validate high-risk symbols
6. produce a findings table

Suggested table:

| Symbol | Project usage | Version | Status | Risk | Required action |
|---|---|---:|---|---|---|

Do not attempt to validate every standard-language/library symbol unless requested.

## Evidence Standard for "Does Not Exist"

Use cautious wording:

- "I could not verify this symbol in the official API reference for version X."
- "The official reference documents Y instead."
- "The symbol appears in version Z, not version X."

Use "does not exist" only when authoritative evidence sufficiently establishes that conclusion.

## Output

### Symbol
Fully qualified if possible.

### Verdict
Supported / Newer-Version Only / Deprecated / Removed / Experimental / Platform-Limited / Permission-Gated / Undocumented / Unverified / Incorrect.

### Project Version
Current exact or best-known version.

### Verified Signature
If applicable.

### Requirements
Permissions, host version, OS, edition, execution context.

### Introduced / Deprecated / Removed
Version timeline when verified.

### Correct Usage
Concise verified implementation guidance.

### Project Impact
What will fail or need migration.

### Confidence
Verified / Strong evidence / Probable / Unverified / Contradicted.

## Escalation

Route to `../version-intelligence/SKILL.md` when:

- an upgrade path must be evaluated
- multiple releases must be compared
- introduction/removal timeline requires broader historical analysis

Route to `../docs-search/SKILL.md` when:

- the correct official reference cannot yet be located
- historical/archived docs are needed
