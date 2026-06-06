# Lint-scripts

Heuristikker som fanger feilmønstre ESLint's standard-plugins ikke ser.

## check-hooks-after-early-return.sh

Detekterer mulige React `rules-of-hooks`-brudd:
- **Pattern A**: hook deklarert ETTER `if (...) return null` (varierer antall hooks mellom render-stier)
- **Pattern B**: hook inline i JSX-prop verdi (`<X prop={React.useMemo(...)} />`)

Pattern B er nesten alltid en bug. Pattern A krever manuell scope-check (mange false positives når en fil har utility-funksjoner + hovedkomponent).

```bash
./scripts/lint/check-hooks-after-early-return.sh frontend/client/src/
./scripts/lint/check-hooks-after-early-return.sh --strict frontend/    # CI-failable på Pattern B
```

Bakgrunn: 2 instances av Pattern A shipped UI-bugs til ekte brukere — `FormationViewConnected` (linje 449/455 i pre-fix) og `AnnotationExportOverlay` (linje 108). Begge ble fanget reaktivt via Playwright spec-failures.

## check-duplicate-imports.sh

Detekterer eksakt-duplikate `import`-statements i samme fil.

```bash
./scripts/lint/check-duplicate-imports.sh frontend/client/src/
```

Bakgrunn: auto-merge i git produserer noen ganger to identiske `import` uten å trigge konflikt-marker. Babel feilet stille → vite serverte stale HMR-cache → UI-endringer tok aldri effekt. Vi mistet ca. 1 time på dette i `dance-formation-pixel-perfect`-arbeidet før vi oppdaget duplikat-`useAuth`.

CI-anbefaling: kjør som warning på alle PR-er, manuelt rydd opp i batch.
