# 6. MVP Integration Priorities, Implementation Plan & Test Plan

## §1 MVP Integration Priorities (leveranse 12)

Rangert etter produktverdi × tilgjengelighet ÷ risiko:

1. **Keyword demand via Google Ads Keyword Planner** — eneste reelle
   volum-kilde; OAuth-fundamentet finnes; developer-token avklart 2026-07-10
   (Basic Access, 15k ops/dag) — ublokkert. *implement now.*
2. **Manuell import + ManualTrendImportProvider** — gjør search-interest-
   widgets ekte uten API-tilgang; gjenbrukbar for alle fremtidige kilder.
   *implement now.*
3. **Brreg-utvidelse (regnskapstall)** — gratis, lisens-ren, styrker
   opportunity-scoring; adapteren finnes. *implement now.*
4. **GSC/GA4 → normalized layer** — kildene er aktive; arbeidet er
   normalisering + tenant-scoping, ikke ny integrasjon. *implement now.*
5. **Google Trends alpha-søknad** — null kode-kost nå; adapter bygges først
   når tilgang finnes. *apply for access + prepare adapter only.*
6. **SSB-utvidelse (næringsstatistikk utover demografi)** — verdi for
   markedsstørrelse-widgets. *prepare adapter only.*
7. Review-/konkurrentendrings-kilder — *requiresLicensedProvider /
   postpone* (se lisensrapporten).

## §2 Implementation Plan (leveranse 13)

Alle steg additive; følger cto-audit-planens P1→P2-sekvens (widget-renderer
er P2 der og forblir det).

| Steg | Innhold | Avhengighet |
|---|---|---|
| 0 (denne PR-en) | Registry-skjema, SearchTrendProvider-kontrakt, NormalizedSignal-skjema (+tester) | — |
| 1 | Rydd døde deps (`google-trends-api`, `@google-analytics/data`); deklarer udeklarerte env-vars i render.yaml | ingen |
| 2 | Kodedrevet registry-fil (validert mot skjemaet) for dagens integrasjoner; eksponer GET `/api/integrations` (admin) fra den | 0 |
| 3 | `normalized_signals`-migrasjon + query-API + GSC/GA4-normalisering (første to adaptere over egne data) | 0 |
| 4 | Import-flyt (CSV først) + `import_batches` + `ManualTrendImportProvider` | 3 |
| 5 | Keyword Planner-adapter bak kø/cache (token avklart: Basic Access) | 3 |
| 6 | Admin Integration Center v1 (les-visning: status/helse/sync-historikk fra registry) | 2, 3 |
| 7 | Brreg-regnskaps-utvidelse; SSB-næringsdata | 3 |
| 8 | Trends alpha-adapter (hvis innvilget); fallback-kjede i registeret | 4, 5 |
| 9 | Per-org kost-tellere for metered APIer (cto-audit P2-punkt) | 2 |

## §3 Test Plan (leveranse 14) — inkl. oppdragets 20 QA-scenarioer

Prinsipp: én felles test-suite («integration harness contract tests») som
hver adapter må bestå — scenarioene under er suite-casene. Dashboardet skal
aldri krasje pga. én manglende/feilende integrasjon (verifiseres med
PanelStateContainer-/widget-kontraktens error-tilstander).

| # | Scenario | Forventet atferd | Testtype |
|---|---|---|---|
| 1 | Integrasjonen finnes ikke i registeret | Widget viser `Unavailable` + kildevalg; ingen 500 | unit (registry-resolver) |
| 2 | Credentials mangler | Registry-status `missingCredentials`; Admin Center viser handling; adapter kjører ikke | unit |
| 3 | API ikke aktivert i Google Cloud | Adapter tolker 403 `SERVICE_DISABLED` → `unavailable` + failureReason | unit m/ mocket respons |
| 4 | OAuth-scope mangler | 403 insufficient scope → status `configured` + re-consent-CTA i Admin Center | unit |
| 5 | Bruker mangler tilgang (f.eks. GSC-property) | Tom+forklart tilstand per property, ikke feil for hele org-en | integration |
| 6 | Access avventer godkjenning (Trends alpha) | `awaitingApproval` + fallback-kilde serverer widgeten med kilde-merke | unit |
| 7 | Kvote brukt opp | 429/RESOURCE_EXHAUSTED → backoff + `degraded`; cached data serveres m/ `Cached`-merke | unit (callExternalApi-retry finnes) |
| 8–11 | 401 / 403 / 429 / 500 fra API | Typed failure fra `callExternalApi` (finnes, testet i `external-api.test.ts`); adapter mapper til riktig registry-status | unit |
| 12 | Dataformat endret | Zod-parse av provider-respons feiler → `degraded` + failureReason `schema_mismatch`; rå respons logges ikke m/ secrets | unit |
| 13 | Provider midlertidig nede | timeout (12s, finnes) → cached hvis fresh nok, ellers `Unavailable` | unit |
| 14 | Delvis sync-resultat | Batch committes med `partial=true` i sync-run; widget viser delvis-merke | integration |
| 15 | Cached data finnes | Serveres med `Cached` + dataalder | unit |
| 16 | Cached data for gammel | `Stale`-merke; ikke presentert som live | unit (freshnessScore-terskel) |
| 17 | Fallback-provider finnes | Registry-kjeden følges; providerId i attribution byttes synlig | unit |
| 18 | Ingen fallback | `Unavailable`-tilstand, resten av dashboard uberørt | e2e (Playwright — mønster finnes i repo) |
| 19 | Bruker importerer CSV | Full importflyt: mapping→validering→duplikatkontroll→lineage; radene får `manual_upload` | integration |
| 20 | Samme datapunkt fra flere kilder | Begge lagres (ulik provider); query-laget velger etter kilderang + viser opphav; ingen stille de-dup på tvers av kilder | unit |

**No Fake Integrations-kontroll i CI**: en lint-/testregel som feiler hvis en
widget-datasource refererer en registry-id med status ≠
`active/degraded` uten å rendre status-merket; `NormalizedSignal`-validatorens
avvisning av ugyldig `sourceType` er allerede enhetstestet i denne leveransen.
