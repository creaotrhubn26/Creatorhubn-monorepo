---
name: dependency-audit
description: Audit, add, upgrade, or pin dependencies in the Creatorhubn monorepo. Use for any package.json/lockfile change, npm workspace hoisting questions, external API/SDK version questions, or "can we upgrade X" — the monorepo has hard-won lockfile and hoisting traps that must be checked before pushing.
---

# Dependency-audit — Creatorhubn-monorepo

Avhengighetsdisiplin for CreatorHub. Repoet er et npm-workspace (rot →
`frontend`, `backend`; Node ≥20) med separate økosystemer i `ipad/` (Swift),
`crates/` (Rust) og `apps/` (bl.a. Tauri). Feilklassene under har hver kostet
dager-til-uker med feilede deploys — sjekk dem FØR push, ikke etter.

## Ufravikelige sjekker ved enhver deps-endring

1. **`backend/package-lock.json` i sync (CH-ARCH-004).** Dockerfilen kjører
   `npm ci` frittstående i `/app/backend`; usynket lockfil = død Render-deploy
   (har kostet ~3 uker historisk). Etter enhver `backend/package.json`-endring:
   ```bash
   cd backend && npm install --workspaces=false --package-lock-only
   ```
   og commit lockfilen. `.githooks/pre-push` håndhever dette lokalt, men
   verifiser selv i CI-/cloud-økter der hooks ikke kjører.

2. **Én zod-kopi i frontend-treet (CH-ARCH-006).** Workspace-hoisting kan dra
   inn en andre zod via transitive kjeder (`drizzle-zod` → `zod/v4`) → titalls
   tsc-feil uten kildeendring. Pin i `frontend/package-lock.json` er NO-OP —
   workspacet leser ROT-lockfilen. Invarianten håndheves via
   `frontend/tsconfig.json` `paths`; verifiser mappingen etter oppgradering av
   zod eller drizzle-pakker.

3. **«tsc grønt» ≠ «appen bygger» (CH-ARCH-007).** CI typesjekker
   `apps/resolve-script-manager` (Tauri) men bundler den aldri. Dype
   `@mui/icons-material/*Outline`-imports passerer tsc og knekker Rollup først
   ved bundling. Ved MUI-oppgradering: kjør faktisk `vite build` på
   Tauri-appen(e) før du konkluderer grønt.

4. **Manifest-endring ⇒ fersk regen av BEGGE lockfiler (CH-ARCH-009).**
   af5a596-hendelsen: manifest-endringer med en ikke-fersk rot-lockfil →
   lockfilen mistet transitive pakker (`loupe`) → `npm ci` installerte
   hull-tre → begge hardened E2E-gates krasjet, og usynket backend-lockfil
   brøt Render. Regenerer alltid begge i samme commit; ved mistanke om
   inkonsistens: `rm -rf node_modules */node_modules package-lock.json`
   først — npm gjenbruker både eksisterende lockfil-tre OG installert
   `node_modules` (inkl. stale peer-oppløsninger) ved resolve.

5. **Ingen `await import('@/…')` (CH-ARCH-005).** Rollup i prod-build kan ikke
   resolve `@`-alias i dynamiske imports selv om lokal tsc passerer. Relevant
   når en ny pakke «anbefaler» lazy-import i eksempler.

Full regeltekst med hendelseshistorikk: `docs/architecture-rules.md`.

## Eksterne API-/versjonsspørsmål → Documentation Intelligence

Aldri svar på «hvilken versjon av X», «er Y kompatibel med Z» eller «hva
endrer ny release» fra hukommelse (Freshness Rule i
`.claude/skills/documentation-intelligence/shared/SOURCE_POLICY.md`).
Rut i stedet:

- `docs/baselines/` — vår faktiske eksterne API-bruk per app (hva vi kaller,
  hvilke symboler vi er avhengige av).
- `docs/impact-reports/` — ukentlige versjons-/impact-rapporter med
  `## Produktmuligheter`.
- `docs/evidence/` — beslutninger med kilder og livssyklus:
  `sh .claude/skills/documentation-intelligence/scripts/evidence-query.sh <vendor>`
- Følg rutingen i `.claude/skills/documentation-intelligence/SKILL.md`.

## Pinning og beslutninger med lang hale

Når en pin/nedgradering gjøres av en grunn som ikke er åpenbar om tre måneder
(«vi pinner X fordi Y»): skriv en `docs/evidence/`-fil
(`YYYY-MM-<slug>.yaml`, konvensjon i `docs/evidence/README.md`). Det er det som
gjør stale-varsling og «hvorfor gjorde vi dette» gratis senere. Livssyklus
representeres med `valid_from`/`valid_to` — aldri destruktiv overskriving.

## Output-kontrakt

Verdikt først («trygg å oppgradere / ikke trygg fordi …»), deretter kun
prosjekt-relevante punkter med fil-pekere. Hvert funn: hva + hvor + hvorfor +
størrelse. Null svada.
