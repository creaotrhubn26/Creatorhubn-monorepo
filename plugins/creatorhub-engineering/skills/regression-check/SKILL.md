---
name: regression-check
description: Check a change against CreatorHub's known regression classes before merge — whitescreen classes, tsc-gate traps, migration drift, RBAC column traps, build-vs-typecheck gaps. Use after implementation and before release-readiness, or when a bug "looks familiar".
---

# Regression-check — Creatorhubn-monorepo

CreatorHubs feilklasser gjentar seg på tvers av produkter. Denne skillen er
en klasse-sjekkliste: match diffen mot kjente klasser FØR du stoler på grønn
CI. Kildene er `docs/architecture-rules.md` (CH-ARCH-registeret) og
`memory.md` § KRITISKE LÆRDOMMER — les begge ved tvil.

## Whitescreen-klassene (frontend)

- **Suspense uten ErrorBoundary (CH-ARCH-003):** lazy-komponent som
  suspenderer under synkron state-oppdatering → React #426 → blank flate.
  Enhver ny `<Suspense>` skal ha `*ErrorBoundary`-forelder i samme fil,
  helst keyet på fane/rute. R3F-særtilfelle: wrap `<Canvas>` på DOM-nivå.
- **Hooks inline i JSX (CH-ARCH-002):** `use*` i JSX-prop → varierende
  hook-antall mellom renders → «rendered fewer/more hooks». ESLints
  `rules-of-hooks` fanger det IKKE; vår `no-restricted-syntax` gjør.
- **Blank shell ved feilet auth/gating:** feiltilstand skal degradere til
  forklart UI (#1999-mønsteret), aldri tom side.

## «Grønn CI lyver»-klassene

- **Typecheck ≠ build (CH-ARCH-007):** Tauri-appen typesjekkes men bundles
  ikke i CI — Rollup-brytende imports passerer grønt. Bundle faktisk appen
  ved endringer i `apps/resolve-script-manager` eller ikon-/import-mønstre.
- **Lokal tsc ≠ prod-build (CH-ARCH-005):** `await import('@/…')` feiler
  først i prod-Rollup.
- **«0 feil lokalt» med ufullstendig `node_modules` (CH-ARCH-006):**
  zod-dobbeltkopi manifesterer bare med full workspace-install.
- Eneste *required* CI-gate er «Frontend tsc --noEmit» — ESLint-signalet er
  bevisst ikke-blokkerende. Ikke tolk «ingen rød check» som «lint-rent».

## Migrasjons-/DB-klassene

- **`migrate.sh` hopper videre ved feilet migrasjon:** verifiser mot
  `_migrations_applied`-tabellen, ikke GH-action-suksess (mig 313-hendelsen:
  313 droppet, 317/318 applied uten 313–316).
- **Auto-migrate-lag:** kolonner som leses før migrasjonen garantert er
  applied trenger lazy self-heal (mig 0448-mønsteret, #1996).
- **CHECK-constraints:** nye enum-verdier mot eksisterende CHECK
  (`crm_lead_activities.activity_type` tillater ikke `meeting_recap` — bruk
  `note_added` + `metadata.kind`).
- **Kolonnenavn-feller:** permissions = `key` (ikke `permission_key`);
  feil navn ga «403 for alle» (#2003).

## Duplikat-/skygge-klassene

- **Rute-skygging:** dupliserte Express-rutefiler der en eldre versjon
  skygger en nyere (#2002, leadgrid-parking). Ved rare «endringen min har
  ingen effekt»-symptomer: grep etter flere registreringer av samme path.
- **Legacy compat-butikker:** skriv til riktig store, ikke legacy-kompat
  (#2000). Ved dual-write-perioder: sjekk at lesesiden peker på ny butikk.

## Deep-link/state-klassene

- Parametre som bare anvendes «on mount» og ikke når data faktisk lastes
  (#1997-mønsteret). Sjekk nye deep-links/URL-params mot lastesyklusen.

## Prosedyre

1. Kategoriser diffen (frontend-flate / backend-rute / migrasjon / app-build /
   integrasjon) og kjør de relevante klasselistene over.
2. Ved treff: fiks + vurder incident→rule-pipelinen (≥2 forekomster av samme
   klasse = ny CH-ARCH-regel, se `architecture-plan`-skillen).
3. Rapporter verdikt først, deretter kun klassene som faktisk ble sjekket og
   utfallet, med fil-pekere.
