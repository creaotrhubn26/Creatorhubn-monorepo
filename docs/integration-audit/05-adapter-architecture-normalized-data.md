# 5. Adapter Architecture, Normalized Data Layer & Lineage

## §1 Integration Adapter Architecture (leveranse 8)

Lagdeling (utenfra og inn):

```
[Provider-API]
   ↓  provider-adapter (én fil per provider; all leverandør-spesifikk
      auth/paging/feiltolkning bor her — bruker external-api.ts)
[Capability-kontrakt]  f.eks. SearchTrendProvider (levert som kode)
   ↓  normalisering (adapterens ansvar: konverter til NormalizedSignal)
[Normalized Data Layer]  normalized_signals (+ lineage-felter)
   ↓  lesing via query-API
[Widget/AI-lag]  dashboard-widget-schema.ts (dataSource = registry-id)
```

Regler:

1. **Adaptere kaster aldri ukontrollert** — de returnerer typed
   success/failure (`callExternalApi`-mønsteret fra P1) og rapporterer helse
   via `healthCheck()` → registry `healthStatus`.
2. **Kontrakter er capability-orienterte**, ikke provider-orienterte:
   `SearchTrendProvider` (levert), deretter `CompanyDataProvider` (Brreg i
   dag), `OwnedChannelMetricsProvider` (GA4/GSC/Ads/Meta/…),
   `ReviewSignalProvider` (når lisensiert kilde finnes).
3. **Fallback-kjeder** ligger i registeret (`fallbackIntegrationId`), og
   resolusjonen skjer i et tynt provider-registry-oppslag — ikke i widgets.
4. **Registry er sannhetskilden** for enabled/health/scope — Admin
   Integration Center (dok 07) administrerer det; `integration-registry-schema.ts`
   (levert) validerer hver oppføring.

## §2 Normalized Data Schema (leveranse 9)

`backend/server/integrations/normalized-signal-schema.ts` (levert, testet)
implementerer oppdragets `NormalizedSignal` som Zod-skjema + typer:

- **Tenancy er obligatorisk**: `organizationId` + `workspaceId` på hver rad —
  samme retning som P0-migrasjonen (`0374`) satte for `market_scans`.
- **Opprinnelse er obligatorisk og lukket**: `sourceType` er en enum
  (`official_api / licensed_provider / user_imported / manual_upload /
  public_data`) — «ikke-godkjent scraping» er ikke en gyldig verdi, så
  validatoren avviser slike rader ved konstruksjon.
- **Semantisk vakt**: `unit` er påkrevd (`relative_index`,
  `searches_per_month`, `count`, `nok`, `percent`, …) slik at relative
  Trends-tall aldri kan forveksles med absolutte volum.
- `confidence`/`sourceQuality`/`freshnessScore` (0–1) + `isEstimated` gjør
  «No Fake Integrations»-reglene håndhevbare: en widget kan ikke vise en rad
  som Live hvis raden sier `isEstimated=true` eller freshness er under terskel.

DB-tabellen (`normalized_signals`) skrives som additiv migrasjon når første
adapter kobles på (Implementation Plan steg 3) — skjemaet er kontrakten den
migrasjonen genereres fra, så kode og tabell ikke divergerer.

## §3 Data Lineage Strategy (leveranse 10)

Hver `NormalizedSignal`-rad bærer sin egen lineage:
`provider` + `sourceType` + `sourceRecordId` + `collectedAt` +
`sourceUpdatedAt` + `metadata` (rå-respons-referanse/import-batch-id).

I tillegg:

1. **Import-batcher er entiteter**: manuell import (CSV/XLSX/Sheets/BigQuery/
   Cloud Storage) oppretter en `import_batch` med filnavn, kolonnemapping,
   validerings-resultat og hvem som importerte — hver rad peker på batchen
   (`metadata.importBatchId`). Sletting av en batch sletter/merker radene.
2. **Sync-runs logges**: hver adapter-synk får en run-id (start/slutt/antall
   rader/feil) → registry `lastSuccessfulSync`/`lastFailedSync`/`failureReason`
   oppdateres derfra, ikke manuelt.
3. **Widget-attribution**: widget-kontraktens `sourceAttribution`/
   `dataFreshness`-felter (finnes allerede i `dashboard-widget-schema.ts`)
   fylles fra signalenes lineage — UI-merkene Live/Cached/Imported/Estimated/
   Stale/Unavailable beregnes, ikke hardkodes.

## §4 Manual Import Support (oppdragets krav)

Manuell import er en førsteklasses datakilde (`sourceType='manual_upload'`
eller `'user_imported'`), aldri mock-data. Flyt (bygges i Implementation Plan
steg 4):

1. Opplasting (CSV/JSON/XLSX) eller tilkobling (Google Sheets via eksisterende
   Workspace-OAuth; BigQuery/Cloud Storage når GCP-behov oppstår)
2. Automatisk kolonnedeteksjon → forslag til mapping mot `NormalizedSignal`
3. Preview (første N rader, normalisert)
4. Validering mot Zod-skjemaet (levert) — feil vises per rad/kolonne
5. Duplikatkontroll (`provider`+`sourceRecordId`+`periodStart` som nøkkel)
6. Tids-/geografikontroll (period-felter påkrevd; geo valideres mot
   kommune-nr-registeret som `lead-ssb-service.ts` allerede har)
7. Import → `import_batch` + rader
8. Lineage + audit-logg (hvem/når/hva)

Første konkrete bruksflate: Google Trends CSV-eksport →
`ManualTrendImportProvider` (se dok 03).
