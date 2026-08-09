# PR Guardian Policy

Use Documentation Intelligence as a pull-request guard for unfamiliar external interfaces.

## Trigger

On a PR, detect newly added or materially changed:

- external API symbols
- SDK calls
- manifest keys
- OAuth scopes
- CLI commands
- protocol fields
- dependency major versions
- host/runtime minimums

## Required Checks

1. `repo-intelligence` identifies the new external usage.
2. `api-validator` validates unfamiliar symbols.
3. `compatibility-solver` runs when the change alters the supported stack.
4. `impact-engine` evaluates P0/P1 workflow risk.
5. `evidence-graph` records the evidence trail.

## Block Merge When

- HALLUCINATED_API / Incorrect verdict
- wrong-version API on supported target
- confirmed incompatible stack
- required permission missing
- migration required but absent for a P0/P1 path
- critical evidence is Unverified

## Warn Without Blocking When

- deprecation with supported replacement window
- compatibility is conditional but CI covers condition
- low-risk documentation uncertainty
- preview API is intentionally allowed by project policy

## Suggested PR Annotation

```text
Documentation Intelligence
Status: BLOCK
Reason: API `X.y()` is not available in the project's SDK 8.4 baseline.
Introduced: SDK 9.0
Affected file: src/integration/export.ts
Recommended action: use documented API Z or raise the project baseline after compatibility review.
Evidence: [official API reference]
```
