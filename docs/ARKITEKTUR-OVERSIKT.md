# Arkitektur-oversikt: Markedsintelligens-plattformen

Sist oppdatert: 2026-08-30. Dekker alt bygget i CTO-audit-sporet
2026-07-10 → 2026-07-12 (PR #1323 → #1376). For dyp-dokumentasjon, se
`docs/cto-audit/` (auditen) og `docs/integration-audit/` (integrasjons-
analysen med 16 leveranser).

## Det store bildet

Dette er ikke «en GEO-løsning» — det er en **generisk, multi-tenant
markedsintelligens-plattform** der GEO (AI-synlighet) er første ferdige
applikasjon. Dataflyten:

```
Eksterne kilder ──► Adaptere (kontrakter) ──► normalized_signals ──► Paneler/widgets
   Google-APIer        SearchTrendProvider       (tenant-sikret,          MI-seksjonen
   GEO-probe           external-api.ts            lineage, ærlige         Admin Room
   CSV-import          normaliserere              merker)                 (fremtidig:
   GSC/GA4-synk                                                            WidgetRenderer)
                                    ▲
                        Integration Registry (sannhetskilden
                        for status/credentials/fallback-kjeder)
```

Bærende prinsipp: **No Fake Integrations** — estimater merkes `isEstimated`,
syntetiske målinger merkes `synthetic`, importerte data merkes `Imported`,
scraping er ikke en konstruerbar kildeopprinnelse, og en integrasjon kan
ikke presenteres som aktiv uten at registeret sier det. Håndhevet i
Zod-validatorer, ikke i disiplin.

## Lag for lag

### 1. Plattform-hygiene (P1 fra CTO-auditen)

| Hva | Hvor | Poeng |
|---|---|---|
| Modul-gating | `backend/server/feature-flags/` + `useModuleFeature`-hook | Moduler (Leadgrid, MI, fremtidig GEO) skrus av/på per org via `module_feature_entitlements`. MI fungerer med Leadgrid avslått. |
| Eksterne kall | `backend/server/external-api.ts` | ALLE eksterne HTTP-kall går via `externalFetch` (12s timeout) eller `callExternalApi` (kast-fri, typed result, retry). Aldri naken `fetch` mot tredjepart. |
| Panel-tilstander | `frontend/.../market-intelligence/PanelStateContainer.tsx` | Standard loading/tom/feil for alle paneler — matcher widget-kontraktens felter. |
| Widget-kontrakt | `frontend/shared/dashboard-widget-schema.ts` | Zod-skjema for fremtidens widget-system (P2). Nye paneler bør designes mot den. |

### 2. Integration Registry (kunnskapslaget i kode)

`backend/server/integrations/integration-registry.ts` — kodedrevet register
over alle integrasjoner med verifiserte statuser, credential-REFERANSER
(aldri verdier), kvoter og fallback-kjeder. Validert mot
`integration-registry-schema.ts` ved oppstart; `resolveServableIntegration`
følger fallback-kjeder (f.eks. trends-alpha → keyword-planner →
manual-import). Leses av Admin Room → 🔌 Integrasjoner.

Bakgrunnen (inventar, lisensvurderinger, capability-matrix) ligger i
`docs/integration-audit/01–09`.

### 3. Datalaget: normalized_signals (ryggraden)

`backend/migrations/0376` + `backend/server/integrations/
normalized-signal-schema.ts` / `normalized-signal-store.ts`.

Ett skjema for alle eksterne data: obligatorisk `organizationId`
(tenant-sikring på DB-nivå), lukket `sourceType`-enum, påkrevd `unit`
(relative indekser kan aldri blandes med absolutte volum), deterministiske
id-er (re-synk er no-op via dedup-indeks), og lineage (`provider`,
`sourceRecordId`, `collectedAt`, `metadata.importBatchId`).

**Fem kilder mater laget i dag:**

1. **GEO-proben** — `geo-probe-*`-providere, syntetisk, `isEstimated`
2. **Keyword Planner** — `keyword-planner-adapter.ts`: norsk søkevolum,
   cache-først (30 dager) + sekvensiell kø mot Basic Access-kvoten
3. **GSC-synk** — `owned-channels-signal-sync.ts`: klikk/visninger for egne domener
4. **GA4-synk** — samme fil, inkl. **AI-referrals** (chatgpt.com,
   perplexity.ai, copilot, gemini, claude.ai) → AI-trafikk-panelet
5. **Manuell CSV-import** — `manual-import-service.ts`: Google Trends-
   eksport auto-gjenkjennes; generisk CSV via kolonnemapping; batcher i
   `import_batches` (0378)

Adapter-kontrakt for søketrender: `search-trend-provider.ts` med to
implementasjoner (`GoogleAdsKeywordProvider`, `ManualTrendImportProvider`) —
Trends-alpha plugger inn her når Google innvilger tilgang.

### 4. GEO Visibility (første applikasjonen)

`backend/server/market-intelligence/geo-*` + migrasjoner 0377/0379.
Produktspec: `docs/integration-audit/08`; tiltaksplan m/ baselines: `09`.

- **Prompt-sett** med draft→godkjenn-flyt (prompt-ene er produktinnhold);
  seks sett i prod: Leadgrid ×2, TRR casting/utdanning/dans, CreatorHub
- **Probe**: spørsmålene stilles til Claude + Perplexity (fra 2026-07-13)
  via offisielle APIer; kjente merker måles **deterministisk** (ord-grense-
  match, ingen LLM i selve målingen); ukjente merker ekstraheres via
  **discovery** (haiku, sanert i testet kode) — «hvem eier de åpne temaene»
- **Resumerbart**: `executeProbeRun` er idempotent (manglende prompt×motor-
  par beregnes fra DB); stale runs auto-resumes av ukescronen — kjøringer
  overlever deploy-restarts
- **Rapport**: share-of-voice, manglende temaer, motor-brudd, trend,
  discovered brands — i MI-panelet med Estimert-merke + metodikk-tooltip
- Baselines og målinger arkiveres i `docs/integration-audit/geo-baselines/`
  («før»-bildet er lanseringshistorien)

### 5. Innhold og domener (det AI-ene skal finne)

- **llms.txt × 3**: `frontend/client/public/{theroleroom,creatorhubn,leadgrid}-llms.txt`
  — AI-vendte kildefiler med FAQ, sitérbare fakta og anbefalingsregler.
  Host-/UA-ruter eies av `netlify/host-routes.json` og genereres som
  `netlify/edge-functions/host-routes.ts` under frontend-builden.
- **leadgrid.no**: dedikert host (`LEADGRID_DEDICATED_HOSTS` i
  `role-room/utils/runtime.ts` + sti-aliasing i `casting-main.tsx`) —
  `leadgrid.no/priser` uten prefiks; gamle `/leadgrid/*`-stier virker overalt
- **Innholdssider** (marketing-page-systemet i
  `admin/content-marketing/`): `/norsk-casting-prosess`,
  `/verktoy-for-filmutdanninger`, dans-FAQ på `/dansestudio-norge`,
  `/leadgrid/skaffe-leads-guide`, `/leadgrid/feltsalg-for-salgsteam` —
  alle med FAQPage/HowTo/Article JSON-LD, formulert mot spørsmål
  målingene viste var ubesatte

### 6. Admin og drift

- **🔌 Integrasjoner** (AdminRoom-fane): registeret med live signal-telling
  fra normalized_signals + CSV-import-panelet
- **AI-trafikk-panelet** (MI): ekte GA4-AI-referrals — «Live-data»-merket
  motstykke til GEO-ens «Estimert»
- **Cron-flåten** (GitHub Actions): `geo-visibility-weekly.yml` (man 05:15
  UTC, auto-resumer stale runs først), `owned-channels-sync-daily.yml`
  (04:45), `auto-migrate-on-push.yml`
- **Ops-scripts** (`backend/scripts/`): `geo-setup-prompt-sets.ts`,
  `geo-run-single-set.ts`, `geo-backfill-discovered-brands.ts`,
  `geo-visibility-dogfood.ts` (hele pipeline lokalt uten DB)

## Drift: det man MÅ vite

1. **Frontend-produksjon kjører kun på Netlify.** CreatorHub-siten
   `creatorhub-frontend-mig` deployer `live/creatorhub`. Den kanoniske
   produksjonsworkflowen flytter grenen først etter grønn migrering og eksakt
   Render-backenddeploy av samme SHA. Leadgrid og Role Room bruker henholdsvis
   `live/leadgrid` og `live/roleroom` via `Promoter merke`.
2. **Migrasjoner og backenddeploy**: Render auto-deploy er av.
   `auto-migrate-on-push.yml` bruker dedikert migrator, eierpreflight,
   advisory lock, idempotenskontroll, eksakt SHA og smoke-test. Ikke kjør SQL
   eller Render-deploy manuelt; bruk `Deploy shared Render backend` fra
   current `main` ved kontrollert manuell release.
3. **Render env-vars via API**: bruk ALLTID per-nøkkel
   `PUT /v1/services/{id}/env-vars/{key}` (liste-PUT erstatter ALT).
   Aktiver endringen via den kanoniske produksjonsworkflowen, aldri direkte
   `POST /deploys`.
4. **Pre-push-hook** sjekker at `backend/package-lock.json` er i synk med
   `backend/package.json` — fiks med
   `cd backend && npm install --workspaces=false --package-lock-only`.
5. **Rot-`node_modules` er en committet symlink** (deler deps på tvers av
   checkouts). `npm install` i en worktree erstatter den lokalt — gir
   `D node_modules` i git status (ikke commit den) og zod-typecheck-støy
   som ikke finnes i CI.
6. **Anthropic-kreditter**: tom saldo tar ned ALL AI i prod (89 filer) —
   hold auto-reload + usage-varsler på i konsollen. (Skjedde 2026-07-10.)

## Åpne spor (prioritert backlog)

- **Widget-renderer + første ekte widget** (P2) — bygg mot
  `dashboard-widget-schema.ts` over normalized-laget
- **Per-org kost-tellere** for metrede APIer (integrasjonsplanen steg 9)
- **Score-modeller** (P2 — krever produktbeslutning om faktorsett)
- **GEO fase 2**: målt gap → content-pack-generatoren skriver innhold →
  neste måling viser effekt (lukket løkke = salgsdemoen)
- **Jobb-kø** for langkjørende arbeid (resume-mekanismen er plasteret)
- **Google Trends alpha**: søknad sendt 2026-07-10 (`awaitingApproval`) —
  adapteren plugger inn i `SearchTrendProvider` når den innvilges
- Legacy-avklaringer: backend-djm5-tjenesten, `frontend/creatorhub-frontend`
