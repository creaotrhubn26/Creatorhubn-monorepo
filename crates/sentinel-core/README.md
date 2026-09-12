# CreatorHub Sentinel

A hybrid code-analysis platform for the CreatorHub monorepo. It scans the
frontend and backend, finds bugs / security holes / architecture drift, points
at the exact file·function·line, explains *why* it's wrong, shows the blast
radius, and proposes a concrete fix — while separating **sikre funn** (confirmed,
can block a deploy) from **mulige mistanker** (suspected, surface only).

## The one rule

> **Evidence is produced deterministically. AI only makes the evidence legible
> and proposes the safest fix.**

Every finding must be backed by a *producer of evidence* — the compiler, an AST
query, CodeQL, Semgrep, a runtime trace, a source-map resolution, or a failing
test. The AI never *detects*. It reads the deterministic evidence and turns it
into: a plain-language explanation, a blast-radius summary, and a proposed patch.
If a producer can't back a claim, the claim doesn't ship as confirmed. This is
what lets the gate stand in front of `Produksjon` without crying wolf.

```
┌─────────────────────── EVIDENCE PRODUCERS (deterministic) ───────────────────────┐
│ tsc          AST / tree-sitter   CodeQL        Semgrep      runtime traces   tests │
│ type errors  graph & data-flow   taint paths   patterns     Sentry + source  repro │
│                                                              maps → real line       │
└──────────────────────────────────────┬────────────────────────────────────────────┘
                                        │  Finding {rule, file, line, evidence, confidence}
                                        │  (SARIF 2.1.0 — one schema for all producers)
                                        ▼
                        ┌──────────────────────────────────┐
                        │  AI EXPLANATION / FIX PLANNER      │  ← last layer, never detects
                        │  why · blast radius · safest patch │
                        └──────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                        ▼
         sentinel-ci (headless gate)              Control Center (Tauri cockpit)
         blocks a deploy on NEW confirmed         pipeline · health · flags · rollback
```

## The five engines

| # | Engine | Produces | Status |
|---|--------|----------|--------|
| 1 | **Repository Scanner** | the file set (frontend+backend, skips vendored/build dirs) | ✅ `collect_source_files` |
| 2 | **Static Analysis** | compiler + AST + CodeQL + Semgrep evidence → `Finding`s | 🟡 2 rules native; tsc/Semgrep/CodeQL wired next |
| 3 | **Runtime Diagnostics** | Sentry error + enriched context + source-map-resolved line + correlation ID | ⏳ design below |
| 4 | **Test / Reproduction** | a failing test that reproduces the bug (role·module·browser·steps) | ⏳ design below |
| 5 | **AI Explanation / Fix Planner** | human explanation + blast radius + safest patch | ⏳ cockpit-side |

The two engines shipped so far (1+2) are pure-std Rust, so the gate compiles
offline with no dependency surface of its own.

## Rules

| id | class | what | confirmed when |
|----|-------|------|----------------|
| `CH-SEC-001` | security | frontend `fetch('/api…', {credentials:'include'})` with no auth header → 401 (backend is header-only) | no `headers` key at all |
| `CH-BUG-001` | bug | `[...value]` where `value = useState(null)` → "not iterable" at runtime | direct var spread into an array literal |
| `CH-ARCH-001/002` | architecture | layering / import-graph drift (needs the AST engine) | — (not yet implemented) |

Confidence is a property of the *evidence*, not a guess: a header-less call is
provably unauthenticated (confirmed); a call that passes a `headers` variable
*might* attach auth (suspected). CodeQL taint tracking will promote several
suspected rules to confirmed by proving the data-flow.

## Run it

```bash
# human report, grouped confirmed / suspected
cargo run --release --manifest-path crates/sentinel-core/Cargo.toml

# machine formats
target/release/sentinel-ci . --json
target/release/sentinel-ci . --sarif > sentinel.sarif

# report-only (never exit non-zero) — for backlog visibility
target/release/sentinel-ci . --all

cargo test --release --manifest-path crates/sentinel-core/Cargo.toml
```

`sentinel-ci` exits `1` when a **confirmed error** is present (report-only with
`--all`). In CI it exits `1` only on findings a PR **introduces** vs its base
branch — see `.github/workflows/sentinel-gate.yml`. The ~240 confirmed findings
already in the tree are a tracked backlog, not a per-PR failure.

## Portable Semgrep mirror

`rules/creatorhub.semgrep.yml` mirrors the native rules for IDE / existing
Semgrep pipelines. The Rust engine stays the source of truth (it's what the gate
runs); keep every `CH-*` id in sync across both.

## Roadmap

- **Engine 2 depth:** shell out to `tsc --noEmit` and ingest its diagnostics as
  evidence; add a tree-sitter AST pass for `CH-ARCH-001/002` (layering, import
  cycles, frontend→API→DB reachability); add CodeQL taint queries and normalise
  every producer into the same SARIF `Finding`.
- **Engine 3:** Sentry-backed runtime capture (see `docs/`), source-map
  resolution to the real `.tsx` line, correlation ID threaded frontend→backend,
  and a feedback loop where recurring runtime signatures become new static rules.
- **Engine 4:** a reproduction harness (Playwright + seeded roles/data) that
  turns a finding into a failing test, and Development / Staging / Production
  separation so no fix is ever made blind in prod.
- **Cockpit:** the Tauri Control Center — deployment pipeline with the gate as a
  stage, health, feature flags / kill switches, rollback & recovery, observability.
