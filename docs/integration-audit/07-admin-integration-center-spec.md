# 7. Admin Integration Center — Specification (leveranse 15)

Generisk administrasjonspanel for integrasjoner. Bygger på mønstre som
allerede finnes i repoet: SuperAdmin-tilgangsmatrisen
(`leadgrid_org_entitlements`-adminflaten), `module_feature_entitlements`
(P0/P1) og `admin-integration-tests-routes.ts` (som allerede gjør
«test tilkobling»-sjekker mot bl.a. Google Ads uten OAuth).

## Datagrunnlag

- **Integration Registry** (`integration-registry-schema.ts`) — sannhetskilde
  for alle felter. v1: kodedrevet fil validert mot skjemaet; v2: DB-tabell
  med samme skjema når skriveoperasjoner (enable/disable, frekvens, fallback)
  skal gjøres i UI.
- **Sync-runs** (lineage-strategien, dok 05 §3) — historikk/feil.
- **Credential-status** — kun *tilstedeværelse* sjekkes (env-var satt? token
  finnes for org?); verdier vises aldri. Credentials lagres som i dag: env
  (Render, `sync:false`) for app-nivå, krypterte DB-rader
  (`TOKEN_ENCRYPTION_KEY`-mønsteret) for bruker-/org-tokens. Aldri frontend,
  aldri klartekst-felt. (Secret Manager er uaktuelt så lenge plattformen ikke
  kjører på GCP — jf. Security-rapporten.)

## Funksjoner (oppdragets liste → realisering)

| Funksjon | v1 (les) | v2 (skriv) |
|---|---|---|
| Se alle integrasjoner + status/helse | ✓ (fra registry + sync-runs) | |
| Se scopes, quotas, kostestimat, sync-historikk, feil | ✓ (felter i registry; kost fra tellere når de finnes — «ukjent» vises ærlig, aldri gjettes) | |
| Test tilkobling | ✓ (gjenbruk `admin-integration-tests-routes.ts`-mønsteret + adapterens `healthCheck()`) | |
| Koble til provider / OAuth-samtykke | | ✓ (gjenbruk eksisterende OAuth-flows; Admin Center er inngangen, ikke en ny flow) |
| Legge inn/referere credentials | | ✓ (referanse til env-var-navn eller kryptert org-token — aldri verdi i klartekst-UI) |
| Aktivere/deaktivere integrasjon | | ✓ (`enabled` i registry; effekten er umiddelbar via provider-registry-oppslaget) |
| Endre sync-frekvens / trigge manuell sync | | ✓ (v1 av cron er GitHub Actions — manuell trigger = kjør adapter-endepunkt; frekvensendring krever workflow-endring inntil intern scheduler finnes, og UI-et skal si det ærlig) |
| Velge fallback | | ✓ (`fallbackIntegrationId`) |
| Koble integrasjon til workspace + velge datatyper | | ✓ (`tenantScope`/`workspaceScope` + `supportedDataTypes`-subset per org) |
| Velge Google Cloud-prosjekt/dataset | | Kun relevant for BigQuery-provideren — utsettes til den ev. bygges |

## Tilgang og sikkerhet

- Kun super_admin (samme guard som SuperAdmin-matrisen).
- Alle skriveoperasjoner audit-logges (hvem/når/hva — samme mønster som
  entitlement-adminflaten).
- Endepunkter monteres under `/api/admin/integrations/*` med server-side
  håndhevelse (lærdommen fra QA 2026-07-06: aldri klient-side-gating alene).

## UI-plassering

Ny fane i eksisterende admin-room (samme sted som SuperAdmin-matrisen), med
PanelStateContainer for alle tilstander. Widget-status-merkene
(Live/Cached/Imported/Estimated/Demo/Stale/Unavailable) gjenbruker samme
komponentbibliotek som dashboardet slik at admin ser nøyaktig det kundene ser.
