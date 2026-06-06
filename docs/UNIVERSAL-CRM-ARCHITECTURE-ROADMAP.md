<!-- Multi-agent arkitektur-analyse: 60 verifiserte kapabilitets-/arkitektur-gap, 1 avvist. Kjort 2026-06-01. -->

# Universal CRM — Kapabilitets- & arkitektur-roadmap

## 1. Sammendrag

Universal CRM er i dag et **passivt register**, ikke et relasjonssystem. Den lagrer kontakter og har til og med backend-CRUD for deals, oppgaver, aktiviteter og pipeline-stages — men nesten ingenting av dette er koblet til et brukergrensesnitt, ingen automatikk leser de planlagte datoene, og det finnes ingen eier-/tenant-grense rundt dataene. Modenheten som *fundament for bærekraftig inntekt* er derfor lav: systemet kan ikke trygt holde PII for mer enn én betalende kunde, kan ikke representere gjenkjøp, og kan ikke måle eller drive relasjonen videre.

**Hovedmønsteret** går igjen i alle ni dimensjoner: *infrastrukturen finnes, men den er ikke koblet, ikke eid og ikke automatisert.*

- **Ikke koblet:** Deals-CRUD (`universal-crm-routes.ts:419-534`), task-API (`:623-738`), activity-read (`:540`) og e-postmaler (`:786`) har null frontend-konsumenter. `UniversalCRMDashboard.tsx` (2390 linjer) kaller kun `/customers` og `/stats`. Det meste av et CRM er allerede bygget — men ligger frakoblet.
- **Ikke eid:** Hver eneste spørring kjører `WHERE 1=1` uten `owner_user_id` (`:24, :345, :369, :377, :427`). Dette er den ene blokkeren (seksjon 2).
- **Ikke automatisert:** `scheduled_at`/`due_date` skrives og vises, men ingen cron/worker leser dem (`:587-650`). Maler har GET, ingen send. CRM-en er en notisblokk, ikke en relasjonsmotor.

Et fjerde strukturelt mønster forsterker de tre: **datamodellen er fragmentert og usporet.** Kjernetabellene (`crm_customers`, `crm_deals`, `crm_activities`, `crm_tasks`) finnes ikke i noen migrasjon eller Drizzle-schema (`migrations/schema.ts` har kun `crm_email_templates`); de ble laget out-of-band uten FK, indekser eller constraints. Samtidig finnes en rikere, men **død** parallellmodell (`frontend/shared/crm-schema.ts`, `crm_contacts` med serial-PK, fiken-felter, leadScoring) som ingen route importerer. To divergerende modeller betyr at enhver integrasjonsjobb risikerer å bygge mot en fantommodell.

Konsekvens for inntekt: en fotograf som Simen får i dag verken brakt inn sin eksisterende klientliste (ingen import), sett én kundes fulle historikk (ingen detaljvisning), blitt minnet på en oppfølging (ingen automatikk), eller målt hvilken kanal som faktisk gir betalende kunder (ingen kildeattribusjon). Relasjon→inntekt-løkka er strukturelt brutt.

> Merknad: 1 kandidat-gap ble avkreftet under verifisering. De 44 UX-gapene gjentas ikke her; denne rapporten dekker de 60 kapabilitets-/arkitektur-gapene.

## 2. Den ene blokker-bugen: manglende multi-tenancy / data-isolasjon

**Status: bekreftet — kritisk.** Dette er den ene bugen som må lukkes før alt annet, og den dukker opp i seks separate gap (#1, #4, #6, #11, #12, #13, #14) på tvers av fem dimensjoner fordi den er en *systemisk* feil, ikke en lokal.

**Hva som er galt:** CRM-en er det eneste kundevendte systemet uten tenant-scoping. Gallerier scoper på `photographer_id`, kontrakter på `user_id`, og de fleste tabeller har `owner_user_id` — men `crm_customers`-familien lever utenfor migrasjonssystemet helt uten eier-kolonne. Hver liste-, stats-, get-, update- og delete-spørring filtrerer kun på `profession`/`status`/`search` (`universal-crm-routes.ts:24, :42-50`). `profession` er en **delt kategori, ikke en tenant-nøkkel**. `requireUserSession` (`index.ts:22057`) returnerer `userId`, men den brukes kun som en autentiserings-gate — den kastes, og treffer aldri en `WHERE`-klausul. Frontend sender kun `profession` (`UniversalCRMDashboard.tsx:348`).

**Hvorfor den blokkerer alt annet:**

| Konsekvens | Hvorfor |
|---|---|
| **GDPR-/sikkerhetsbrudd** | Enhver innlogget bruker kan lese, redigere og **slette** (hard delete, `:319-330`) enhver annen fotografs kunder, deals, notater og PII. I det øyeblikket kunde nr. 2 signerer, lekker hele pipelinen. |
| **Alle tall blir meningsløse** | Stats (`:365`), funnel, LTV, prognose og admin-oversikt (`index.ts:46344`) summerer på tvers av *alle* tenants. Et hvert rapportlag som bygges nå vil være aktivt feil og utrygt. |
| **Integrasjon umulig** | Du kan ikke mappe en Google-/PowerOffice-konto til en kunde hvis kunder ikke er eid. `owner_user_id` er den billige forutsetningen som gater hele integrasjonslaget. |
| **Retention ugyldig** | LTV, repeat-rate og henvisningsgraf er både meningsløse og farlige hvis de aggregerer på tvers av tenants. |

**Hvorfor den er billig å fikse:** `userId` er allerede i hånden i hver handler. Dette er *wiring, ikke redesign*. Mønsteret finnes allerede å kopiere — `dance-admin-ops-service.ts` scoper hver spørring på `owner_user_id`.

**Anbefaling (må lande først, ev. sammen med den canonical migrasjonen i bølge 1):**
1. Legg til `owner_user_id` (text, indeksert) NOT NULL på `crm_customers`, `crm_deals`, `crm_activities`, `crm_tasks`.
2. Backfill fra opprinnelig opprettende sesjon.
3. Injiser `WHERE owner_user_id = $session.userId` i hver list/stats/get/update/delete/aggregat-spørring; sett kolonnen på hver INSERT; scope barn via JOIN.
4. Sentraliser opprettelse i én eier-bevisst helper (også de kryssmodul-skriverne på `communication-routes.ts:2312` og `google-people-routes.ts:180`); fjern den duplikate `GET customers/:id` (`:83` og `:202`); hold admin-aggregat plattform-scopet.
5. Langsiktig: aktiver RLS.

## 3. Prioritert roadmap — 4 bølger

Sortert på **inntektseffekt × innsats**. Hver bølge bygger på den forrige: man kan ikke trygt rapportere før data er eid, ikke vise en tidslinje før detaljvisningen finnes, og ikke automatisere oppfølging før det finnes et livssyklus-/event-lag.

---

### Bølge 0 — Fundament: eierskap + sporet schema (må lande først)

**Hvilke gap:** #1, #4, #6, #11, #12, #13, #14 (isolasjon), #30, #60 (sporet schema), #56 (reconcile død modell).

**Hvorfor de henger sammen:** Isolasjon krever en `owner_user_id`-kolonne; å legge til en kolonne trygt og repeterbart krever at tabellen er i migrasjonssystemet; og man kan ikke vite hvilken tabell man migrerer før den døde parallellmodellen er ryddet. Dette er én sammenhengende grunnmursjobb.

**Hva det muliggjør:** Alt. Uten dette er hver senere feature enten et sikkerhetsbrudd eller et feil tall.

| Gap | Severity | Inntekt | Innsats | Anbefaling |
|---|---|---|---|---|
| #1 Ingen multi-tenant-isolasjon på kunder | critical | high | medium | `owner_user_id` NOT NULL på alle crm-tabeller; filtrer hver spørring; eier-indekser; RLS langsiktig |
| #4 Deal-aggregat uten eier-scope | critical | high | medium | `owner_user_id` på `crm_deals`; scope hver stat/liste/aggregat |
| #6 Tasks ikke eier-scopet | critical | high | medium | Eier-filter på alle task/kunde-reads; backfill; må lande før/med inbox |
| #11 Alle CRM-spørringer globale | critical | high | medium | Tråd `userId` (allerede i hånd) inn i hver query; forutsetning for ekstern sync |
| #12 Hvem som helst kan lese/slette andres kunder | critical | high | large | `owner_user_id`/`org_id` NOT NULL + backfill + scope alt; uten det kan ikke CRM holde ekte PII |
| #13 Ingen per-owner-isolasjon (retention) | critical | medium | medium | Mandatory `owner_user_id`-predikat; LTV/repeat-rate er farlige uten |
| #14 Rapport-aggregat ignorerer eier | critical | medium | large | Scope hvert aggregat før rapporter bygges; ellers lekker/blander analyse tall |
| #30 Kjernetabeller utenfor migrasjon | high | medium | medium | Canonical migrasjon m/ FK, eier-kolonne, indekser under migrate-and-verify |
| #60 `crm_customers`-schema usporet | medium | low | medium | Reverse-engineer til migrasjon + Drizzle; legg så eier/normalisering/consent som ekte migrasjoner |
| #56 To divergerende datamodeller; rik modell er død kode | medium | medium | large | Velg én modell: slett `crm-schema.ts` eller migrer `crm_customers` under Drizzle m/ regnskapsfelter; reconcile FØR regnskapsprosjektet |

---

### Bølge 1 — Kjerne-CRM blir reelt: detaljvisning, tidslinje, deals, task-inbox

**Hvilke gap:** #2, #17, #18, #31, #35 (kontaktkort/tidslinje), #3, #19, #32, #46 (deals→UI), #5, #37 (task-inbox), #22, #50 (e-post i CRM).

**Hvorfor de henger sammen:** Alt dette kretser rundt **én ny flate — kundedetalj-visningen** — som ikke finnes i dag (`selectedCustomer` på `:140` driver kun dialoger, aldri et profilskjerm). Tidslinjen, deal-listen pr kunde, quick-log, e-post-tråden og «sist kontaktet»-signalet henger alle på samme drawer. Deals må modelleres som enheten pipelinen opererer på (ikke `customer.status`) for at en gjenkjøpende klient kan vises som to separate muligheter.

**Hva det muliggjør:** For første gang kan Simen åpne én kunde og se hele bildet, sende en e-post som blir logget, og se «hva må gjøres i dag». Dette er terskelen mellom «notisblokk» og «CRM».

| Gap | Severity | Inntekt | Innsats | Anbefaling |
|---|---|---|---|---|
| #2 Ingen kontaktdetalj-visning | critical | high | large | `CustomerDetailDrawer` på kortklikk; aggregat-endpoint `GET /customers/:id/overview` som joiner deals/tasks/invoices/meetings/activities + gallerier/kontrakter i én round-trip |
| #5 Ingen task-inbox («hva må gjøres i dag») | critical | high | large | Task Inbox-panel mot `GET /tasks` gruppert Forfalt/I dag/Denne uka/Uten dato; header-badge med antall. Høyeste enkelt-leverage: uten den råtner leads i stillhet |
| #3 Deals helt frakoblet (CRUD uten UI) | critical | high | large | Bygg deals-lag: deal-liste/board pr kunde + global pipeline-board mot `crm_deals` (ikke `customer.status`), m/ value/probability/close; create/edit/move-dialoger mot eksisterende endpoints |
| #22 CRM har ingen e-post-send/logg/tråd | high | high | large | Monter Kommunikasjon-tab i kundedetalj mot eksisterende `/communication/email/threads`+`/reply`+`/drafts` scopet på `customer.email`; hver send POSTer `context/log-activity`. Gjenbruk OAuth-pathen, ikke ny transport |
| #17 Tidslinje skrives men rendres aldri | high | high | medium | Render revers-kronologisk tidslinje i detaljvisningen mot `/activities?customer_id=`; flett aktiviteter + deal-stage-overganger + faktura + kontrakt + galleri i én strøm m/ MUI-ikon pr type |
| #19 Pipeline sporer `customer.status`, ikke deals | high | high | large | Modeller pipeline rundt deals så gjenkjøp = to distinkte deals; kundepost består |
| #18 Ingen manuell notat/anrop/møte-logg fra kortet | high | high | medium | Quick-log-komposer (Notat/Anrop/Møte/E-post) øverst i tidslinjen mot `POST /activities` |
| #37 Ingen overdue-håndtering på tasks | medium | high | medium | `count(*) FILTER (WHERE status='pending' AND due_date < now())` i stats; due_today/overdue-flagg; rødt i inbox |
| #50 E-postmaler er foreldreløse | medium | medium | medium | Koble maler inn i send-komposeren m/ `{{merge}}`-interpolering; CRUD + use_count; adopter eller slett `EmailCRMBridge.tsx` |
| #32 `deal.stage` er fritekst, frakoblet `crm_pipeline_stages` | high | medium | medium | La `crm_deals.stage` referere `crm_pipeline_stages` (stage_id); merk stages won/lost; ellers drifter verdier mot hardkodede konstanter |
| #46 Deal-livssyklus ufullstendig (ingen DELETE/single-GET/detalj) | medium | medium | medium | Legg `GET /deals/:id` + `DELETE /deals/:id` + deal-detalj m/ aktiviteter/tasks/stage-historikk |
| #31 Notater er ett overskrivbart felt | high | medium | small | Migrer fritekst-notater til tidsstemplede `crm_activities` av type 'note'; behold `notes` kun som pinned sammendrag |
| #35 Ingen «sist kontaktet»/staleness-signal | medium | high | small | På hver activity-insert: `UPDATE crm_customers.last_contact = now()`; vis «sist kontaktet for N dager siden» + overdue-chip |

---

### Bølge 2 — Relasjonsmotoren slår seg på: automatikk, livssyklus, gjenkjøp, levering

**Hvilke gap:** #9, #21, #38, #47, #52 (automatikk/oppfølging), #8, #24 (livssyklus/rebook), #20, #53, #54 (win/loss-historikk), #48 (task→activity-kohesjon), #7 (fiks no-op-send), #16 (faktura/møte-persistens).

**Hvorfor de henger sammen:** Bølge 1 gjorde CRM-en *brukbar manuelt*. Bølge 2 gjør den *selvgående*. Dette krever to ortogonale akser: en post-leverings-livssyklus (`lifecycle_stage`, `last_delivered_at`, `next_rebook_due_at`) **og** et automatikk-/scheduler-lag som faktisk leser `scheduled_at`/`due_date`. Win/loss-fakta (`won_at`/`lost_at`/stage-historikk) må fanges *nå*, fordi de ikke kan backfille — de er også forutsetningen for Bølge 3-rapportene.

**Hva det muliggjør:** Automatisk anmeldelses-forespørsel, jubileums- og rebook-e-post. For en fotograf er ~50-70% av bærekraftig inntekt gjenkjøp (bryllup/familie/nyfødt) — i dag kan CRM-en ikke engang liste «klienter jeg leverte for 11 måneder siden».

| Gap | Severity | Inntekt | Innsats | Anbefaling |
|---|---|---|---|---|
| #9 Ingen automatikk-motor (planlagte ting fyrer aldri) | critical | high | large | Scheduled job som skanner forfalte tasks/activities og sender påminnelser + `POST /email-templates/:id/send` mot eksisterende transport. Høyeste retention-leverage |
| #8 Ingen repeat/rebook-livssyklus | critical | high | large | Splitt i acquisition-pipeline + post-leverings-livssyklus (delivered→review-requested→rebook-window→repeat/dormant→win-back); `lifecycle_stage`+`last_delivered_at`+`next_rebook_due_at`; stats-kort repeat-rate/due-rebook |
| #21 Ingen påminnelse-/varsel-levering | high | high | large | Gjenbruk `casting-reminder-runner.ts`-mønsteret: CRM follow-up-sweep på `due_date <= now()`; `last_reminded_at`-throttle (speil `ROLE_ROOM_*_REMINDER_REPEAT_HOURS`) |
| #7 Generisk e-post-send er stille no-op | critical | high | medium | Rut handleren gjennom den fungerende `gmail.users.messages.send`-pathen (som `/reply`), ELLER slett aliaset. «Queued» som aldri sendes er verre enn en feil |
| #38 Ingen automatikk-regler ved stage/lead-intake | medium | high | large | `crm_automation_rules` (trigger+stage): ny lead → «Svar innen 24t»-task; stage-endring → neste-steg-task. Konfigurerbar pr profesjon |
| #24 Ingen jubileum/rebook/win-back-flate | high | high | medium | «Action queue» på dashboard: klienter i rebook-vindu, ett-års leverings-jubileer, dormante >N mnd — hver m/ ett-klikks templated outreach |
| #52 Ingen onboarding-sekvens | medium | medium | medium | Templated onboarding-playbook ved konvertering til active (velkomst, spørreskjema, prep-guide); mater review→henvisning-løkka |
| #47 Ingen gjentakende oppfølginger | medium | medium | medium | `recurrence`-kolonne (none/weekly/monthly/quarterly) + snooze; spawn neste instans ved fullføring |
| #20 Ingen win/loss-fangst (`won_at`/`lost_at`/stage-historikk) | high | high | medium | `lost_reason`, `won_at`/`lost_at` + `crm_deal_stage_history` skrevet på hver stage-PUT |
| #54 Ingen pipeline-velocity / stage-aging | medium | medium | large | Stage-history-tabell (deal_id, from_stage, to_stage, changed_at) på hver PUT; kan ikke backfilles — kostnaden vokser daglig |
| #53 Ingen win/loss-årsak | medium | medium | medium | `loss_reason`-enum (pris/timing/konkurrent/no-response/scope) ved closed_lost + breakdown-rapport |
| #48 Task-fullføring logger ingen activity | medium | medium | small | Auto-insert `crm_activities` 'Completed: <title>' på fullføring; holder nextFollowUp/recentActivities korrekt |
| #16 Faktura/møte/lead-intake mangler persistens | high | high | large | Eier-scopede faktura-/møtetabeller + endpoints; server-side public lead-intake m/ single-use tokens (møter ligger i dag kun i `localStorage`, `:196`) |

---

### Bølge 3 — Inntektsintelligens + integrasjon + dataportabilitet

**Hvilke gap:** #10, #25, #36, #41, #42, #43, #55 (rapportering), #23, #39, #40 (henvisning/NPS/LTV), #26, #27, #44, #57, #58 (integrasjonslag), #28, #29, #33, #34, #59 (import/eksport/kvalitet), #15, #45 (audit/soft-delete), #49, #51 (SMS/inbound).

**Hvorfor de henger sammen:** Rapporter krever de immutable faktaene som Bølge 2 begynte å fange (`won_at`, stage-historikk, source). Integrasjonslaget krever eierskapet fra Bølge 0. Import/eksport er adopsjons- og tillits-jobben som gjør CRM-en til kundens *system of record*. Disse er bevisst sist fordi de bygger på alt under — men #28 (import) og #29 (eksport) har uvanlig høy ROI relativt til innsats og kan trekkes tidlig hvis adopsjon haster.

**Hva det muliggjør:** Simen ser hvilken kanal som gir betalende kunder, hvilke klienter som er verdt white-glove, og kan både bringe inn og ta ut sin data. En lukket deal blir til gjenkjent inntekt via regnskaps-adapter.

| Gap | Severity | Inntekt | Innsats | Anbefaling |
|---|---|---|---|---|
| #10 Ingen inntekts-realiserings-modell | critical | high | large | `won_at`/`lost_at`/`closed_at` stemplet ved stage-overgang + realisert-inntekt-kilde (betalte fakturaer); skill pipeline-verdi / booket / innkrevd |
| #28 Ingen CSV/kontakt-import | high | high | large | Upload→kolonne-mapping→per-rad-validering→dedupe→staged commit m/ import-rapport. Største adopsjonsblokker |
| #29 Ingen data-eksport/portabilitet | high | high | medium | `GET /export` (CSV+JSON) eier-scopet; gjenbruk `nextrole-gdpr.ts:175`-mønsteret; lav innsats, høy tillit |
| #42 Ingen vektet inntektsprognose | medium | high | small | Forecast-endpoint `SUM(value*probability/100)` for åpne deals bucket'et på `expected_close_date`-måned. Nær-triviell query på eksisterende kolonner |
| #41 Kilde-ROI umulig | medium | high | medium | `GROUP BY source`; join deals→customers for won-revenue og win-rate pr kilde. Vurder å denormalisere `source` på `crm_deals` |
| #25 Ingen konverterings-/funnel-rapport | high | high | medium | `/funnel`-endpoint: pr stage entered/advanced/lost + total konvertering; én GROUP BY over `crm_deals.stage` |
| #40 Ingen LTV-mekanikk | medium | high | medium | Per-kunde LTV (won deals + betalte fakturaer/gallerier) + booking_count + first/last_booking_at; segmentér VIP vs reaktivering |
| #43 Ingen LTV/repeat-revenue-visning | medium | high | medium | Per-kunde LTV + «topp kunder etter livstidsinntekt» + «ingen booking på 6 mnd» |
| #23 Ingen henvisnings-sporing | high | high | medium | `referred_by_customer_id` (self-FK) + attribusjons-view; valgfri referral-kode. Word-of-mouth er #1-kanalen |
| #39 Ingen NPS/anmeldelse-fangst | medium | high | medium | `crm_reviews` (rating, nps_score, public_consent, testimonial_text) + auto review-request keyed på galleri 'levert'/betalt |
| #36 Ingen prognose (probability ubrukt) | medium | high | medium | Vektet pipeline + åpen verdi pr stage + expected close pr måned; forecast-widget |
| #55 Ingen kohort/trend-tidsserie | medium | medium | medium | `date_trunc('month', created_at)/won_at` for leads/deals/inntekt siste 12 mnd; trend-chart |
| #26 Ingen external-id-mapping-lag | high | high | medium | Generisk `crm_external_refs` (owner, entity_type, entity_id, provider, external_id, payload, last_synced_at); generaliser `crm_conversation_links`-mønsteret; lagre Google `resourceName` her |
| #27 Regnskap silo'et (PowerOffice bundet til projects) | high | high | medium | Løft `photographer_integrations`+PowerOffice-adapter til delt eier-scopet store; `POST /deals/:id/invoice` som resolver customer→external_ref |
| #44 Ingen sync/outbox-lag | medium | high | large | `crm_integration_outbox` skrevet i SAMME transaksjon som mutasjonen, drenert av worker mot `CrmIntegrationProvider`-adaptere |
| #58 Ingen webhook/inbound-ingestion | medium | medium | medium | Signert `/api/integrations/:provider/webhook` som resolver external_id→entity og oppdaterer deal/faktura-status (faktura betalt → bekreft closed_won) |
| #57 Google-kobling enveis/email-keyed/lossy | medium | medium | medium | Persister Google `resourceName` + calendar/meet-event-id via `crm_external_refs`; behandle Meet/Calendar som adapter |
| #33 Ingen dedupe/merge; ingen unik e-post | high | medium | large | Detekter eksisterende e-post → tilby link/merge; merge-verktøy; partial unique index på `(owner_user_id, lower(email))` |
| #59 Ingen server-side validering/normalisering | medium | medium | medium | Sentralisert normalize+validate (lowercase/trim e-post, E.164 telefon) i både manuell og Google-path; `email_normalized`-kolonne |
| #34 Ingen consent/erasure (CRM-spesifikk GDPR) | high | medium | large | Lawful-basis/consent-metadata ved import/lead; data-subject-eksport-by-email; auditbar erasure. CRM holder mest tredjeparts-PII |
| #15 Hard deletes, ingen soft-delete/audit | high | high | medium | `deleted_at` soft-delete; `created_by`/`updated_by`; append-only audit-logg; blokker sletting når faktura/kontrakt refererer |
| #45 Uscopede kryssmodul-skrivere + duplikat route | medium | medium | small | Sentralisert eier-bevisst opprettelse; fjern duplikat `customers/:id`-handler; plattform-scope admin-aggregat |
| #49 Ingen SMS / multi-channel | medium | medium | large | SMS-provider-abstraksjon (Twilio/Vonage) bak channel-interface; logg sends som `crm_activities` |
| #51 Ingen reply-capture/inbound-logging | medium | medium | large | Gmail history-sync (watch/poll) som skriver innkommende meldinger som inbound `crm_activities` for linkede samtaler |

---

## 4. Datamodell- & arkitektur-anbefalinger

### 4.1 Multi-tenancy-mønster (prerequisitt for alt)
- **`owner_user_id` (text, indeksert, NOT NULL)** på `crm_customers`, `crm_deals`, `crm_activities`, `crm_tasks`, `crm_pipeline_stages`, `crm_email_templates`. Sett på INSERT, filtrer på hver read. Barn scopes via JOIN til forelderens eier.
- Adopter det eksisterende mønsteret fra `dance-admin-ops-service.ts` (scoper hver query på `owner_user_id`) — ikke et nytt design.
- For team senere: `org_id` ved siden av `owner_user_id`.
- **Langsiktig: Postgres RLS** som siste forsvarslinje, så et glemt `WHERE` ikke kan lekke på tvers av tenants.
- Admin-aggregat (`getAdminCrmOverview`) holdes eksplisitt **plattform-scopet**, separat fra bruker-rapporter.

### 4.2 Sporet, konsolidert schema (én sannhetskilde)
- Reverse-engineer `crm_customers`/`crm_deals`/`crm_activities`/`crm_tasks` (+ `crm_invoices`/`crm_meetings` som mangler helt) inn i **migrasjon + Drizzle-schema** med FK, indekser og constraints, under migrate-and-verify-disiplin (poll `/migrations/status`, ikke stol på HTTP 202).
- **Konsolider på `crm_customers` (uuid)-modellen** som single source of truth. Slett eller reconcile den foreldreløse `crm_contacts`-modellen (`crm-schema.ts`) — den er død kode og en feil-signal som vil få regnskaps-integrasjon til å bygge mot en fantommodell.
- Kodifiser runtime-kolonnene som spørringene faktisk bruker men som ikke finnes i noen schema (`profession`, `project_id`), og rett uoverensstemmelser (`order by position` vs schema-kolonne `stage_order`).
- La `crm_deals.stage` **referere `crm_pipeline_stages` (stage_id)** og merk stages som won/lost-type, så stats slutter å hardkode `'closed_won'`/`'closed_lost'`.

### 4.3 Integrasjonslag for regnskap/e-post (adapter + outbox)
- **`crm_external_refs`** `(id, owner_user_id, entity_type, entity_id, provider, external_id, external_payload jsonb, last_synced_at, sync_status, direction)` — generaliseringen av det allerede-beviste `crm_conversation_links`-mønsteret `(provider, conversation_id)→customer_id + matched_by + confidence`. Lagre Google `resourceName` og Meet/Calendar-event-id her i stedet for e-post-matching.
- **`crm_integration_outbox`** `(event_type, aggregate_id, payload jsonb, status, attempts, next_attempt_at)` skrevet i **samme transaksjon** som CRM-mutasjonen, drenert av en worker mot en **`CrmIntegrationProvider`-interface** `(push, pull, mapExternalId)`. PowerOffice/Fiken/Tripletex/Google blir hver én adapter-rad, ikke en redigering av CRM-CRUD.
- Løft `photographer_integrations` + PowerOffice-adapteren til en delt eier-scopet store keyed på `owner_user_id+provider`; legg `POST /deals/:id/invoice`.
- **E-post:** rut all CRM-send gjennom den *leverende* Gmail-pathen (`gmail.users.messages.send`, som `/reply` bruker), ikke den no-op `/email/send`-aliaset. «Send» må bety én ting.
- **Inbound:** signert webhook-mottaker + Gmail history-sync som skriver til `crm_activities`.

### 4.4 Aktivitets-/event-modell (append-only er ryggraden)
- **`crm_activities` blir den eneste sannhetskilden for interaksjon.** Hver touch — manuell logg, e-post sendt/mottatt, deal-stage-overgang, faktura utstedt/betalt, kontrakt sendt/signert, galleri delt, task fullført — skriver én udødelig, tidsstemplet rad. Notater flyttes hit (type 'note'); `customer.notes` beholdes kun som pinned sammendrag.
- **`crm_deal_stage_history`** `(deal_id, from_stage, to_stage, changed_at)` på hver stage-PUT. Kan ikke backfilles — må fanges nå. Dette + `won_at`/`lost_at` + `loss_reason` + `source` denormalisert på deal er forutsetningen for *alle* tidsserie-/velocity-/forecast-/kohort-rapporter. Reporting-laget må derives fra disse immutable fakta, ikke fra mutable nåtilstand-kolonner som overskrives på hver edit.
- Oppdater `crm_customers.last_contact = now()` på hver activity-insert.

### 4.5 Soft-delete / audit / identitet
- **Soft-delete:** `deleted_at` overalt; blokker sletting når faktura/kontrakt refererer kunden.
- **Audit:** `created_by`/`updated_by` + append-only audit-logg; ingen stille overskriving av historikk.
- **Canonical identitet:** `email_normalized`-kolonne (trim+lowercase, sentralisert i én normalize+validate-funksjon delt av manuell og Google-path), E.164 telefon, partial unique index `(owner_user_id, lower(email)) WHERE email IS NOT NULL`. Dette løser dedupe, merge, import, eksport og GDPR-erasure samtidig — alle feiler i dag av samme rot-årsak.
- **GDPR:** lawful-basis/consent-metadata ved import/lead, eksport-by-email, auditbar erasure (gjenbruk `nextrole-gdpr.ts`-mønsteret). CRM-en holder mest tredjeparts-PII og er i dag den svakeste GDPR-lenken.

## 5. Relasjon→inntekt-løkka

Eierens premiss er at CRM-en er kjernen for kunderelasjon — uten den, ingen bærekraftig inntekt. Her er hvordan de foreslåtte tingene konkret lukker løkka. I dag er løkka brutt på fire steder; hver bølge reparerer ett ledd.

```
   [Kilde/henvisning] → [Lead] → [Deal/pipeline] → [Levering] → [Anmeldelse/NPS]
          ↑                                                            │
          │                                                            ▼
   [Henvisning ←──────── [Win-back/dormant] ← [Rebook-vindu] ← [Repeat/LTV]
```

| Mekanisme (gap) | Hvordan det driver inntekt konkret |
|---|---|
| **Detaljvisning + tidslinje + «sist kontaktet»** (#2, #17, #35) | Gjør relasjonen synlig. Simen ser hele historikken før en samtale → høyere konvertering, ingen droppede tråder. «Sist kontaktet for 90 dager siden»-chip er selve triggeren for re-engasjement. |
| **Task-inbox + påminnelser + automatikk** (#5, #21, #9, #38) | Konverterer passivt register til system of action. «Svar innen 24t»-tasken på ny lead redder leads som ellers råtner i stillhet. Dette beskytter toppen av trakten der hver tapt lead = tapt inntekt. |
| **Deals som enhet + win/loss-historikk** (#3, #19, #20, #54) | Lar én klient bære flere muligheter over tid (bryllup nå, nyfødt om et år) → representerer ekspansjons-/gjenkjøps-inntekt i stedet for å kollapse kunden til én status. Loss-reason fikser pris/cadence → høyere fremtidig win-rate. |
| **Post-leverings-livssyklus + rebook/jubileum** (#8, #24, #47) | Den direkte gjenkjøps-motoren. `last_delivered_at` + rebook-vindu + automatisk jubileums-e-post gjør at ~50-70% repeat-potensialet (familie/bryllup/nyfødt) faktisk blir kontaktet. Dette er den billigste inntekten en fotograf har. |
| **NPS/anmeldelse + henvisnings-sporing** (#39, #23) | Lukker løkka tilbake til toppen. Auto review-request etter levering → tidlig misnøye fanges (redder relasjonen) + testimonials (driver akkvisisjon). `referred_by_customer_id` viser «hvilken fornøyd klient sendte meg 3 bookinger» → Simen kan belønne og doble ned på sin beste kanal. |
| **LTV + segmentering + kilde-ROI** (#40, #43, #41) | Gjør relasjon til *kvantifisert, prioriterbar* strategi. VIP-klienter får white-glove rebook-nurture; engangsklienter får reaktivering. Kilde-ROI forteller hvor han skal bruke markedstid. Uten LTV ser hver klient lik ut og høyverdige relasjoner får ingen ekstra investering. |
| **Import/eksport + dedupe + sporet schema** (#28, #29, #33, #60) | Adopsjons-fundamentet. En fotograf med 200 eksisterende klienter retter dem ikke inn manuelt — uten import blir CRM-en aldri hans system of record, og da driver den ingen relasjon i det hele tatt. Eksport fjerner lock-in-angst som undertrykker betalt forpliktelse. |
| **Regnskaps-integrasjon + realisert inntekt** (#10, #27, #44, #58) | Lukker den finansielle løkka: closed_won deal → faktura via adapter → webhook bekrefter betalt → realisert inntekt vises ved siden av pipeline-prognose. Skiller de tre tallene et ekte CRM må skille: prognose-verdi, booket inntekt, innkrevd cash. |

**Kjernepoenget:** Hvert ledd i løkka over er i dag enten frakoblet, ueid eller manuelt. Multi-tenancy (Bølge 0) gjør tallene trygge og sanne. Bølge 1 gjør relasjonen synlig og handlerbar. Bølge 2 gjør den selvgående og lukker gjenkjøps-leddet. Bølge 3 gjør den målbar, integrert og portabel. Først når alle fire bølgene er landet er CRM-en faktisk det fundamentet for bærekraftig inntekt eieren beskriver — i dag er den et register som lekker.
