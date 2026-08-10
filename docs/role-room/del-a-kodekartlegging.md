# Del A — kodekartlegging mot eksisterende Role Room-implementasjon

Kartlegging av de 150 punktene i «Del A prioritert» mot koden slik den faktisk står i
monorepoet. Gjennomført 30. juli 2026.

> **Oppdatert 30. juli 2026 etter implementasjon.** Sytten punkter er levert siden
> kartleggingen: 35, 140, 141, 150, 17, 11, 47, 97, 68, 82, 60, 14, 105, 106, 58, 46, 83
> og 98 — samt sømmen for 42, som venter på et leverandørvalg. Tabellene under viser
> statusen slik den var ved kartleggingen; se «Levert» nederst for hva som er endret.

**Statuskoder:** ✅ bygget · 🟡 delvis · ⬜ ikke funnet

**Konfidensnivå:** *V* = verifisert (lest kode/skjema) · *I* = indikasjon (søketreff, ikke lest i dybden).
Alle P0-punkter og hele A12 er verifisert. Øvrige punkter er stikkprøvet.

---

## Hovedfunn

Backloggen undervurderer systematisk hva som allerede står i koden. Fem av konklusjonene
bør endres før sprintplanlegging:

1. **Callsheet-generatoren finnes** (punkt 67). Backloggen sier «bransjens viktigste dokument —
   mangler helt» og setter den som P0/L. Realiteten er `CallSheetGenerator.tsx` på 1851 linjer,
   med autofyll fra produksjonsdag (egen testfil), værbar med soloppgang/solnedgang, HMU- og
   avdelingsfelter, samt en utsendingsrute med RBAC og rate limit. Det som faktisk mangler er
   **lest-kvittering** (punkt 68) — utsendingen logger sendt/feilet per mottaker, ikke åpnet.
   Dette flytter en L-oppgave til en S-oppgave.

2. **Granulære tilgangsroller finnes i stor grad** (punkt 129). Backloggen kaller dette
   «fundamentet», P0/L, og advarer om at migreringen blir dyrere for hver måned. Men
   `role-room-project-tab-config-routes.ts` (543 linjer) implementerer allerede tilgang per fane
   med nivåene `view`/`manage`, og presedensen bruker-override > rolle-override > plattform-default.
   `casting_user_roles` har i tillegg en `permissions JSONB`-kolonne. Migreringsargumentet — den
   viktigste begrunnelsen for P0 — gjelder ikke lenger på samme måte.

3. **Idempotens er bygget — på feil flate** (punkt 145). `/v1`-REST-API-et har full
   idempotensimplementasjon: påkrevd `Idempotency-Key`-header på skriv, egen tabell med unik
   indeks, 409 ved nøkkelkonflikt, 409 ved parallell kjøring, og `x-idempotency-replayed` ved
   replay. MCP-flaten har ingenting av dette. Punktet er altså ikke «bygg idempotens», men
   «gjenbruk den eksisterende motoren på MCP-skrivene» — vesentlig mindre arbeid.

4. **Webhooks finnes allerede** (punkt 142, oppført som P1 «start med 3 events»). Implementert med
   nøyaktig tre events: `project.created`, `project.updated`, `mapping.upserted`, pluss
   admin-CRUD for webhooks, dispatch-endepunkt og outbox-tabell. Punktet kan lukkes.

5. **Self-tape-pakken er i hovedsak bygget** (punkt 28, satt som «størst enkeltgevinst», P0/L).
   Fem tabeller (`talent_selftape_projects`, `_takes`, `_ai_feedback`, `_submissions`,
   `_submission_events`) og 1737 linjer ruter. Kandidatstatus propagerer til innsendingsstatus
   (kanban `shortlist` → `shortlisted`). Det som gjenstår av pakken er punkt 35 — se under.

**Motsatt vei:** ett punkt er verre stilt enn backloggen antyder. Punkt 35 (GDPR-autosletting) er
markert P0/M som om det er halvveis. Det som finnes er *brukerinitierte* rettigheter — innsyn
(art. 15), sletting (art. 17) og portabilitet (art. 20) i `role-room-talent-gdpr-routes.ts`.
Automatisk sletting ved utløpt lagringsfrist finnes ikke: ingen retention-felter, ingen
opprydningsjobb. Compliance-risikoen backloggen peker på er reell og udekket.

---

## A1. Prosjektoversikt og dashboard (1–12)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 1 | Sortering: aktive først | ⬜ | V | `rr_list_projects` sorterer kun `updated_at DESC` |
| 2 | Total-felt + paginering | ⬜ | V | Returnerer `{projects: rows}`, kun `limit` (maks 200) |
| 3 | Inkonsistens-flagg | ⬜ | I | Ingen regelmotor funnet |
| 4 | Helseindikator | 🟡 | V | `Planning/ProjectHealthCheck.tsx` finnes |
| 5 | Pinne/favoritt | ⬜ | I | — |
| 6 | Bulk-arkivering | ⬜ | I | — |
| 7 | Duplikatvarsel likt navn | ⬜ | I | — |
| 8 | Prosjektmaler | ⬜ | I | — |
| 9 | Porteføljetidslinje | ⬜ | I | — |
| 10 | «Hva ble endret» | ⬜ | I | — |
| 11 | Prosjekttype påkrevd | ⬜ | V | `project_type varchar(100)` uten NOT NULL/validering |
| 12 | Egendefinerte prosjekttyper | 🟡 | V | `AddProjectTypeDialog.tsx`, `ProjectTypeSelector.tsx`, `projectTypeConstants.ts` |

Merk at 12 (P2, oppfølger til 11) er kommet lenger enn 11 (P0) — rekkefølgen i backloggen er
snudd i praksis.

## A2. Casting: roller (13–24)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 14 | Status-pipeline | 🟡 | V | Kandidatnivå bygget (11 statuser, `role-room-candidate-status-routes.ts`); rollenivå er bar `status varchar(50) default 'open'` |
| 16 | Krav-felter | 🟡 | V | `casting_roles.requirements JSONB` finnes, ustrukturert |
| 17 | Strukturert alder/kjønn | ⬜ | V | `age_range varchar(50)`, `gender varchar(50)` — fritekst. Bekreftet |
| 19 | Statister som rolletype | 🟡 | V | `role_type` finnes; `extras` er egen breakdown-kategori |
| 23 | Rolle ↔ scene | 🟡 | V | `casting_roles.scene_ids JSONB` finnes allerede |
| 13, 15, 18, 20–22, 24 | — | ⬜ | I | Ikke funnet |

## A3. Kandidater og auditions (25–40)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 27 | Delt shortlist | 🟡 | V | `shortlist`-status finnes i kandidat-kanban og propagerer til talent |
| 28 | Self-tape-innlevering | ✅ | V | 5 tabeller + `talent-selftapes-routes.ts` (1737 l.) + `SelfTapePreviewModal.tsx` |
| 29 | Automatisk transkodering | 🟡 | V | Håndtert i `role-room-talent-uploads-routes.ts` / selftape-ruter |
| 30 | Tidskodede kommentarer | ✅ | V | `role_room_client_review_comments.timestamp_seconds` |
| 33 | Automatisk påminnelse | 🟡 | V | `talent-selftape-notifications.ts` |
| 35 | **GDPR-autosletting** | ⬜ | V | Kun brukerinitiert art. 15/17/20. Ingen retention-frist, ingen opprydningsjobb |
| 25, 26, 31, 32, 34, 36–40 | — | ⬜ | I | Ikke funnet |

## A4. Tilbud og kontrakter (41–52)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 42 | E-signering | 🟡 | V | `role_room_google_agreement_signatures` (Google Workspace-basert). **Ingen BankID** |
| 46 | Kontraktsarkiv | 🟡 | V | `rr_list_contracts`, `rr_list_offers` finnes som lesetilgang |
| 47 | Buyout-felter | 🟡 | V | `contractType: 'daily'\|'weekly'\|'buyout'\|'stunt'` finnes som enum — men ingen strukturerte buyout-felter (territorium, varighet, medier) |
| 49 | Juristgodkjente maler | 🟡 | V | `ProjectAgreementsPanel.tsx` refererer aml. kap. 4 + internkontrollforskriften |
| 41, 43–45, 48, 50–52 | — | ⬜ | I | Ikke funnet |

Punkt 43 (tilbudssporing sendt→åpnet→akseptert) er verdt å merke seg: samme mekanikk som
manglende lest-kvittering i punkt 68. Én sporingskomponent dekker begge.

## A5. Tidslinje og planlegger (53–66)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 53 | Delete/list for drafts | ⬜ | V | Se punkt 141 — samme mangel |
| 54/55 | Avhengigheter + Gantt | 🟡 | I | Treff på «Gantt» (5 filer) og «dependenc» (9 filer) |
| 57 | Gjentakende oppgaver | 🟡 | I | 3 filer |
| 59 | Kritisk sti | ⬜ | V | Null treff |
| 61 | Kapasitetsvisning | 🟡 | I | 30 filer nevner kapasitet |
| 62/63 | Kommentartråder + vedlegg | 🟡 | V | Kommentarmodell finnes for reviews; ikke på oppgaver |
| 64 | Fase-gate | ⬜ | V | Null treff |
| 65 | Forfallsvarsling | 🟡 | V | `role-room-deadline-reminders-routes.ts` + cron-indekser på `due_at` |
| 56, 58, 60, 66 | — | ⬜ | V | **58** (sjekkliste-maler) og **60** (iCal) bekreftet fraværende |

## A6. Produksjonsdager og innspilling (67–80)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 67 | **Callsheet-generator** | ✅ | V | `CallSheetGenerator.tsx` (1851 l.), `callSheetAutofill.test.ts`, `role-room-call-sheet-routes.ts` |
| 68 | Distribusjon m/lest-kvittering | 🟡 | V | Utsending finnes (e-post per mottaker, RBAC, maks-antall, rate limit). **Lest-kvittering mangler** |
| 69/70 | Vær + sol/magic hour | ✅ | V | `weatherForecast` med `sunrise`/`sunset` i callsheet-feltene |
| 72 | Stripboard | 🟡 | V | `production/StripboardPanel.tsx` (697 l.), `AssignStripDialog.tsx` |
| 75 | Dagsrapport | 🟡 | I | 6 filer |
| 79 | HMS-notat | 🟡 | V | HMS-krav finnes i `ProjectAgreementsPanel`, ikke per produksjonsdag |
| 71, 73, 74, 76–78, 80 | — | ⬜ | I | **74** (overtid/AML) og **80** (barnearbeid) ikke funnet som regelmotor |

`ProductionDayView.tsx` er på 5645 linjer — produksjonsdag-domenet er tungt bygget ut.

## A7. Scener, manus og shot lists (81–92)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 81 | Manusversjon-differ | 🟡 | V | `casting-manuscript-revisions-service.ts` (209 l.) |
| 82 | **Auto scene-uttrekk** | 🟡 | V | `casting-screenplay-formats.ts` (357 l.) parser Fountain + FDX. Men: eksplisitt stateless — «lagrer ikke direkte i manuscripts-service». Persisteringen til scene-entiteter er den manglende halvdelen |
| 83 | Scene↔karakter↔kandidat | 🟡 | V | `casting_roles.scene_ids` finnes som kobling |
| 85 | Storyboard | ✅ | V | 113 filer; `SceneStoryboardDialog.tsx`, `StoryboardIntegrationView.tsx` |
| 86 | Utstyrsbehov per shot | 🟡 | V | Shot list-modul er omfattende (`ShotList*.tsx` × 7) |
| 91 | Kontinuitetsnotater | 🟡 | V | `ShotDetailPanel.tsx`, `continuityStrip.smoke.test.ts` |
| 88/89 | NDA-tilgang + vannmerking | ⬜ | V | Vannmerking finnes kun i andre moduler (galleri/showcase), ikke for manus |
| 84, 87, 90, 92 | — | ⬜ | I | Ikke funnet |

## A8. Lokasjoner, utstyr og rekvisitter (93–104)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 93 | Lokasjonsgalleri | 🟡 | V | `rr_list_locations`, `LocationAnalysisDialog.tsx` |
| 97 | **Dobbeltbooking-sperre** | ⬜ | V | `equipment_bookings` har datoer + indeks, men **ingen** EXCLUDE-constraint og ingen overlappsjekk i kode. Bekreftet |
| 98 | QR inn/ut-skanning | 🟡 | V | `equipment_checkouts`-tabell + `QrCameraScanner.tsx` finnes — men ikke koblet |
| 101 | Rekvisitt-sjekkliste | 🟡 | V | `rr_list_props` |
| 103/104 | Kostyme + sminke/hår | ⬜ | V | Ordene finnes kun som crew-avdelinger og HMU-innkallingstider i callsheet — ingen modul |
| 94–96, 99, 100, 102 | — | ⬜ | I | Ikke funnet |

Punkt 97 og 98 hører tettere sammen enn backloggen antar: `equipment_checkouts` og QR-skanneren
er allerede på plass, så sporingspakken mangler i praksis bare overlappsperren.

## A9. Budsjett og økonomi (105–116)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 105 | Budsjett-onboarding | ⬜ | V | `role_room_budget_items` + `role_room_budget_categories` finnes; ingen onboarding |
| 106 | Maler m/norske kategorier | 🟡 | V | `135_budget_categories.sql` finnes — kategoristrukturen er der, malene ikke |
| 107 | Avviksvarsling | 🟡 | I | 51 filer nevner avvik |
| 108 | Valutastøtte | 🟡 | V | `casting_projects.currency` default `'NOK'` |
| 109 | MVA per linje | 🟡 | I | 41 filer |
| 110 | Kvittering-OCR | 🟡 | I | 24 filer |
| 113 | Insentivberegning | ⬜ | V | Null treff |
| 116 | Honorarkalkulator | 🟡 | I | 26 filer nevner tariff/honorar |
| 111, 112, 114, 115 | — | ⬜ | I | **114** (NFI-eksport) ikke funnet |

## A10. Klient-samarbeid og godkjenninger (117–128)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 117 | Forfall/alder/eskalering | 🟡 | V | `due_at` finnes + cron-indeks `idx_rr_reviews_unpublished_due`. Eskaleringen mangler |
| 119 | Versjonerte, låste godkjenninger | 🟡 | V | `published_at` gir draft/publisert-gating, men ikke versjonslåsing |
| 120 | Tidskodede klientkommentarer | ✅ | V | `timestamp_seconds` i kommentartabellen |
| 123 | Juridisk godkjenningslogg | 🟡 | V | `decision_by_user_id`, `decision_at`, `decision_reason` finnes på review-raden |
| 124 | Brief m/endringslogg | 🟡 | V | `mobile-brief/`-modul med `briefDraftPersistence.ts`, `useBriefCollaboration.ts` |
| 128 | Flere klientkontakter | 🟡 | V | `role_room_client_input`-migrering |
| 118, 121, 122, 125–127 | — | ⬜ | I | Ikke funnet |

Godkjenningsdomenet har mer datamodell enn backloggen forutsetter — `decision_*`-feltene betyr at
punkt 123 (juridisk logg) er nær gratis, slik backloggen selv gjetter.

## A11. Team, tilgang og kommunikasjon (129–138)

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 129 | **Granulære tilgangsroller** | ✅ | V | `role-room-project-tab-config-routes.ts` (543 l.): `view`/`manage` per fane, bruker- > rolle- > plattform-presedens. `casting_user_roles.permissions JSONB` |
| 130 | Gjeste-tilgang m/utløp | ⬜ | V | 1 treff, ikke Role Room |
| 131 | Crew-database | 🟡 | V | `CrewManagementPanel.tsx`, `CrewCalendarPanel.tsx`, `technicalCrew.ts` |
| 133 | @-mentions | 🟡 | V | `GlobalMentionHelper.tsx` + 51 filer |
| 134 | Aktivitetslogg/audit | 🟡 | V | `role-room-ai-audit.ts`, `0043_role_room_ai_governance.sql` — audit finnes for AI, ikke generelt |
| 136 | Varslingsinnstillinger | ⬜ | V | Finnes for lead-map, ikke for Role Room |
| 137 | Kommentartråder per modul | 🟡 | V | Kun på reviews |
| 132, 135, 138 | — | ⬜ | I | Ikke funnet |

## A12. MCP, API og integrasjoner (139–150)

Denne kategorien er lest i sin helhet. Skillet mellom de to API-flatene er avgjørende:
`/v1`-REST-API-et (`role-room-integrations-v1-routes.ts`, 2771 l.) er modent, mens
MCP-flaten (`role-room-mcp-routes.ts` + `-registry.ts`, 937 l.) er bevisst «read-first».

| # | Punkt | Status | K | Funn |
|---|-------|--------|---|------|
| 139 | Strukturert auth-feil | 🟡 | V | MCP returnerer allerede strukturerte JSON-RPC-feil (−32001/−32003), `WWW-Authenticate` etter RFC 9728 og `data.code`. **Men:** `tools/list` filtrerer på scope *og* modus, så et verktøy kan være usynlig for nøkkelen — og kallet gir da −32601 «Ukjent verktøy». Det er trolig den observerte «Tool not found» |
| 140 | Total + paginering | ⬜ | V | Alle 30+ list-verktøy returnerer bar array med hardkodet `LIMIT`. Ingen `total`, ingen offset/cursor |
| 141 | List/get/delete drafts | ⬜ | V | 5 skriveverktøy (`rr_draft_task`, `rr_draft_budget_item`, `rr_request_review`, `rr_draft_client_material`, `rr_draft_assignment`) — ingen tilsvarende list/get/delete |
| 142 | Webhooks | ✅ | V | 3 events + admin-CRUD + dispatch + outbox-tabell. **Kan lukkes** |
| 143 | MCP-skriving flere entiteter | 🟡 | V | 5 draft-verktøy finnes som mønster å utvide |
| 144 | Rate limits + Retry-After | 🟡 | V | Token-bucket per nøkkel finnes, returnerer `retryAfterSeconds` i feil-data — men **ingen `Retry-After`-header**, og bøtta er in-memory (overlever ikke restart) |
| 145 | Idempotens-nøkler | 🟡 | V | Fullt implementert på `/v1` (påkrevd header, unik indeks, 409 konflikt/parallell, replay-header). **Fraværende på MCP** |
| 146 | `updated_since`-filter | ⬜ | V | Ingen av list-verktøyene tar tidsfilter |
| 148 | Lagringsintegrasjon | 🟡 | V | Google Drive-artefakter + R2/B2-speiling finnes |
| 149 | Toveis kalendersynk | 🟡 | V | `rr_google_artifacts_calendar_event` finnes |
| 150 | API-dok + sandbox | ⬜ | V | Kun `GET /mcp/manifest`. Ingen OpenAPI-spec, ingen sandbox |
| 147 | Regnskapsintegrasjon | ⬜ | I | Ikke funnet |

---

## Revidert P0-liste

Av backloggens 18 P0-punkter er **3 i praksis ferdige**, **7 vesentlig mindre enn antatt**, og
**8 bekreftet som beskrevet**.

### Kan lukkes eller nedgraderes

| # | Backlogg | Revidert |
|---|----------|----------|
| 67 | P0/L — «mangler helt» | ✅ Bygget. Kun 68s lest-kvittering gjenstår (S) |
| 129 | P0/L — «fundamentet» | ✅ I hovedsak bygget. Migreringsargumentet faller bort |
| 28 | P0/L — «størst enkeltgevinst» | ✅ I hovedsak bygget |
| 145 | P0/S — «bygg idempotens» | 🟡 Gjenbruk `/v1`-motoren på MCP (mindre) |
| 139 | P0/S | 🟡 Egentlig et scope/modus-synlighetsproblem i `tools/list`, ikke feilformat |
| 142 | P1/M | ✅ Ferdig — kan strykes |
| 12 | P2/S | 🟡 Allerede lenger enn punkt 11 |

### Bekreftet som beskrevet — dette er den reelle P0-listen

| # | Punkt | Innsats | Merknad |
|---|-------|---------|---------|
| 35 | GDPR-autosletting | M | **Høyeste reelle risiko.** Kun brukerinitierte rettigheter finnes |
| 140 | Total + paginering (MCP) | S | 30+ verktøy, samme endring |
| 141 | List/get/delete drafts | S | 5 skriveverktøy uten oppryddingsvei |
| 150 | API-dok + sandbox | M | Ingen OpenAPI for `/v1` |
| 17 | Strukturert alder/kjønn | S | Fritekstfelter bekreftet |
| 97 | Dobbeltbooking-sperre | M | Ingen overlappsjekk. `equipment_checkouts` + QR finnes alt |
| 11 | Prosjekttype påkrevd | S | Nullable uten validering |
| 58 | Sjekkliste-maler | M | Null treff |
| 60 | Envegs kalendersynk | S | Null treff for iCal/ICS |
| 105 | Budsjett-onboarding | S | Tabeller finnes, onboarding ikke |
| 82 | Manus-parsing → scener | M | Parser finnes; **persisteringen** mangler (ikke L, som antatt) |
| 136 | Varslingsinnstillinger | S | Finnes for lead-map, ikke Role Room |
| 47 | Buyout-felter | M | Kun enum-verdi, ingen felter |
| 42 | BankID-signering | M | Google-signering finnes, BankID ikke |

### Forslag til rekkefølge

1. **GDPR-autosletting (35)** alene først — eneste punktet med regulatorisk eksponering, og det
   eneste stedet kartleggingen fant *mindre* enn backloggen antok.
2. **API-hygiene (140+141+150)** — fortsatt en god sprint, men 139 og 145 krymper den, og 142
   faller ut. Nærmere to dager enn en uke.
3. **Datamodell-punktene (17+11+47)** — migreringskostnaden vokser reelt her, i motsetning til 129.
4. **Ferdigstill det som er 90 %** — 68 (lest-kvittering), 97 (overlappsperre), 82 (persistering).
   Høyest verdi per innsats i hele listen, fordi grunnarbeidet allerede er gjort.

---

## Levert etter kartleggingen

| # | Punkt | Hva som ble bygget |
|---|-------|--------------------|
| 35 | GDPR-autosletting | `role-room-retention-service.ts` + migrering 0443. Fire kategorier (utløpt samtykke, avviste kandidater, avsluttede prosjekter, utløpte delingslenker) med frister i `role_room_retention_policies`, juridisk hold, revisjonsspor og daglig cron. **Tørrkjøring inntil `RR_RETENTION_ENFORCE=true`** — fristene mangler fortsatt juridisk vurdering |
| 140 | Total + paginering | Alle 20 MCP-list-verktøy tar `limit`/`offset` og returnerer `pagination` med `total` og `hasMore`. Rad-nøkkelen er uendret, så endringen er additiv |
| 141 | List/get/delete drafts | `rr_list_drafts`, `rr_get_draft`, `rr_delete_draft`. Ser kun rader med agent-markør som fortsatt er upubliserte — produsentdata kan ikke slettes. Migrering 0444 gir utdannings-oppgaver samme markør |
| 150 | API-dok + sandbox | OpenAPI 3.1 på `/api/integrations/v1/role-room/openapi.json` med drift-test mot ruteren, samt `integration-v1-guide.md`. **Isolert sandbox gjenstår** — guiden dokumenterer testkonto-mønsteret som finnes i dag |
| 17 | Strukturert alder/kjønn | Migrering 0445: `playing_age_min/max` (speiler `talents`-navnene for matching) + `gender_options TEXT[]` med vokabular håndhevet av CHECK. Backfill parser entydige former; `voksen` og omvendte spenn står igjen som NULL framfor å gjettes |
| 11 | Prosjekttype påkrevd | Migrering 0445: NULL backfilles til `video` og merkes `projectTypeBackfilled` for bekreftelse i UI. NOT NULL + trigger som normaliserer eksplisitt NULL — seks kallsteder sender feltet eksplisitt, og en eksplisitt NULL overstyrer DEFAULT |
| 47 | Buyout-felter | Migrering 0446: `role_room_buyout_terms` med territorier, medieflater, periode, eksklusivitet, opsjon og vederlag. Ni CHECK-constraints, hver verifisert mot sin egen feilsituasjon |
| 97 | Dobbeltbooking-sperre | Migrering 0447: trigger som summerer overlappende bookinger mot `quantity` — en EXCLUDE-constraint ville blokkert booking to av fem kameraer. Advisory lock mot samtidighet; halvåpne intervaller så rygg-mot-rygg-utleie går |
| 68 | Lest-kvittering | Migrering 0448: distribusjon + kvittering per mottaker med eget token. Bekreftelsesknapp, ikke sporingspiksel. Status-endepunktet svarer på «hvem må ringes» |
| 82 | Manus → scener | `casting-screenplay-persistence.ts`: opt-in `?persist=true` på import. Scener gjenkjennes på nummer + heading slik at breakdown-arbeid overlever en manusrevisjon |

| 60 | Envegs kalendersynk | Migrering 0449 + ICS-bygger. Token-basert abonnement som kan trekkes tilbake. Datoer leses fra lokale datodeler — `toISOString()` ville flyttet hver opptaksdag én dag tilbake i Europe/Oslo |
| 14 | Rolle-statuspipeline | Migrering 0450: draft → open → auditioning → shortlisted → offered → signed, med begrensede overganger, historikk og gjennomløpstid |
| 105 + 106 | Budsjett-onboarding + maler | Migrering 0451: tre systemmaler (reklame 24 linjer, kortfilm 19, dokumentar 12). Nudgen utløses kun ved reell aktivitet. REST + `BudgetTemplateStarter` i Økonomi → Budsjett → Linjer |
| 58 | Sjekkliste-maler | Migrering 0452: to maler à 18 punkter med frister regnet fra opptaksstart |
| 46 | Utløpsvarsling | Migrering 0453 + cron. Varsler ved 90/30/7/0 dager, én gang per terskel |
| 83 | Scene ↔ karakter ↔ kandidat | Navnekobling som tåler «KARI (V.O.)», flagger ukoblede karakterer, og propagerer cast-endring til opptaksdager |
| 98 | QR inn/ut-skanning | Migrering 0454: kode uten forvekslingstegn, utsjekk begrenset av fysisk beholdning |
| 42 | BankID-signering | **Kun sømmen.** Leverandør-agnostisk datamodell + adapter-grensesnitt + stub. Se under |
| 74 + 80 | AML-sjekk (arbeidstid + barn) | Migrering 0456 + regelmotor. Daglig/ukentlig arbeidstid, hviletid, pause, nattarbeid og kap. 11-grensene for barn. Alder regnes på opptaksdagen; grunnskoleplikt avgjør regelsett; tariff kan utvide grensene og motoren sier hvilken den brukte. **Flate levert** — se under |
| 72 + 84 + 87 + 73 | Stripboard, sidetall, skutt-status, fremdrift | Migrering 0457. Sider i åttedeler som bransjen måler. Dagsoppsummering teller unike karakterer og locations. Fremdrift måles i sider, med strøkne scener holdt utenfor |
| 114 | Finansiør-eksport | Migrering 0458 + CSV-eksport. **NFI-kartleggingen er ukontrollert** (`verified = FALSE`) — se under |

**114 — hva researchen endret.** Den opprinnelige antakelsen var at oppgaven er å gjengi
NFIs kodeliste riktig. Det er ikke kravet. NFIs veileder for prosjektregnskap sier at
«regnskap skal føres i henhold til kontoplan i godkjent kalkyleskjema … i samsvar med
kalkyle/budsjett og kontoplan som ble brukt da søknad ble sendt inn».

Kravet er altså **intern konsistens over tid**, ikke samsvar med én fasit. Det flytter hvor
risikoen ligger: den farligste feilen er ikke en gal postkode, men en kontoplan som endrer
seg stille etter innsending — det oppdages først ved revisjon, og revisorbekreftet regnskap
kreves over gitte beløpsgrenser. Derfor fryses eksporten ved innsending (migrering 0459),
og `compareToSnapshot` skiller nøkternt mellom endrede beløp (normalt) og endret struktur
(brudd på kravet).

`verified = FALSE` står fortsatt. Egress-policyen i utviklingsmiljøet blokkerer `nfi.no` og
`vikenfilmsenter.no`, så selve kalkyleskjemaet lot seg ikke hente. Postkodene må kontrolleres
mot malen og `verified` settes til `TRUE` — men kravet de skal oppfylle er nå kjent, og
arkitekturen svarer på det.

**42 er bevisst ikke fullført.** Beslutningsnotatet § 8 sier at leverandør «velges først
etter sammenligning», med RFQ til Idura, Signicat og Scrive, og produksjon først ved 10
ekte brukere. Å hardkode en integrasjon nå ville foregripe den beslutningen og låse oss
til nettopp det notatet advarer mot. Sømmen gjør leverandørvalget til en adapter framfor
en ombygging, og stub-adapteren lar resten av flyten bygges ferdig i mellomtiden — som er
notatets egen «Fase 0». Gjenstår: velg leverandør, implementer adapteren, sett
`RR_SIGNING_PROVIDER`.

To rettelser til kartleggingen kom fram under arbeidet, begge i A12:

- **146 (`updated_since`-filter)** er allerede bygget på `/v1` som `updatedAfter` på
  prosjektlisten. Gjelder fortsatt for MCP-flaten.
- **144 (rate limits + Retry-After)** er bygget på `/v1` med `x-rate-limit-limit`,
  `x-rate-limit-remaining` og `retry-after`. Det er MCP-flaten som mangler headeren.

Mønsteret fra hovedfunnet gjentar seg altså: `/v1`-REST-API-et er modent, og gapet
ligger nesten alltid på MCP-flaten.

## Verifisering mot Økonomi-flaten i Story Arc Studio

Før finansieringsskjermen ble montert, ble den kontrollert mot økonomien som allerede
finnes. Veien dit: Story Arc Studio → Økonomi-kortet → fane 12 → `ProducerBudgetTabs`
→ `ProjectEconomyHub` (Oversikt | Budsjett | Godkjenning, med under-faner Linjer,
Avtaler & fordeling, Sync & ramme, Cashflow, Rapporter).

Tre ting ble kontrollert:

1. **Samme tabell.** Økonomi-fanen skriver til `role_room_budget_items`
   (`role-room-routes.ts`), og både `buildFundingExport` og
   `getApplicationReadiness` leser fra den samme tabellen. Tallene i søknaden er
   altså de tallene produsenten allerede har ført — ingen parallell inntasting.

2. **Samme kategorivokabular.** Kontrollert i Postgres 16 ved å kjøre migrering 135,
   0451 og 0458 mot en tom base: 30 systemkategorier, 30 kartlegginger, null i begge
   retninger uten motpart. Alle 55 mal-linjene i de tre budsjettmalene treffer en
   kartlagt kategori. Uten dette ville hver linje havnet i `unmapped` og eksporten
   blitt en liste med nuller.

3. **Ingen overlapp.** `ProjectEconomyHub`, `EconomyCashflowPanel` og
   `EconomyReportsPanel` nevner ikke finansiering, tilskudd eller søknad i det hele
   tatt. Finansiering var et hull, ikke en dublett.

Kontrollen fant to manglende koblinger, begge nå tettet:

- **Budsjettmalene var usynlige.** `listBudgetTemplates` og `applyBudgetTemplate`
  fantes bare via MCP — ingen REST-rute, ingen UI. En produsent måtte skrive inn alle
  24 linjene selv. Det er direkte oppstrøms for tilskudd: tomt budsjett gir en søknad
  med nuller.
- **Finansieringsskjermen var ikke montert.** Den ligger nå som egen fane
  «Finansiering» mellom Budsjett og Godkjenning — den rekkefølgen arbeidet går i, og
  egen fane framfor under-fane fordi søknadsfrister har egen tidslinje.

## 74 + 80 — AML-flaten

Regelmotoren og vakttabellen fantes fra før, men verifiseringen viste at kjeden var
brutt på to måter som begge gjorde funksjonen verre enn fraværende.

**Ingenting skrev til `role_room_work_shifts`.** Tabellen ble opprettet i migrering
0456 og bare lest. `rr_work_time_check` svarte derfor «0 brudd» på ethvert prosjekt —
ikke fordi dagene var lovlige, men fordi det ikke fantes en eneste vakt å regne på. Et
etterlevelsesverktøy som er grønt av mangel på data er farligere enn et som ikke
finnes: det andre leter man opp, det første stoler man på.

Løsningen er `role-room-work-shift-service.ts`, som lager vaktene fra opptaksdagen —
crew fra bemanningen, cast via scene → karakter → rolle → tildelt kandidat. Tidene
hentes fra dagens egne `callTime`/`wrapTime`, som produsenten allerede har fylt inn;
å spørre om dem på nytt ville gjort sjekken til enda et skjema. Migrering 0462 gjør
`data`-kolonnen de ligger i til en migrert kolonne framfor en som `ensureSchema`
tilfeldigvis rakk å legge til.

Rapporten skiller nå fire tilstander — `no_data`, `partial`, `violations`, `ok` — og
«ingen data» slår ut **før** «ingen brudd». Dekningen står øverst i panelet, ikke
funnene, og dager uten vakter får en knapp framfor en advarsel.

**Nattarbeidsvinduene ble lest i serverens tidssone.** Funnet under verifiseringen mot
Postgres: `touchesClockWindow` brukte `getHours()`. Loven sier «kl. 20.00» om den
norske klokka, men Render og containere kjører UTC — en wrap kl. 21.30 norsk sommertid
ble lest som 19.30 og falt utenfor forbudet i § 11-3. Bruddet forsvant stille, og
ingen leter etter et funn som aldri kom.

`role-room-oslo-time.ts` slår opp Europe/Oslo per tidspunkt via ICU, så sommertid
håndteres uten hardkodet offset. Regelmotoren og vaktgenereringen bruker den begge, og
regresjonsvernet ligger som tester på både 20–06- og 23–06-vinduet, sommer og vinter.

Flaten ligger i Kalender → Operativ produksjonsstyring, under opptaksdagene. Ikke i en
egen fane: arbeidstiden bestemmes når dagene planlegges, og et etterlevelsesvarsel man
må lete etter blir lest for sent.

## 72 + 84 + 87 — stripboardet

Kartleggingen antok en konflikt mellom to implementasjoner. Det var det ikke.

`StripboardPanel` hentet fra `/api/production/:projectId/stripboard`. **Den ruta fantes
ikke noe sted i backend.** Hvert kall feilet, ble fanget av en `console.warn`, og panelet
falt tilbake på `TROLL_STRIPBOARD` — scener fra en annen produksjon, vist som om det var
brukerens egen plan. Skriving gikk til en cache i minnet og overlevde ikke en
oppfriskning. Panelet har `@ts-nocheck`, så ingenting av dette ble fanget av
kompilatoren.

Migrering 0457 var motsatt: ekte tabeller, testet tjeneste, åttedeler, riggetid, strøkne
scener og en «ikke planlagt»-bunke — men bare eksponert via MCP.

Altså en rik UI uten backend ved siden av en solid backend uten UI. De er koblet sammen
nå, ikke valgt mellom.

**`getStripboard` tok utgangspunkt i radene, ikke scenene.** Et importert manus gir
scener uten stripboard-rader, så boardet ville stått tomt etter en import — uten noen vei
til å få scenene inn i det. Spørringen går nå fra `casting_scenes`, og scener uten rad
havner i uplanlagt-bunken med `entryId: null`. Raden lages når scenen legges på en dag.

**Mappingen ligger i `stripboardAdapter.ts`**, uten React- eller MUI-import, av to
grunner: panelet fanger ingen typefeil, og en ren funksjon kan testes. To forskjeller
måtte tas stilling til:

- Backend måler sider i åttedeler, panelet i desimaltall. Konverteringen skjer ett sted.
- Backend skiller `partial` og `omitted` fra `not_shot`. Panelet kjente bare fire
  statuser, og `omitted` ville måttet bli «utsatt» — men en strøket scene kommer ikke
  tilbake i køen. Statusene er lagt til framfor å presses inn i de gamle.

**Demo-fallbacken er fjernet overalt i denne stien** — også for opptaksdager og cast, som
gikk mot de samme ikke-eksisterende endepunktene. Cast følger nå med stripboard-svaret
(karakter → rolle → tildelt kandidat, med samme navnenormalisering som punkt 83), slik at
DOOD-matrisen settes opp mot de samme scenene som stripene. Et tomt stripboard vises som
tomt, og en feil vises som en feil med «Prøv igjen».

### Resten av `/api/production`

`productionWorkflowService` hadde fem kall igjen mot samme ikke-eksisterende API. Alle er
tatt:

| Metode | Kallere | Løsning |
|---|---|---|
| `getCast` | ShootingDayPlanner | Ny rute `GET /projects/:id/cast` — samme utledning som stripboard-svaret, så de ikke kommer i utakt |
| `getCrew` | ShootingDayPlanner, useProductionCrew | Peker på `GET /projects/:id/crew`, som fantes fra før (`casting_crew`) |
| `getLiveSetStatus` | LiveSetMode, useLiveSetSync | `todayProgress` fra fremdriftsruta; øyeblikkstilstand står tom — se under |
| `generateCallSheet` | ingen | Slettet |
| `seedTrollData` | ingen | Slettet |

**Live-set-status var halvparten ekte i første omgang.** `todayProgress` — planlagte og
skutte sider — ligger i stripboardet og fremdriftsberegningen. `currentScene`,
`isRolling` og `todayTakes` sto tomme, med den begrunnelsen at det ikke fantes lagring
for øyeblikkstilstand. **Det stemte ikke,** og er rettet i neste avsnitt.

`generateCallSheet` var verdt å slette framfor å koble: den fylte inn navngitte personer
og telefonnumre som konstanter i koden, og et sykehus. En call sheet som ser ekte ut og
er oppdiktet er verre enn ingen — og call sheet-generatoren i `CallSheetGenerator.tsx`
gjør allerede dette mot ekte data.

`API_BASE = '/api/production'` er nå borte fra filen. TROLL-konstantene står igjen som
eksporterte fixtures, men ingen kodesti faller tilbake på dem lenger.

## On-set-tilstand — lagringen fantes

Påstanden over om at det ikke fantes lagring for øyeblikkstilstand var feil. Den ble
skrevet uten å lete godt nok, og kartleggingen retter den her.

**Det som faktisk finnes:** en hendelsesbasert, offline-først synk. `useLiveSet.ts`
(1021 linjer) fører en logg av `roll`, `cut`, `capture_take`, `set_scene`,
`set_take_status`, `setup_complete`, `advance_scene`, `set_camera` m.fl., med
IndexedDB-kø, idempotente `eventId`-er, sesjoner og ack. Serveren tar imot på
`POST /live-set/events/batch` og lagrer i `legacy_compat_store` (jsonb). Det er en
gjennomtenkt arkitektur for arbeid på location, der nettet forsvinner.

**Det som manglet var en leser.** Loggen ble skrevet, men aldri foldet til tilstand på
serversiden — den fantes bare i den ene klientens egen reducer, av dens egen kø. En
annen enhet, en ny fane, eller den andre live-set-skjermen kunne hente hendelsene uten
å vite hva de betydde.

For **det er to live-set-skjermer**: `components/LiveSetMode.tsx` (4089 linjer, montert
fra Live Set-fanen, bruker hendelsesloggen) og `components/production/LiveSetMode.tsx`
(2017 linjer, montert fra manusvisningen, brukte `productionWorkflowService` og skrev
bare til minnet). Sistnevnte hadde til og med sin egen offline-outbox i localStorage —
som flushet tilbake til minnet.

**Det som ble bygget:** `role-room-live-set-projection.ts`, en ren fold fra hendelser til
tilstand, eksponert på `GET /projects/:id/live-set/state`. Den speiler `liveSetReducer`
i klienten, inkludert guardene — CUT uten ROLL og dobbel ROLL forkastes, fordi loggen
inneholder hendelser reduceren avviste (de skrives før den har sagt ja). To ting utledes
bedre på serversiden:

- **Varigheten** regnes fra ROLL-hendelsens `capturedAt` til CUT-ens, framfor klientens
  egen `Date.now()`. To enheter rapporterer da samme take like langt.
- **Take-id-en** utledes av CUT-hendelsens `eventId`, ikke av en lokal tilfeldig id.
  Skal to lesere være enige om hvilken take som er hvilken, må id-en komme fra noe
  begge ser.

`productionWorkflowService` sine mutatorer sender nå til samme logg med samme
vokabular, og `getLiveSetStatus` leser projeksjonen. Den andre skjermens takes dukker
opp på den første, og omvendt. Take-varigheten var tidligere
`Math.floor(Math.random() * 30) + 20` — et tilfeldig tall i nettopp den loggen man leter
etter målinger i.

**To skjermer for samme ting står igjen som et åpent valg.** Det er ikke lenger en
riktig og en gal — begge leser og skriver samme logg — men det er fortsatt to.

## Metode og forbehold

Kartlagt ved lesing av skjema (`backend/migrations/`), ruter (`backend/server/role-room-*`) og
komponenter (`frontend/client/src/components/role-room/`, 1057 filer).

Alle P0-punkter, hele A12, og alle ✅-merkede punkter er verifisert ved å lese koden.
🟡- og ⬜-punkter merket *I* bygger på søketreff. For disse gjelder at søketreff ikke er bevis
på en fungerende funksjon — flere treff viste seg ved kontroll å ligge i andre CreatorHub-moduler
(vannmerking i galleri/showcase, e-signering i wedding/quotes, varslingsinnstillinger i lead-map).
Slike er ført som ⬜ for Role Room. Motsatt kan et punkt ført som ⬜ på *I*-konfidens vise seg å
finnes under et annet navn; de bør bekreftes før de estimeres.

Kartleggingen sier hva som finnes i koden, ikke om det virker i produksjon. Backloggens
QA-merkede punkter er observert atferd og er derfor beholdt som gyldige observasjoner selv der
koden finnes — punkt 139 er det tydeligste eksempelet, hvor koden ser riktig ut, men den
observerte feilen sannsynligvis kommer fra scope/modus-filtrering et annet sted.

## Sammenslåing av live-set-skjermene

De to skjermene var ikke overlappende — ingen var et supersett:

| | A `components/LiveSetMode.tsx` | B `production/LiveSetMode.tsx` |
|---|---|---|
| Tilstandsmotor | `useLiveSet` — reducer m/guards, IndexedDB-kø | `productionWorkflowService` |
| Kun her | DIT-panel, slate-overlay, sirkeltimer, setup-complete-panel, LIVE/EDIT/REVIEW | Rollerettigheter, realtime/tilstedeværelse, AI-handlinger, kontinuitetsnotater, flerkamera |
| Typechecket | Nei — `@ts-nocheck` | Ja |

A ble valgt som base fordi den eier tilstandsmotoren — `useLiveSet` med guards og
IndexedDB-kø, som serverprojeksjonen er bygget mot. B sine særtrekk lå alle som
selvstendige moduler, så de kunne wires inn framfor å skrives om.

**Portert inn i A:**

- **Rollerettigheter** (`buildCan`). Sjekken ligger i `handleRoll`/`handleCut`, ikke bare
  på knappen — tastatursnarveiene R og T går utenom knappen. Uten oppgitt rolle er alt
  tillatt, slik Live Set-fanen alltid har oppført seg; å defaulte til en snever rolle
  ville låst knapper for alle som kommer inn den veien.
- **Tilstedeværelse** (`useLiveSetRealtime`) som `CREW (n)` i toppbaren. Vises bare når
  socketen faktisk er koblet — «CREW (0)» ville ellers lest som «ingen er her» når det
  betyr «vi vet ikke».
- **AI-handlinger** (`LiveSetAiActions`), med inndata utledet av take-loggen.

**En feil oppdaget under portering:** `shootingDay` fra Live Set-fanen er en
visningsstreng («mandag 15. mars 2027»), ikke en id. Første wiring brukte
`shootingDayId ?? shootingDay` som nøkkel, som ville merket hendelsene med en
lokalisert dato — og serverprojeksjonen filtrerer på nettopp det feltet. Nå brukes bare
den ekte id-en; visningsstrengen brukes fortsatt til etiketten, som er det den er til for.

**Slettet:** `production/LiveSetMode.tsx` (2017 linjer) og
`services/liveSetOutboxService.ts` (222 linjer). Outboxen var B sin egen
localStorage-kø som flushet tilbake til minnet; A har IndexedDB-kø med server-ack.
Mutatorene i `productionWorkflowService` har nå ingen kallere — de står igjen fordi de
skriver til samme logg, men skjermen bruker `useLiveSet`.

**Ikke portert, og verdt å vite:** B sine kontinuitetsnotater bar `shotId`/`takeId` og
`photoUrl`. A sine notater har fritt tag-felt (`NoteTag` er en åpen union, så
kostyme/rekvisitt/sminke passer), men verken kobling til take eller bilde. Det er en
reell funksjonsforskjell, ikke en forglemmelse.

**Mockupene går lenger enn sammenslåingen.** Designet viser live multiview med fire
kamerabilder, audio mixer med kanalfadere, tally, batteri- og lagringstelemetri per
kamera, shot compare og versjonsvisning. Ingen av disse finnes i kodebasen i dag —
`multiview`, `audio mixer` og `shot compare` gir null treff — og de fleste krever
integrasjon mot kamera- og strømmemaskinvare, ikke UI-arbeid. Sammenslåingen er ett
steg mot det designet, ikke designet.


## Godkjenningsflyt på take

Bygget etter mockupene: Review → Approve / Needs Work / Reject → Lock.

**Dette er en tredje akse, ikke en utvidelse av de to som finnes.** Å slå
dem sammen ville vært den nærliggende feilen:

| Akse | Spørsmål | Hvem eier den |
| --- | --- | --- |
| `circle` / `print` | Var dette den beste tagningen? | Script supervisor, på settet |
| Favoritt | Vil *jeg* finne igjen denne? | Hver bruker, privat |
| Godkjenning | Er denne god nok til å gå videre? | Review, etter settet |

En take kan være circled uten å være godkjent, og godkjent uten å være
circled. Favoritter er per bruker — primærnøkkelen inkluderer
`user_id` — mens godkjenningen er én per take.

### Tilstandsmaskinen

`role-room-take-approval-service.ts` eier overgangene. To valg som ikke
er åpenbare:

**Underkjent går bare tilbake til `pending`.** Ikke rett til `approved`.
Ellers ville historikken mistet at noen faktisk vurderte den på nytt —
raden ville sett ut som om den aldri var underkjent.

**Overgang til samme status avvises.** Dobbeltklikk eller misforståelse;
begge er bedre å få vite om enn å skrive enda en rad i historikken for.

Låsen slår ut over alt annet: en låst take tilbyr bare `unlock`, uansett
hvor lovlig overgangen ellers ville vært. Og låsing tilbys ikke før det
finnes en beslutning å fryse — `pending` kan ikke låses.

`needs_work` og `reject` krever begrunnelse. En godkjenning trenger ingen
forklaring; en underkjennelse uten begrunnelse er en beskjed om å gjette
hva som er galt.

### Rutene

```
GET   /api/role-room/projects/:projectId/takes/approvals
GET   /api/role-room/projects/:projectId/takes/approvals/summary
POST  /api/role-room/projects/:projectId/takes/:source/:ref/approval
PUT   /api/role-room/projects/:projectId/takes/:source/:ref/favorite
GET   /api/role-room/projects/:projectId/takes/favorites
```

Hver rad kommer med `availableActions`, slik at skjermen slipper å
reimplementere tilstandsmaskinen for å tegne knappene. Feilkodene
(`note_required`, `illegal_transition`, `locked`, `nothing_to_lock`,
`not_locked`) oversettes til HTTP i rute-laget — **ingen av dem er 500**,
fordi ingen av dem er en serverfeil.

Favorittlisten leser alltid den innloggede brukeren, aldri en oppgitt id.

`applyAction` kjører i transaksjon med `FOR UPDATE` på godkjenningsraden.
To personer som trykker samtidig får ellers hver sin lesning av samme
tilstand, og den siste skriver over den første uten å vite det.

`getApprovalSummary` teller `unreviewed` fra `role_room_take_log`, ikke
fra godkjenningstabellen: en take uten godkjenningsrad ER uvurdert, og en
telling som bare så på tabellen ville rapportert null uvurderte på et
prosjekt der ingen hadde begynt.

### Migrasjon

`0463_role_room_take_approval.sql` — tre tabeller:
`role_room_take_approvals`, `role_room_take_approval_events` (historikk),
`role_room_take_favorites`. `locked_at` og `locked_by` har
`CHECK ((locked_at IS NULL) = (locked_by IS NULL))`: en lås uten eier, or
en eier uten lås, er begge en halvskrevet tilstand.

### Ikke gjort

Frontend-flaten. Rutene og tilstandsmaskinen finnes og er testet, men
REVIEW-skjermen fra mockupene er ikke bygget.
