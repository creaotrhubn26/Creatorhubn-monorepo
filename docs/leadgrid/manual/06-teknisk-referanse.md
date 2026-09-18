# Teknisk referanse for Leadgrid

**Kildesnapshot:** 29. august 2026  
**Omfang:** monterte Leadgrid- og Lead Map-ruter, tilgangskontroll, datalag,
integrasjoner, bakgrunnsjobber, realtime og backend-testbevis.  
**Metode:** statisk inspeksjon av aktiv serverregistrering, rutemoduler,
migrasjoner, GitHub Actions og tester. Ingen produksjonsdata eller hemmeligheter
er lest.

Denne referansen beskriver hva backend faktisk eksponerer. En kildefil alene er
ikke nok til å gjøre en funksjon aktiv; den må være registrert i serveren og ha
en reell data- eller tjenestekobling. Bruk
[funksjonskatalogen](./03-funksjonskatalog.md) for sluttbrukerinnganger og
[dokumentasjonsstandarden](./08-dokumentasjonsstandard.md) for statusreglene.

## 1. Status og registreringsgrenser

| Status | Teknisk betydning i dette kapitlet |
|---|---|
| **Aktiv** | Rutemodulen er registrert, og primærhandlingen leser eller skriver et reelt datalag eller kaller en reell tjeneste. |
| **Aktiv · betinget** | Aktiv, men avhengig av session, rolle, permission, entitlement, plan, ekstern nøkkel eller cron-token. |
| **Hybrid** | Rutene er registrert, men deler av kontrakten er deferred, prosesslokal, lazy-opprettet eller mangler komplett providerkobling. |
| **Backend/API** | Montert serverfunksjon uten bekreftet aktiv sluttbrukerinngang i denne backend-gjennomgangen. |
| **Legacy/ikke nåbar** | Førstegenerasjons-API som fortsatt støttes, eller en modul som finnes uten å være registrert. Den konkrete raden forklarer hvilket. |
| **Krever verifisering** | Statisk kode viser en kobling, men skjema, deploykonfigurasjon eller ende-til-ende-atferd kan ikke bevises fra repoet alene. |

De to største registreringsblokkene ligger i
[`backend/server/index.ts`](../../../backend/server/index.ts):

| Registrering | Område | Konsekvens |
|---|---|---|
| `index.ts:25391–25671` | Lead Map, intelligence, discovery, workflows, kundeportal, billing og partnerplattform | Første store Leadgrid-blokk. |
| `index.ts:25762` | Lead Map-kampanjer | Egen market-intelligence-registrering. |
| `index.ts:67120–67236` | Nyere native/iPad-funksjoner | Salgsledelse, felt, mobilitet, Pondus, Academy, Canvas, Doffin og Leadbook. |
| `index.ts:2508` | Infografikk | Live Leadgrid-KPI til PNG. |
| `index.ts:75816` og `:75821` | WebSocket | Canvas-samarbeid og Leadgrid-eventstrøm. |

Det finnes over hundre registrerte Leadgrid/Lead Map-relaterte rutemoduler og
flere hundre route-handlere. De er gruppert etter produktansvar under, ikke
etter filnavn alene.

## 2. Modulgrupper og API-familier

### 2.1 Kart-CRM, leads og daglig salgsarbeid

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv** og **Legacy/ikke nåbar** for førstegenerasjons-API-et som fortsatt er montert. |
| **Rutemoduler** | `lead-map-routes.ts`, `lead-map-competitor-routes.ts`, `lead-map-logo-routes.ts`, `lead-map-project-routes.ts`, `lead-map-team-routes.ts`, `lead-map-workload-routes.ts`, `lead-map-leaderboard-routes.ts`, `lead-map-notification-routes.ts`, `lead-map-annotation-routes.ts`, `lead-map-promotion-routes.ts`, `lead-map-transcript-routes.ts`, `lead-map-research-routes.ts`, `lead-map-followup-cron.ts`, `lead-status-routes.ts`, `lead-assignment-routes.ts`, `lead-acceptance-routes.ts`, `lead-export-routes.ts`, `market-intelligence/lead-map-campaign-routes.ts` og `infographic-leadgrid-connector.ts`. |
| **API-prefix** | `/api/admin-room/lead-map/*`, `/api/role-room/agent/configs/:configId/lead-map/*`, `/api/lead-map/*`, `/api/leadgrid/customers/*`, `/api/leadgrid/leads/export*`, `/api/leadgrid/my-*`, `/api/infographics/leadgrid/*`. |
| **Tilgang** | Blanding av Bearer-session, lokale rollekrav og Lead Map-RBAC. Follow-up og re-engagement har egne cron-token. |
| **Viktig lagring** | `crm_customers`, `crm_visits`, `crm_lead_activities`, assignment/quota, varsler, kartannotasjoner og kampanjer. |
| **Eksternt** | Claude, BRREG, nettsideanalyse, Resend/SMTP og APNs. |
| **Testbevis** | Ingen bred HTTP-/tenant-integrasjonstest for hele familien. Follow-up-cron har planlagt GitHub Action. |

De gamle `/api/admin-room/lead-map/*`- og
`/api/role-room/agent/configs/:configId/lead-map/*`-rutene er ikke dødkode. De
er et aktivt kompatibilitetslag og må beholdes i kontraktdokumentasjon til
klientene er migrert.

### 2.2 Organisasjon, personer, RBAC, plan og billing

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**. |
| **Rutemoduler** | `lead-map-org-routes.ts`, `lead-map-profile-routes.ts`, `lead-map-me-profile-routes.ts`, `lead-map-permission-routes.ts`, `lead-map-rbac-helper.ts`, `leadgrid-org-override-routes.ts`, `user-org-routes.ts`, `superadmin-routes.ts`, `org-self-onboard-routes.ts`, `leadgrid-google-auth-routes.ts`, `leadgrid-onboarding-routes.ts`, `plan-routes.ts`, `leadgrid-billing-routes.ts`, `leadgrid-overage-billing.ts`, `leadgrid-drips-routes.ts`, `admin-lead-map-pricing-routes.ts`, `leadgrid-pricing-config-routes.ts`, `leadgrid-experience-config-routes.ts` og `leadgrid-testimonials-routes.ts`. |
| **API-prefix** | `/api/admin-room/lead-map/organizations|teams|profiles|permissions|me/*`, `/api/users/me/*`, `/api/superadmin/*`, `/api/admin/lead-map/*`, `/api/leadgrid/self-onboard|google-auth|onboarding|plan|billing|org-override`. |
| **Tilgang** | Session, org-medlemskap, plattformrolle, permission, plan og enkelte server-entitlements. Superadmin har flere eksplisitte bypass-regler. |
| **Viktig lagring** | Organisasjoner, medlemmer, salgsteam, profiler, project members, permissions, rolle-/bruker-overrides, audit, plan limits/usage/grace, invoices og entitlements. |
| **Eksternt** | Stripe, Google Sign-In, BRREG og e-post. |
| **Testbevis** | `leadgrid-pricing-config.contract.test.ts` har fem kontrakttester. Ingen samlet RBAC-/tenant-suite. |

### 2.3 Discovery, import, research og enrichment

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**, med **Hybrid** import- og køatferd. |
| **Rutemoduler** | `leadgrid-research-routes.ts`, `leadgrid-market-scan-routes.ts`, `leadgrid-import-routes.ts`, `leadgrid-url-research-routes.ts`, `leadgrid-url-batch-processor.ts`, `leadgrid-project-lead-discovery-routes.ts`, `leadgrid-discovery-config-routes.ts`, `leadgrid-continuous-discovery.ts`, `leadgrid-industries-routes.ts`, `leadgrid-industry-classify.ts`, `leadgrid-agent-bridge-routes.ts`, `leadgrid-agent-bridge-service.ts`, `lead-scout-routes.ts`, `lead-scout-service.ts`, `lead-preset-routes.ts` og `customer-auto-onboard-routes.ts`. |
| **API-prefix** | `/api/leadgrid/leads/:id/research|full-intelligence`, `/api/leadgrid/market-scan/*`, `/api/leadgrid/import/*`, `/api/leadgrid/url-research/*`, `/api/leadgrid/projects/:projectId/discover-leads|discovery-config`, `/api/leadgrid/industries|members/*/industries` og legacy `/api/admin-room/lead-map/*`. |
| **Tilgang** | Blant annet `lead_research.run`, `leadgrid.market_scan.run`, `leads.import_csv`, `leads.import_url` og `industries.*`. |
| **Viktig lagring** | Importbatches, URL-research-batches/items, project discovery config, industries/spesialiseringer og enrichment-felt/JSON på leads. |
| **Eksternt** | Claude, Google Places/Maps/Geocoding, BRREG, nettstedscrawl, SSB og Role Room Agent-orchestrator. |
| **Testbevis** | Import 10, industries 22, URL research 17, bulk URL 23 og research quality 14 statisk telte testtilfeller. |

CSV/Excel-importen er reell, men preview-token ligger i en prosesslokal `Map`
i 15 minutter. En restart eller request til en annen instans mister tokenet.
Commit kjører rad for rad uten transaksjon og kan derfor ende som delvis import.
Mappingen godtar blant annet notes, industry, country, sosiale URL-er, employee
count og quality score, men `insertLead` persisterer bare et mindre kjernesett
og rå-JSON. Se
[`leadgrid-import-routes.ts`](../../../backend/server/leadgrid-import-routes.ts).

### 2.4 Intelligence, scoring, deals, forecast og analyse

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**, med **Hybrid** AI-bruksmåling. |
| **Rutemoduler** | `leadgrid-intelligence-routes.ts`, `leadgrid-intelligence-engine.ts`, `leadgrid-intelligence-cron.ts`, `leadgrid-retention-cron.ts`, `leadgrid-backfill-cron.ts`, `leadgrid-ai-usage-routes.ts`, `leadgrid-ai-usage-tracker.ts`, `leadgrid-ai-queue.ts`, `leadgrid-deals-routes.ts`, `leadgrid-deals-service.ts`, `leadgrid-deal-defaults.ts`, `leadgrid-forecasting-routes.ts`, `leadgrid-forecasting-service.ts`, `leadgrid-momentum-routes.ts`, `leadgrid-momentum-service.ts`, `leadgrid-analytics-routes.ts`, `leadgrid-analytics-service.ts` og `lead-portfolio-routes.ts`. |
| **API-prefix** | `/api/leadgrid/intelligence|deals|forecasting|momentum|analytics|ai-usage/*` og legacy portfolio under `/api/admin-room/lead-map/*`. |
| **Tilgang** | Lead Map-permissions for intelligence, forecast, deals, analytics og billing. AI-køens health-endepunkt krever admin. |
| **Viktig lagring** | Score/NBA-felt på `crm_customers`, score history, recommendations, tags/segments/custom fields, deal history, forecast cache/attribution og goals/snapshots. |
| **Eksternt** | Claude og Stripe meter. |
| **Testbevis** | Intelligence engine 50 og deals/defaults 12 statisk telte testtilfeller. |

`recordAIUsage()` har ingen kallesteder utenfor sin egen eksempelkommentar og
definisjon. Det sentrale AI-usage-dashbordet kan derfor være tomt selv om
AI-funksjoner brukes. Mange kall til `withAIQuota` sender samtidig `null` som
org-ID, slik at per-org-kvoten ikke håndheves. Kilder:
[`leadgrid-ai-usage-tracker.ts`](../../../backend/server/leadgrid-ai-usage-tracker.ts)
og
[`leadgrid-ai-queue.ts`](../../../backend/server/leadgrid-ai-queue.ts).

### 2.5 Workflows, outreach, events og rapporter

| Felt | Referanse |
|---|---|
| **Status** | **Hybrid** og sikkerhetsmessig **Krever verifisering**. |
| **Rutemoduler** | `leadgrid-workflow-routes.ts`, `leadgrid-workflow-engine.ts`, `leadgrid-workflow-types.ts`, `leadgrid-workflow-templates.ts`, `leadgrid-workflow-webhooks-routes.ts`, `leadgrid-workflow-triggers-routes.ts`, `leadgrid-webhook-rotation-routes.ts`, `lead-rules-routes.ts`, `lead-rules-engine.ts`, `leadgrid-scheduled-reports-routes.ts`, `leadgrid-email-branding-routes.ts`, `leadgrid-channel-onboarding-routes.ts`, `client-notification-prefs-routes.ts` og `wa-templates-admin-routes.ts`. |
| **API-prefix** | `/api/leadgrid/workflows|webhooks|events|scheduled-reports|email-branding|channel-onboarding/*`, `/api/leadgrid/portal/:token/notification-prefs`, `/api/superadmin/wa-*` og legacy rules under `/api/admin-room/lead-map/*`. |
| **Tilgang** | Workflow-permissions, session, portal-token, superadmin eller cron-token avhengig av ruten. Eventmottakerne har særskilt auth-gap beskrevet under. |
| **Viktig lagring** | Workflows, executions, resume jobs, tracking events, proposal/contract events, webhook destinations/queue, meetings, calls, internal notifications og scheduled reports. |
| **Eksternt** | Resend/SMTP, Meta WhatsApp, generiske webhooks/Zapier og Claude. |
| **Testbevis** | Workflow engine 20, extensions 40 og types/validation 30 statisk telte testtilfeller. |

Følgende actions utfører reelt arbeid: pipeline/status/assign/tag/task/e-post,
wait/resume, calls, lokale meetings, tillatte feltoppdateringer,
webhooks/Zapier, interne varsler, archive/revive og continuous discovery.
Følgende returnerer bare `deferred`: `send_sms`, `send_whatsapp`,
`notify_channel` og `ai_pitch_generate`. `book_meeting` lager en lokal møtepost,
men oppretter ikke Google Meet eller invitasjon. `manager`-assignee faller i
enkelte actions tilbake til lead owner.

Det gamle `lead-rules-*`-systemet og det nye `leadgrid-workflow-*`-systemet er
parallelle automasjonsmotorer. Legacy-motoren godtar `cron_hourly` og
`cron_daily`, men gjennomgangen fant bare det manuelle
`evaluate-rules`-kallestedet, ikke en scheduler eller automatisk lead-hook.

### 2.6 Kundeportal, levering og eksport

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv**, delvis **Krever verifisering** på skjema. |
| **Rutemoduler** | `leadgrid-client-portal-routes.ts`, `customer-auto-onboard-routes.ts`, `delivery-playbook-routes.ts`, `client-notification-prefs-routes.ts`, `lead-acceptance-routes.ts`, `lead-export-routes.ts`, `leadgrid-channel-onboarding-routes.ts` og `leadgrid-email-branding-routes.ts`. |
| **API-prefix** | `/api/leadgrid-client/:token/*`, `/api/leadgrid/portal/:portalToken/*`, `/api/superadmin/leads/*` og `/api/leadgrid/leads/export*`. |
| **Tilgang** | Public portal-token, innlogget org-bruker eller superadmin avhengig av flaten. |
| **Viktig lagring** | Portal-token, needs, signals, deliverables, focus/seen/accept, notification preferences og branding. |
| **Eksternt** | E-post, WhatsApp/Meta og PDF-generering. |
| **Testbevis** | Ingen samlet portal-/eksport-/tenant-test. |

### 2.7 Territorier, ruter, kart og mobilitet

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**. |
| **Rutemoduler** | `leadgrid-territory-routes.ts`, `leadgrid-territory-service.ts`, `leadgrid-route-routes.ts`, `leadgrid-route-service.ts`, `routes-adherence-routes.ts`, `leadgrid-rute-routes.ts`, `leadgrid-kartverket-routes.ts` inkludert adresse-proxy, `leadgrid-entur-routes.ts`, `leadgrid-parking-routes.ts`, `leadgrid-parkering-routes.ts`, `leadgrid-nvdb-routes.ts`, `leadgrid-vehicle-routes.ts`, `leadgrid-trips-routes.ts`, `leadgrid-tettsted-service.ts` og location-delen av `lead-map-profile-routes.ts`. |
| **API-prefix** | `/api/leadgrid/territories|routes|ruter|kartverket|adresse|entur|parking|nvdb|vehicle|trips/*`. |
| **Tilgang** | Session, route-/territory-permissions, egne rollekrav og enkelte server-entitlements. |
| **Viktig lagring** | Territories/events, routes/stops, user positions, route assignments/visits, trips, vehicles, bookings og location consent. |
| **Eksternt** | Google Maps/Distance Matrix, Geonorge/Kartverket, SSB, Entur, NVDB og Statens vegvesen. |
| **Testbevis** | Route service 9 og territory service 37 statisk telte testtilfeller. Ingen samlet provider-/HTTP-test. |

### 2.8 Dørsalg, teamdrift, cockpit og administrasjon

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**. |
| **Rutemoduler** | `leadgrid-dorsalg-routes.ts`, `leadgrid-brief-routes.ts`, `leadgrid-sales-teams-routes.ts`, `sales-leadership-routes.ts`, `leadgrid-mileage-approval-routes.ts`, `leadgrid-cockpit-routes.ts`, `leadgrid-manual-invoice-routes.ts`, `leadgrid-equipment-routes.ts`, `leadgrid-crash-routes.ts` og `leadgrid-oversikt-routes.ts`. |
| **API-prefix** | `/api/leadgrid/dorsalg|brief|sales-teams|lead-assignments|sales-leadership|mileage|approvals|coaching|manual-invoice|equipment|presence|crash|oversikt/*`. |
| **Tilgang** | Nyere moduler bruker hovedsakelig `requireUserSession` og egne rolle-/org-sjekker, ikke én felles permissionmodell. |
| **Viktig lagring** | Dørsalg status/products/access/sales/goals, brief meetings, teams/assignments, commission/contests/prizes, mileage, approvals/coaching, invoices, equipment/presence og crash reports. |
| **Eksternt** | APNs, e-post, PDF og enkelte karttjenester. |
| **Testbevis** | Ingen navngitt backend-suite for disse rutene. |

### 2.9 Pondus, Leadbook, Academy, proposals og AI-møtearbeid

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**, med enkelte **Hybrid** providerkoblinger. |
| **Rutemoduler** | `pondus-routes.ts`, `leadgrid-pondus-quiz-routes.ts`, `leadgrid-leadbook-examples-routes.ts`, `leadgrid-proposals-routes.ts`, `leadgrid-academy-routes.ts`, `leadgrid-canvas-routes.ts`, `leadgrid-canvas-realtime.ts`, `leadgrid-motebrief-routes.ts`, `leadgrid-meeting-notes-routes.ts`, `leadgrid-meeting-notes-service.ts`, `leadgrid-quality-routes.ts` og `delivery-playbook-routes.ts`. |
| **API-prefix** | `/api/leadgrid/pondus|leadbook|academy|canvas|moter|quality/*`, `/api/leadgrid/leads/:id/proposals|meeting-notes` og `/ws/leadgrid-canvas`. |
| **Tilgang** | Session/rolle og server-entitlements for blant annet Leadbook, Canvas, møtebrief og quality. Lyd skal behandles fail-closed. |
| **Viktig lagring** | Templates/versions/content/usage/quiz, Leadbook examples/feedback/views, proposals/views, Academy courses/progress, Canvas notes/docs, meeting notes, møtebrief-data og quality verification. |
| **Eksternt** | Claude, OpenAI Whisper, objektlagring, PDF/e-post og APNs. |
| **Testbevis** | Ingen bred route-/DB-/entitlement-test for denne gruppen. |

### 2.10 Doffin og offentlige anbud

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**. |
| **Rutemodul** | `leadgrid-doffin-routes.ts`. |
| **API-prefix** | `/api/leadgrid/doffin/*`. |
| **Tilgang** | `requireUserSession`, anbud-entitlement og cron-token for watch/digest. |
| **Viktig lagring** | `leadgrid_doffin_watches` og `leadgrid_anbud_pipeline`. |
| **Eksternt** | Doffin, BRREG, Geonorge, Claude, e-post og APNs. |
| **Testbevis** | Ingen egen backend-testfil funnet. |

### 2.11 Partner-, utvikler- og public API-plattform

| Felt | Referanse |
|---|---|
| **Status** | **Aktiv · betinget**, men skjema **Krever verifisering**. |
| **Rutemoduler** | `leadgrid-partners-routes.ts`, `partner-applications-routes.ts`, `partner-intent-routes.ts`, `partner-verification-routes.ts`, `partner-api-routes.ts`, `partner-api-management-routes.ts`, `developer-application-routes.ts`, `testflight-testers-routes.ts`, `leadgrid-api-key-mgmt-routes.ts`, `leadgrid-api-key-auth.ts`, `leadgrid-public-api-v1.ts`, `leadgrid-openapi-routes.ts` og `leadgrid-openapi-spec.ts`. |
| **API-prefix** | `/api/leadgrid/partner*|intent|marketplace|developer-application`, `/api/superadmin/partner*|api-keys|webhook-*|testflight-testers`, `/api/v1/partner/*` og `/api/v1/health|leads|recommendations|docs|openapi.json`. |
| **Tilgang** | Public application/signing-token, session/superadmin, `lg_live_*` partner keys og SHA-256-hashede `lgk_*` Leadgrid API keys med scopes. |
| **Viktig lagring** | Applications, terms, benefits, intents, documents, environments, verification/reverification, API keys, usage, webhooks og delivery attempts. |
| **Eksternt** | Objektlagring, e-post, webhooks, App Store Connect og Stripe. |
| **Testbevis** | Ingen komplett public API-/partner-sandbox-kontraktsuite. |

OpenAPI-spesifikasjonen dekker bare fire paths og fem operasjoner: health,
leads GET/POST, lead GET og recommendations. Intern-API-et og partner-API-et er
ikke dekket. `leadgrid-public-api-v1.ts` har samtidig en foreldet kommentar om
at `crm_customers` mangler `organization_id`; API-et scoper fortsatt via
`owner_user_id IN organization_members`.

### 2.12 Offentlig acquisition og landingsdata

| Felt | Referanse |
|---|---|
| **Status** | **Offentlig flate** for registrerte ruter; app-ventelisten er **Legacy/ikke nåbar** på backend. |
| **Rutemoduler** | `leadgrid-signup-interest-routes.ts`, `leadgrid-demo-request-routes.ts`, `leadgrid-partners-routes.ts`, `leadgrid-pricing-config-routes.ts`, `leadgrid-experience-config-routes.ts`, `leadgrid-testimonials-routes.ts`; uregistrert `leadgrid-app-waitlist-routes.ts`. |
| **API-prefix** | `/api/leadgrid/signup-interest|demo-request|partners|pricing|experience|testimonials` og forventet, men umontert `/api/leadgrid/app-waitlist*`. |
| **Tilgang** | Offentlig POST/GET der formålet er landingsside eller lead capture; admin for konfigurasjon. |
| **Viktig lagring** | Signup/demo leads, pricing, experience media og testimonials, flere via lazy schema-oppretting. |
| **Eksternt** | E-post og event tracking. |
| **Testbevis** | Pricing-kontrakttesten dekker kun prisresponsen. |

## 3. Auth, organisasjonsscope og gates

### 3.1 Sessionmodeller

| Modell | Bruk | Status og begrensning |
|---|---|---|
| `activeSessions` direkte | Mange eldre og enkelte nyere ruter | **Hybrid.** Prosesslokal og mister sessions ved restart eller mellom instanser. |
| `lead-map-session-helper.ts` | `lead-map-routes`, org og permission | **Aktiv.** Bearer-session med persisted DB-fallback, men bare disse tre rutemodulene bruker den. |
| Injisert `requireUserSession` | Store deler av den nyere blokken | **Aktiv · betinget.** Felles innlogging, men rutene bruker fortsatt forskjellige org-/rolleoppslag etterpå. |
| API key | `/api/v1/*` og `/api/v1/partner/*` | **Aktiv · betinget.** Hash, scopes og usage; ratebegrensningen er prosesslokal. |
| Portal/signering/public token | Kundeportal og partnerflyt | **Aktiv · betinget.** Må behandles som en egen identitetsgrense. |
| Cron-token | Workers | **Aktiv · betinget.** Fire forskjellige miljøvariabelnavn brukes. |

### 3.2 Parallelle org-resolvere

| Resolver | Oppslagsrekkefølge | Risiko |
|---|---|---|
| `lead-map-rbac-helper.ts` | Body/query org, route-org, project, lead, deretter første `organization_members`-medlemskap | Ved manglende org fail-open til legacy row ownership. |
| `leadgrid-org-resolver.ts` | `leadgrid_org_overrides`, nyeste aktive `enterprise_team_members`, deretter bruker-ID som solo-org | Bruker en annen medlemskapstabell og kan gi annet org-resultat enn Lead Map. Cache er 30 sekunder per bruker. |
| Lokale route-resolvere | `organization_members`, `casting_projects`, `owner_user_id`, direkte `organization_id` eller request-body | Øker risikoen for at liste, eksport, mutation og realtime ikke ser samme tenant. |

Den sentrale permission-middlewareen slipper gjennom dersom org ikke kan løses,
for å bevare legacy-eierskap. Se
[`lead-map-rbac-helper.ts`](../../../backend/server/lead-map-rbac-helper.ts).

### 3.3 Org-status og entitlements

`enforceOrgStatus` er montert på `/api/admin-room/lead-map` og
`/api/leadgrid` ved `index.ts:25670–25671`. Express bruker
registreringsrekkefølge. Rutene som ble registrert tidligere i samme fil går
derfor ikke gjennom denne middlewareen, selv om kommentaren sier «alle
Leadgrid-rutene». Den nyere blokken ved linje 67120 registreres etter og går
gjennom den.

Middlewareen er dessuten fail-open ved manglende org, ukjent org eller DB-feil.
Standardresolveren kan bruke `req.params.id` som org-ID selv når `id` egentlig
er en lead, workflow eller annen ressurs. Kilde:
[`org-status-enforcement.ts`](../../../backend/server/org-status-enforcement.ts).

Entitlement-guarden er også bevisst fail-open når:

- org ikke kan løses;
- organisasjonen ikke har noen entitlement-rader for nøklene;
- DB-oppslaget feiler.

Server-side entitlement er funnet i Canvas, Doffin, equipment, Leadbook,
møtebrief, quality, rute, deler av territory, trips og Pondus. Andre funksjoner
kan være skjult i klienten uten tilsvarende serverhåndhevelse. Kilde:
[`leadgrid-entitlement-guard.ts`](../../../backend/server/leadgrid-entitlement-guard.ts).

### 3.4 Workflow-eventmottakere

Følgende registrerte endepunkter mangler faktisk håndhevet session, HMAC eller
service-token i handlerne:

- `POST /api/leadgrid/events/email/opened`
- `POST /api/leadgrid/events/email/link-clicked`
- `POST /api/leadgrid/events/meetings/booked`
- `POST /api/leadgrid/events/meetings/no-show`
- `POST /api/leadgrid/events/proposals/opened`
- `POST /api/leadgrid/events/contracts/signed`

Kommentarene beskriver signering eller auth, men implementasjonen godtar
`organization_id`/customer fra body og publiserer workflow- og webhook-event.
Meeting-rutene leser eventuell session, men krever den ikke. Dette er et av de
viktigste sikkerhetsgapene i referansen. Kilde:
[`leadgrid-workflow-triggers-routes.ts`](../../../backend/server/leadgrid-workflow-triggers-routes.ts).

## 4. Datalag og viktigste tabeller

### 4.1 Lead som delt kjernemodell

Leadgrid bruker den eksisterende `crm_customers` som kanonisk lead-entitet.
Den samme raden har over tid fått flere parallelle scopefelt:

| Felt | Innført for | Primær migrasjon |
|---|---|---|
| `owner_user_id` | Personlig/legacy eierskap | Eksisterende CRM + Lead Map 271 |
| `agent_config_id` | Role Room Agent multi-tenancy | `272_lead_map_multi_tenant.sql` |
| `project_id` | Kunde-/casting-project scope | `284_lead_map_project_scope.sql` |
| `assigned_user_id` | Operativ tildeling | `289_lead_map_assignment.sql` |
| `organization_id` | Denormalisert org hot path | `320_leadgrid_organization_id_denormalized.sql` |

Dette er ikke bare historikk: aktive queries bruker fortsatt forskjellige
kombinasjoner. En lead kan derfor bli synlig i én feed og utelatt fra en annen,
særlig etter eierskifte, medlemsendring eller dersom prosjekt/org-backfill
mangler.

### 4.2 Tabellgrupper

| Domene | Viktigste tabeller |
|---|---|
| CRM og aktivitet | `crm_customers`, `crm_visits`, `crm_lead_activities`, `lead_assignment_log`, `lead_quota_targets`. |
| Organisasjon og tilgang | `organizations`, `organization_members`, `sales_teams`, `user_profiles`, `project_members`, invitations, `permissions`, `role_permissions`, `user_permission_overrides`, `permission_audit_log`, `leadgrid_org_entitlements`, `leadgrid_org_overrides`. |
| Intelligence og segmentering | `lead_scores_history`, `lead_recommendations`, `lead_tags`, `lead_tag_assignments`, `lead_segments`, `lead_custom_fields`, `lead_custom_field_values`. |
| Pipeline og forecast | `crm_deal_stage_history`, `leadgrid_forecast_cache`, `leadgrid_attribution_aggregates`, `leadgrid_org_sales_goals`, `leadgrid_momentum_snapshots`. |
| Discovery og import | `leadgrid_import_batches`, `leadgrid_url_research_batches`, `leadgrid_url_research_items`, `leadgrid_project_discovery_config`, `industries`, `organization_member_industries`. |
| Workflows | `leadgrid_workflows`, `leadgrid_workflow_executions`, `leadgrid_workflow_resume_jobs`, email/proposal/contract events, meetings, calls, internal notifications, webhook destinations/subscriptions/queue. |
| Kart og felt | `lead_territories`, `lead_territory_events`, `lead_routes`, `lead_route_stops`, positions, route assignments/visits, trips, vehicles og bookings. |
| Dørsalg og ledelse | Dørsalg status/products/access/sales/goals, brief meetings, sales teams/assignments, commission/contest/prize/award, mileage, approvals/coaching og invoices. |
| Innhold og læring | Pondus templates/versions/content/usage/quiz, Leadbook examples/feedback/views, proposals/views, Academy courses/chapters/progress, Canvas notes/docs, meeting notes og quality verification. |
| Partner og API | Partner applications/terms/benefits/intents/documents/environments/history, API keys/usage, webhook endpoints/deliveries og reverification. |

`crm_visits.customer_id` kommenteres som fremmednøkkel, men har ingen faktisk
`REFERENCES crm_customers`. Det samme gjelder
`crm_lead_activities.customer_id`. Ingen senere migrasjon som legger til disse
FK-ene ble funnet. Se
[`271_lead_map.sql`](../../../backend/migrations/271_lead_map.sql).

## 5. Migrasjoner, runtime DDL og reproducerbarhet

### 5.1 Migrasjonsforløp

| Serie | Hovedinnhold | Status |
|---|---|---|
| `271–294` | Lead Map CRM, multi-tenancy, prosjekt/team/RBAC, assignments, notifications, annotations og pitch deck | **Aktiv**. |
| `312–329` | Intelligence, territory, analytics, meeting notes, org-denormalisering, AI usage, API keys, momentum, import og industries | **Aktiv**. |
| `0349–0369` | Deals/workflows, workflow extensions, URL discovery, Pondus, route adherence, teams, proposals, resume jobs og Academy | **Aktiv**. |
| `0370–0410` | Entitlements, trips/vehicles, quality, equipment/presence/crash, doorsales, pricing, mileage, cockpit, invoices og quiz | **Aktiv**, men deler har også lazy DDL. |

Følgende partner-/onboarding-migrasjoner inneholder bare et notat om at body
ble kjørt direkte via `psql`. En ny database kan ikke rekonstrueres fra filene:

- [`0317_partner_applications_and_benefits.sql`](../../../backend/migrations/0317_partner_applications_and_benefits.sql)
- [`0318_partner_intent_agreements.sql`](../../../backend/migrations/0318_partner_intent_agreements.sql)
- [`0325_full_partner_verification_system.sql`](../../../backend/migrations/0325_full_partner_verification_system.sql)
- [`0326_api_rate_limiting_and_onboarding.sql`](../../../backend/migrations/0326_api_rate_limiting_and_onboarding.sql)

### 5.2 Runtime/lazy DDL

Flere aktive rutemoduler kjører `CREATE TABLE IF NOT EXISTS` ved startup eller
før request-behandling. Dette gjør en eksisterende produksjonsdatabase mer
tolerant, men skjuler manglende migrasjoner og kan gi forskjellig skjema mellom
miljøer.

| Område | Eksempler på runtime DDL |
|---|---|
| Canvas | Notes, versions, documents og library i `leadgrid-canvas-routes.ts`. |
| Doffin | Watches og anbud pipeline i `leadgrid-doffin-routes.ts`. |
| Felt og admin | Doorsales goals, mileage, cockpit, manual invoices, trips/vehicles/bookings og quality. |
| Innhold | Pondus quiz, møtebrief-logg/tasks/goals, ruteplaner og oversikt-/Canvas-policy. |
| Offentlig/kommersielt | Signup, demo, pricing, experience og testimonials. |

Aktive queries refererer også til tabeller uten reproducerbar `CREATE TABLE` i
repoet, blant annet:

- `api_overage_log`
- `client_notification_log`
- `client_notification_prefs`
- `crm_customer_status_history`
- `crm_customer_view_log`
- `lead_research_jobs`
- `leadgrid_channel_onboarding_state`
- `leadgrid_email_branding_config`
- `leadgrid_onboarding_tour_state`
- `leadgrid_outreach_templates`
- `leadgrid_scheduled_report_log`
- `leadgrid_scheduled_reports`
- `partner_api_audit_log`
- `webhook_delivery_attempts`

### 5.3 Boot-sjekk

[`leadgrid-schema-check.ts`](../../../backend/server/leadgrid-schema-check.ts)
sjekker bare 15 tabell-/kolonnepunkter fra hovedsakelig migrasjon 313–318.
Backend starter normalt videre ved mangler. Bare
`LEADGRID_STRICT_SCHEMA=1` gjør feilen fatal. Senere workflows, partner,
discovery, felt, billing og enablement-skjema er ikke med i sjekken.

## 6. Eksterne tjenester og konfigurasjon

| Tjeneste | Bruk | Typisk konfigurasjon | Uten konfigurasjon |
|---|---|---|---|
| Anthropic Claude | Research, strategi, forecast, Doffin, Leadbook og møtebrief | `ANTHROPIC_API_KEY` | Funksjonen feiler, degraderer eller returnerer deferred avhengig av rute. |
| OpenAI Whisper | Meeting notes/transkripsjon | `OPENAI_API_KEY` | Lydtranskripsjon er ikke tilgjengelig. |
| Google Places/Maps/Geocoding/Distance Matrix | Discovery, pins og ruteoptimalisering | `GOOGLE_PLACES_API_KEY`, `GOOGLE_MAPS_API_KEY` | Discovery/rute kan degradere eller feile. |
| Google Sign-In/OAuth | Leadgrid-login og enkelte bruker-integrasjoner | Google client ID/secret | Google-innlogging/-kobling er utilgjengelig. |
| BRREG | Firma, orgnummer og regnskapsdata | Åpne API-er | Research får redusert firmagrunnlag. |
| Doffin | Anbud og watches | `DOFFIN_API_KEY` | Anbudsdata/watches feiler eller blir tomme. |
| Geonorge/Kartverket og SSB | Adresse, kommune, grenser og demografi | Hovedsakelig åpne API-er | Kart-/områdeberikelse degraderer. |
| Entur | Kollektiv/mobilitet | `ENTUR_CLIENT_NAME` | Mobilitetsoppslag feiler. |
| NVDB | Fartsgrense og bom | `NVDB_CLIENT` og kontaktinfo | Vegdata er utilgjengelig. |
| Statens vegvesen kjøretøy | Registreringsnummer/tekniske data | `VEGVESEN_KJORETOY_APIKEY` | Kjøretøyoppslag feiler. |
| Stripe | Plan, portal, invoices, overage og AI-meter | Stripe-nøkler og price/meter IDs | Checkout/billing er utilgjengelig eller delvis. |
| Resend/SMTP | E-post, drips, reports, partner og proposals | Provider-/SMTP-konfigurasjon | Noen flows returnerer deferred; andre feiler. |
| Meta WhatsApp | Kanal-onboarding, templates og varsler | Graph/WABA-konfigurasjon | WhatsApp er utilgjengelig; workflow-action er fortsatt deferred. |
| APNs | Native varsler | `APNS_*`, `APNS_MODE=live` | Klienten kjører som stub som standard. |
| Objektlagring | Academy/media/partnerdokumenter/prizes | Backblaze B2/R2-lignende konfigurasjon | Upload/download er utilgjengelig. |
| Generiske webhooks/Zapier | Workflow- og partner-events | Endpoint, secret og subscriptions | Eventet kan lagres uten å bli levert eksternt. |

Det finnes ikke en egen Salesforce- eller HubSpot-connector i denne
kartleggingen. Public API-et kan brukes av slike klienter, men er en generell
API-flate.

## 7. Workers og cron

### 7.1 Eksternt planlagte GitHub Actions

| Jobb | Plan | Endepunkt | Token | Status |
|---|---|---|---|---|
| Follow-up-varsler | Hvert 15. minutt | `/api/admin-room/lead-map/cron/followup-notifications` | `MIGRATE_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Intelligence rescore | 04:00 UTC daglig | `/api/leadgrid/intelligence/cron/daily-rescore` | `LEADGRID_INTELLIGENCE_CRON_TOKEN` | **Aktiv · betinget** |
| Retention cleanup | 03:00 UTC daglig | `/api/leadgrid/cron/retention-cleanup` | `LEADGRID_INTELLIGENCE_CRON_TOKEN` | **Aktiv · betinget** |
| Org/NACE-backfill | 03:15 UTC daglig | `/api/leadgrid/cron/backfill-organization-id|nace` | `LEADGRID_INTELLIGENCE_CRON_TOKEN` | **Aktiv · betinget** |
| E-postdrips | Hver time | `/api/leadgrid/drips/run` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Plan grace expiry | 03:00 UTC daglig | `/api/leadgrid/plan-grace/expire` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Scheduled reports | Hver time | `/api/leadgrid/scheduled-reports/run` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Doffin watch | Hver time `:15` | `/api/leadgrid/doffin/cron/check-watches` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Doffin ukesdigest | Mandag 05:00 UTC | `/api/leadgrid/doffin/cron/ukesdigest` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Trips månedsrapport | Første dag 06:00 UTC | `/api/leadgrid/trips/report/cron` | Workflow sender `LEADGRID_CRON_TRIGGER_TOKEN`; backend leser `CRON_TRIGGER_TOKEN` | **Krever verifisering** |
| CPV-backfill | 03:30 UTC daglig | `/api/leadgrid/cpv/backfill` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| API overage billing | 05:00 UTC daglig | `/api/leadgrid/api-overage/process` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Leadbook AI billing | 05:15 UTC daglig | `/api/leadgrid/leadbook/ai-usage/bill` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Partner webhook retry | Hvert 5. minutt | `/api/superadmin/webhook-deliveries/process` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |
| Partner reverification | 04:00 UTC daglig | `/api/leadgrid/reverifications/check` | `LEADGRID_CRON_TRIGGER_TOKEN` | **Aktiv · betinget** |

Trips-jobben har et konkret navn-avvik mellom
[GitHub Action](../../../.github/workflows/leadgrid-go-monthly-report.yml) og
[`leadgrid-trips-routes.ts`](../../../backend/server/leadgrid-trips-routes.ts).
Det virker bare dersom begge miljøvariablene finnes med samme verdi.

### 7.2 In-process pollere og vedlikehold

| Worker | Intervall | Persistens/failover | Status |
|---|---|---|---|
| Continuous discovery | Hvert 5. minutt | Leser DB-config, men scheduler kjører per serverinstans med overlap-guard bare i prosessen. | **Hybrid** |
| Workflow wait/resume | Boot +2 min, deretter hvert 5. minutt | Resume jobs ligger i DB og claims er låst; polleren er per instans. | **Aktiv** |
| URL research recovery | Boot +5 min, deretter hver time | Gjenopptar fastlåste DB-batches; timer per instans. | **Aktiv** |
| Import preview cleanup | Lokal timer | Preview-token er kun minne. | **Hybrid** |
| API-key rate bucket cleanup | Lokal timer | Rate limit-state er kun minne. | **Hybrid** |
| WebSocket heartbeat/presence | Lokal timer | Ingen delt state mellom instanser. | **Hybrid** |

Rutene `/api/lead-map/cron/re-engagement` og
`/api/leadgrid/cron/expire-old-webhook-secrets` er montert, men gjennomgangen
fant ingen matchende GitHub Action. Legacy rule-engine har også cron-triggernavn
uten funnet scheduler.

## 8. Realtime, kø og flerinstansatferd

| Komponent | Sti | Auth/scope | Skalering | Status |
|---|---|---|---|---|
| Leadgrid realtime | `/ws/leadgrid?token=...` | Token fra `activeSessions`; user-kanal må være egen, org-kanal krever medlemskap. | Clients/subscriptions er per Node-prosess. | **Hybrid** |
| Canvas realtime | `/ws/leadgrid-canvas?notatId=...&token=...` | Token fra `activeSessions`; owner/org/share-sjekk. | Presence og stroke-relay er per prosess. | **Hybrid** |
| AI-kø | Intern `withAIQuota` | Global provider-RPM og valgfri org-RPM. | Queue, counters og venting er per prosess; ingen Redis. | **Hybrid** |
| Import preview | Internt file token | Koblet til innlogget importflyt. | Buffer/token er per prosess. | **Hybrid** |
| API-key rate limit | `/api/v1/*` | API key/scopes. | Buckets er per prosess og kan omgås på tvers av instanser. | **Hybrid** |

Begge WebSocket-serverne bruker bare in-memory `activeSessions` ved upgrade og
har ikke den persisted-session-fallbacken som enkelte HTTP-ruter har.
`/api/leadgrid/realtime/health` er offentlig og viser client/subscription-count;
`/api/leadgrid/ai-queue/health` krever admin.

## 9. Testbevis

Den statiske tellingen fant 16 relevante testfiler og omtrent 299 deklarerte
`it(...)`/`test(...)`-tilfeller. Dette er et inventar, ikke bevis på at hele
pakken ble kjørt grønt på snapshot-datoen.

| Testfil | Dekning | Tilfeller |
|---|---|---:|
| `backend/server/__tests__/leadgrid-import.test.ts` | Import/parsing/dedupe | 10 |
| `backend/server/__tests__/leadgrid-industries.test.ts` | Industries og routing-classification | 22 |
| `backend/server/__tests__/leadgrid-intelligence-engine.test.ts` | Scoring/NBA | 50 |
| `backend/server/__tests__/leadgrid-route-service.test.ts` | Rutealgoritme | 9 |
| `backend/server/__tests__/leadgrid-territory-service.test.ts` | Territory-geometri | 37 |
| `backend/server/__tests__/leadgrid-url-research.test.ts` | URL research | 17 |
| `backend/server/leadgrid-bulk-url.test.ts` | Bulk URL processor | 23 |
| `backend/server/leadgrid-deal-defaults.test.ts` | Deal defaults | 6 |
| `backend/server/leadgrid-deals-service.test.ts` | Deal service | 6 |
| `backend/server/leadgrid-pricing-config.contract.test.ts` | Pricing-kontrakt | 5 |
| `backend/server/leadgrid-realtime-lead-created.test.ts` | Lead-created realtime-event | 5 |
| `backend/server/leadgrid-research-quality.test.ts` | Research quality/classification | 14 |
| `backend/server/leadgrid-workflow-engine.test.ts` | Workflow engine | 20 |
| `backend/server/leadgrid-workflow-extensions.test.ts` | Nye triggers/actions | 40 |
| `backend/server/leadgrid-workflow-types.test.ts` | Type-/validatorregler | 30 |
| `backend/server/integrations/leadgrid-sales-signal-sync.test.ts` | Sales signal sync | 5 |

Tyngden ligger på rene funksjons- og service-enhetstester. Det finnes svært lite
HTTP-/DB-/tenant-bevis for de flere hundre handlerne. Særlig auth, RBAC,
entitlements, public API, partner, billing, Doffin, Canvas, Academy, Pondus,
feltarbeid, cockpit og kundeportal mangler negative tenant-tester.

Post-deploy smoke i
[`leadgrid-post-deploy-smoketest.yml`](../../../.github/workflows/leadgrid-post-deploy-smoketest.yml)
prober bare et begrenset intelligence/analytics/territory/meeting/bridge-utvalg.
Den forsøker også å lese commit fra `/api/health`, mens serverens commit-info
ligger på `/api/version`; commit-verifikasjonen blir dermed ineffektiv.

## 10. Uregistrert, overlap og legacy

| Funn | Status | Bevis og konsekvens |
|---|---|---|
| `leadgrid-app-waitlist-routes.ts` | **Legacy/ikke nåbar** | Filen er ikke importert eller registrert. Webfrontend kaller likevel `/api/leadgrid/app-waitlist`, `/status` og `/notify-launch`, som derfor treffer API-404. |
| `lead-map-agent-routes.ts` | **Legacy/ikke nåbar** | Ingen import/registrering funnet. Ser ut til å være erstattet av research/agent bridge. |
| `leadgrid-lead-routing-service.ts` | **Legacy/ikke nåbar** | Bare importert av test, ikke av runtime. |
| `leadgrid-parking-routes.ts` og `leadgrid-parkering-routes.ts` | **Aktiv** + shadowed duplikat | Begge deklarerer `GET /api/leadgrid/parking/nearby` og `/:id`. Førstnevnte registreres ved `index.ts:67193`; sistnevnte ved `:67216` blir aldri truffet. Responskontraktene er ulike. |
| Legacy Lead Map og native Leadgrid | **Aktiv parallell** | `/api/admin-room/lead-map/*`, Role Room Agent-scope og `/api/leadgrid/*` bruker samme leads, men ulike auth-/scopehjelpere. |
| Legacy rules og Smart Workflows | **Aktiv parallell**, legacy delvis | To automasjonsmodeller; legacy cron-triggerne har ingen funnet scheduler. |
| Public Leadgrid API og partner API | **Aktiv parallell** | Ulike key-formater, scopes, tabeller og dokumentasjonsgrad. OpenAPI dekker bare Leadgrid public API-delsettet. |

Frontendbevis for den umonterte ventelisten finnes i
`frontend/client/src/pages/admin-workspace/LeadgridAppWaitlistTab.tsx` og
`frontend/client/src/pages/leadgrid-landing.tsx`.

## 11. Prioriterte tekniske risikoer

| Prioritet | Risiko | Konsekvens | Anbefalt bevis før status kan forbedres |
|---:|---|---|---|
| **P0** | Workflow-eventrutene håndhever ikke lovet auth/signatur. | En caller kan injisere e-post-, møte-, proposal- eller contract-events og starte workflows/webhooks i en oppgitt org. | Signert provider-token/HMAC eller session/service identity, tenant-binding og negative API-tester. |
| **P0** | Org-status-middleware er registrert etter den første store ruteblokken. | Paused/suspended org kan nå eldre registrerte ruter uten denne håndhevelsen. | Flytt/gjenbruk middleware før ruteregistrering og test GET/write for active, paused og suspended. |
| **P1** | Org/session/scope er fragmentert og delvis fail-open. | Ulik synlighet, mulig IDOR/tenant-avvik og forskjellig atferd mellom restart/instanser. | Én org-resolver, persisted session overalt og tenant-negative kontrakttester. |
| **P1** | Partner-/onboarding-skjema kan ikke rekonstrueres, og runtime DDL er utbredt. | Fresh deploy, CI og recovery kan få et annet skjema enn produksjon. | Fullstendige idempotente migrasjoner og en strict schema-verifikasjon for alle aktive moduler. |
| **P1** | App-waitlist-klientene peker på en uregistrert backend. | Synlig ventelisteflyt ender i 404. | Registrer ruten eller fjern klientinngangen; test join/status/notify. |
| **P1** | Parking-ruter er duplisert og shadowed. | Død implementasjon og uklar responskontrakt. | Velg én kontrakt, fjern/endre den andre og legg til route-test. |
| **P1** | AI usage-tracking er ikke koblet, og per-org quota får ofte `null`. | Billing/observability blir feil og én org kan bruke global kapasitet uten org-meter. | Koble `recordAIUsage` og krev org-ID i alle Leadgrid AI-kall. |
| **P1** | Import godtar felter som ikke persisteres og mangler transaksjon/rollback. | Data går stille tapt og batcher kan bli delvis importert. | Full feltkontrakt, transaksjon eller resumable commit og rollback-/idempotens-test. |
| **P1** | Realtime, AI-kø, rate limits og import-preview er prosesslokale. | Flere instanser gir tapte events, ulik throttling og ugyldige tokens. | Delt session/cache/pub-sub/queue og flerinstans-test. |
| **P2** | Public API bruker foreldet owner-membership-scope og minimal OpenAPI. | Leads kan mangle etter eierskifte; integratører får ufullstendig kontrakt. | Scope direkte på org-ID, migrasjons/backfill-test og komplett versionert OpenAPI. |
| **P2** | `crm_visits` og `crm_lead_activities` mangler customer-FK. | Foreldreløse rader ved sletting eller feilaktige writes. | Datavask, FK-migrasjon og delete-policy. |
| **P2** | Route-/auth-/tenant-testdekningen er lav relativt til API-omfanget. | Feil i serverregistrering, gates og dataisolasjon oppdages sent. | Prioriter kontrakttester per modulgruppe og reelle E2E-smoke-flows. |

## 12. Endringsregel for denne referansen

Oppdater dette kapitlet i samme endring når en Leadgrid-endring:

1. registrerer, avregistrerer eller flytter et API-prefix;
2. endrer session, org-resolver, permission, entitlement eller plan-gate;
3. legger til eller endrer en tabell, migrasjon eller runtime DDL;
4. legger til provider, webhook, worker, cron eller WebSocket-event;
5. gjør en deferred action reell;
6. endrer en uregistrert/legacy/duplisert modul;
7. legger til testbevis som endrer statusen til en modulgruppe.

