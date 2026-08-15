---
name: architecture-plan
description: Plan a feature, refactor, or architectural change in the Creatorhubn monorepo. Use before non-trivial implementation work, when writing a design/plan, when deciding where code belongs (which product/app/layer), or when codifying a recurring failure class into a rule.
---

# Architecture-plan — Creatorhubn-monorepo

Planleggingsdisiplin for CreatorHub-porteføljen. En plan her er ikke et
generisk designdokument — den skal være forankret i registrene og minnet
repoet allerede har.

## Før du planlegger: les det systemet allerede vet

1. `memory.md` (repo-rot) — levende status, kjente begrensninger, «KRITISKE
   LÆRDOMMER» og beslutninger som venter på produkteier. Planlegg aldri noe
   som kolliderer med en ventende beslutning uten å flagge det.
2. `docs/architecture-rules.md` — CH-ARCH-registeret. Hver invariant er født
   av en produksjonshendelse. En plan som bryter en 🟢-regel er feil; en plan
   som gjentar en 🟡-kandidatklasse skal mekanisere regelen samtidig.
3. `docs/evidence/` — tidligere beslutninger med kilder og livssyklus
   (`evidence-query.sh <vendor>` for leverandør-flater).
4. `docs/impact-reports/` — `## Produktmuligheter`-seksjoner kan allerede
   inneholde et konkret forslag med fil-pekere for det du planlegger.

## Fokus-spørsmål før bred analyse

I interaktive økter: still 1–3 korte fokus-spørsmål FØR analysen — hvilket
system (Post Agent / iPad-appene / Role Room / Leadgrid / CreatorHub-
plattformen / Reknaren / Pondus), hvilken vendor-flate, risiko- vs.
mulighets-fokus. Ikke lever bred analyse av alt når brukeren ville hatt dybde
på ett system. (Gjelder ikke autonome cron-/cloud-kjøringer.)

## Plan-innhold (obligatorisk)

- **Hvor koden bor:** produkt → katalog (se `repo-intelligence`-skillen for
  kartet). Delte flater (backend-ruter, migrasjoner, shared types) navngis
  eksplisitt.
- **Migrasjonsplan** hvis DB-endring: nummerert migrasjon + verifisering mot
  `_migrations_applied` (ikke bare GH-action-suksess — `migrate.sh` hopper
  videre ved feilet migrasjon; mig 313-hendelsen). Vurder lazy self-heal for
  kolonner som må tåle auto-migrate-lag (mønster: mig 0448 / PR #1996).
- **Org-scoping:** enhver ny tabell/spørring skal være org-scopet fra dag 1.
  Husk at `crm_customers` historisk manglet `organization_id` —
  subquery-mønsteret via `organization_members` er fallback (memory.md §
  KRITISKE LÆRDOMMER).
- **Fase-inndeling:** store leveranser deles i nummererte faser som separate
  PR-er (konvensjon: «Fase 1», «Fase 2» i commit-tittel, jf. #2004/#2005).
- **Verifisering:** hvilke E2E-gates/smokes beviser at planen er levert
  (se `e2e-verify`-skillen).

## Incident → rule-pipeline

Én forekomst av en feil = fiks den. ≥2 forekomster av samme klasse = kodifiser:
velg letteste maskin (ESLint-selector → pre-push-hook → tsconfig/CI-gate),
tildel neste ledige CH-ARCH-ID, skriv Hendelse/Regel/Håndhevelse/Slik retter
du i `docs/architecture-rules.md`, backlink fra koden, og rydd eksisterende
brudd til 0 i samme eller oppfølgende PR. Prosedyre: registerets siste seksjon.

## Modell-disiplin (si fra om valget)

Mekanisk arbeid = scripts (null modell); henting/kondensering per vendor =
Haiku-subagenter i parallell; symbol-validering = Sonnet; verdikt/migrering/
arkitekturforslag = sterkeste modell. Stille modellvalg er ikke lov for
verdikt med produksjonskonsekvens — begrunn («her bruker vi sterkeste modell
fordi …», «her holder Sonnet»).

## Beslutninger med lang hale

Plan som lander på «vi gjør X i stedet for Y pga. ekstern begrensning» →
skriv `docs/evidence/YYYY-MM-<slug>.yaml` (konvensjon i
`docs/evidence/README.md`) i samme PR.

## Output-kontrakt

Verdikt/anbefaling først. Hvert forslag = hva + hvor (system + fil-peker) +
hvorfor/gevinst (én setning) + størrelse. Mangler en del → dropp forslaget.
