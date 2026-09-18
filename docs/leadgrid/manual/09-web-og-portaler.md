# Leadgrid web og portaler

**Verifisert mot kode:** 29. august 2026  
**Omfang:** `leadgrid.no`, prefiksede `/leadgrid/*`-ruter, Admin Room Lead
Map, superadmin, partnerflater, klientportal og webklientenes API-koblinger.

Dette kapitlet beskriver hva som faktisk er nåbart på web. Det er viktig fordi
«Leadgrid web» i dagens kode ikke er én samlet applikasjon. Flaten består av:

1. et offentlig nettsted for marked, registrering og dokumentasjon;
2. enkelte produktflater som åpnes med direkte lenke;
3. Lead Map-verktøy inne i det eierstyrte Admin Room;
4. separate superadmin-, partner- og klientportaler.

Statusene følger [manualens statusspråk](./README.md#statusspråk). «Aktiv» betyr
at en inngang og reell dataflyt er koblet. Det betyr ikke at flyten er testet i
nettleser mot produksjon.

## 1. Arkitektur og routing

### Bootstrap og vertsnavn

Leadgrid har ikke et separat frontend-bygg. Den delte webklienten velger
Role Room-bootstrapen og lar `casting-main.tsx` avgjøre hvilken side som skal
rendres.

| Inngang | Oppførsel | Status | Kildebevis |
|---|---|---|---|
| `leadgrid.no` | `/` tolkes internt som `/leadgrid` | Offentlig flate | `frontend/client/src/main.tsx`, `frontend/client/src/components/role-room/casting-main.tsx` |
| `www.leadgrid.no` | Samme dedikerte Leadgrid-host | Offentlig flate | `frontend/client/src/components/role-room/utils/runtime.ts` |
| `leadgrid.theroleroom.com` | Samme dedikerte Leadgrid-host | Offentlig flate | `frontend/client/src/components/role-room/utils/runtime.ts` |
| Delt Creatorhub/Role Room-host | Krever normalt `/leadgrid/*`-prefiks | Offentlig flate | `frontend/client/src/components/role-room/casting-main.tsx` |
| Localhost | Bruker samme bootstrap og rutevalg | Krever verifisering | `frontend/client/src/main.tsx` |

På dedikert host opprettes rene aliaser. Eksempelvis blir `/priser` behandlet
som `/leadgrid/priser`, `/importer` som `/leadgrid/import`, og `/demo` som
landingssiden. Prefiksede URL-er fortsetter å virke.

Routing er implementert som eksplisitte sammenligninger av `pathname`, ikke
som et eget Leadgrid-rutetre med layout og navigasjon. Konsekvensene er:

- Import, Deals, Workflows, Partner og Lead Map deler ikke app-shell.
- Det finnes ingen samlet innlogget Leadgrid-startside på web.
- En ukjent URL på dedikert host viser landingssiden i stedet for en 404-side.
- Feilskrevne og foreldreløse lenker kan derfor se ut som om de virker, men
  brukeren havner på forsiden.

### API-klient og sesjon

Webflatene bruker ikke én felles Leadgrid-klient:

| Mønster | Brukes blant annet av | Merknad |
|---|---|---|
| Rå `fetch` med cookie/`credentials: include` | landing, partner og portaler | Avhenger av delt websesjon der ruten ikke er offentlig |
| `apiRequest` | Deals og Workflows | Delt Creatorhub query-klient |
| `apiFetch` | superadmin | Egen wrapper brukt av administrasjonsflater |
| Egen `authHeaders` med `rr_bearer` | Lead Map | Avviker fra flere andre webflater |
| `creatorhub_auth_token` eller `token` | enkelte outreach-flater | Ytterligere auth-variant |

Dette er en kilde til ulik 401-håndtering, ulik org-kontekst og ulik
feilpresentasjon. Statisk inspeksjon bekrefter klientkallene, men ikke at alle
sesjonsvariantene fungerer på alle Leadgrid-vertsnavn. Status for denne delen
er **Krever verifisering**.

## 2. Offentlig flate

### Landingsside og registrering

| Funksjon | Aktiv inngang | Data/API | Status | Begrensning og kildebevis |
|---|---|---|---|---|
| Landingsside | `/` eller `/leadgrid` | Leser offentlig pris, partnere og testimonials | Offentlig flate | Aktiv hovedinngang. `frontend/client/src/pages/leadgrid-landing.tsx` |
| Produkthistorie og funksjonsseksjoner | Ankere på landingssiden | Ingen egen lagring | Offentlig flate | Markedsinnhold, ikke i seg selv bevis på produktfunksjon |
| Start gratis | Modal fra landingssiden | `POST /api/leadgrid/self-onboard` | Offentlig flate | Oppretter organisasjonsflyt med `templateKey: solo`. Serverruten er registrert i `backend/server/index.ts`; klient i `leadgrid-landing.tsx` |
| Book demo | Modal fra landingssiden | `POST /api/leadgrid/demo-request` | Offentlig flate | Reell innsending. `backend/server/leadgrid-demo-request-routes.ts` |
| App-venteliste | «Logg inn» på landingssiden | Forsøker `POST /api/leadgrid/app-waitlist` | Demo/prototype | Ruteimplementasjonen finnes, men er ikke importert eller registrert i `backend/server/index.ts`. `backend/server/leadgrid-app-waitlist-routes.ts` |
| Dynamisk landingspris | Prisseksjonen | `GET /api/leadgrid/pricing-config` | Offentlig flate | Offentlig lesing; superadmin kan skrive konfigurasjonen |
| Dedikert prisside | `/priser` eller `/pricing` | Hardkodet side | Hybrid | Viser Solo Free, Solo Pro og Agency. CTA legger `signup` og `billing` i URL-en, men landingssiden leser ikke parameterne. `frontend/client/src/pages/leadgrid-pricing.tsx` |
| Partnere og testimonials | Landingssiden | `GET /api/leadgrid/partners`, `GET /api/leadgrid/testimonials` | Offentlig flate | Dynamiske seksjoner med fallback i klienten |

«Logg inn» er dermed ikke en innloggingsinngang til Leadgrid. Den åpner
ventelisten fordi produktet presenteres som TestFlight-/før-App-Store-fase.

### Innhold, personvern og utviklere

| Flate | Rute | Status | Kildebevis |
|---|---|---|---|
| Personvern | `/personvern` | Offentlig flate | `frontend/client/src/pages/leadgrid-personvern.tsx` |
| Samtykke til automatisk research | `/personvern/automatisk-research` | Offentlig flate | `frontend/client/src/pages/leadgrid-research-consent.tsx` |
| Guide til å skaffe leads | `/skaffe-leads-guide` | Offentlig flate | `frontend/client/src/pages/leadgrid-skaffe-leads-guide.tsx` |
| Guide til feltsalg | `/feltsalg-for-salgsteam` | Offentlig flate | `frontend/client/src/pages/leadgrid-feltsalg-salgsteam.tsx` |
| Akademi | `/akademi` | Offentlig flate | `frontend/client/src/pages/leadgrid-akademi.tsx` |
| Akademi: salg og marked | `/akademi/samarbeid-salg-marked` | Offentlig flate | `frontend/client/src/pages/leadgrid-akademi-samarbeid-salg-marked.tsx` |
| Akademi: velge CRM | `/akademi/velge-crm-feltsalg` | Offentlig flate | `frontend/client/src/pages/leadgrid-akademi-velge-crm-feltsalg.tsx` |
| Partner marketplace | `/marketplace` | Offentlig flate | `GET /api/leadgrid/marketplace`; `frontend/client/src/pages/leadgrid-marketplace.tsx` |
| Connector-katalog | `/connectors` | Offentlig flate | Statisk katalog i `frontend/client/src/pages/leadgrid-connectors.tsx` |
| Utviklerportal | `/utviklere` | Offentlig flate | `frontend/client/src/pages/leadgrid-developers.tsx` |
| Utviklersøknad | `/utviklere/soknad` | Offentlig flate | `POST /api/leadgrid/developer-application`; `backend/server/developer-application-routes.ts` |
| OpenAPI og public API v1 | API-/utviklerflaten | Backend/API | `backend/server/leadgrid-public-api-v1.ts`, `backend/server/leadgrid-openapi-spec.ts` |

Public API v1 eksponerer i denne gjennomgangen helse, liste/opprett/hent lead
og anbefalinger. Connector-siden beskriver en bredere integrasjonsverden enn
det de aktive webinngangene alene bekrefter. Hver «Live»-connector må derfor
verifiseres mot faktisk nøkkeloppsett, leverandør og ende-til-ende-kall.

## 3. Produktflater via deep link

Disse sidene finnes i den aktive routeren, men bortsett fra Import er de ikke
samlet i dagens hovednavigasjon.

| Funksjon | Rute/inngang | Reell dataflyt | Status | Begrensning og kildebevis |
|---|---|---|---|---|
| CSV/Excel-import | `/import`, lenket fra landing | Preview, mapping, deduplisering og commit via `/api/leadgrid/import/csv/*` | Aktiv · betinget | Krever innlogget org. `frontend/client/src/pages/leadgrid-import.tsx` |
| URL Research | Fane på `/import` | Oppretter batch, poller progresjon/resultat og kan avbryte via `/api/leadgrid/url-research/batch*` | Aktiv · betinget | Full webflyt selv om eldre kommentarer omtaler funksjonen som iPad-only |
| Deals/pipeline | `/deals` | Leser forecast/at-risk og oppdaterer beløp, sannsynlighet og forventet dato | Hybrid | Kolonner grupperer status, men web har ikke drag-and-drop eller stage-editor. `frontend/client/src/pages/leadgrid-deals.tsx` |
| Workflow Builder | `/workflows` | CRUD, aktivering, templates og execution history | Hybrid | Synlig builder sender alltid `conditions: []`; mangler full redigering og reell manuell execute-knapp. `frontend/client/src/pages/leadgrid-workflows.tsx` |
| Workflow-destinasjoner | `/workflows/webhooks` | CRUD og test for generisk webhook, Zapier, Make, n8n, Slack og Teams | Aktiv · betinget | Lenket fra workflow-siden; avhenger av org, secrets og leverandørkonfigurasjon. `frontend/client/src/pages/leadgrid-workflow-webhooks.tsx` |

Importens ferdig-CTA peker til `/leadgrid/map`, men routeren har ingen slik
side. På dedikert host skjules feilen av fallbacken til landingssiden.

## 4. Admin Room Lead Map

Den mest omfattende Leadgrid-webfunksjonen ligger ikke på en ordinær
Leadgrid-rute. Den nås gjennom:

`/admin-room?adminTab=marketing-cockpit&cockpitTab=leads`

`AdminRoom.tsx` har en eksplisitt eiergate for `daniel@creatorhubn.com` og
beskriver flaten som ikke-publisert. API-et har en omfattende flerrollemodell,
men dagens webnavigasjon gjør derfor ikke hovedverktøyet tilgjengelig for en
vanlig Leadgrid-organisasjon.

### Monterte arbeidsflater

| Område | Hva brukeren kan gjøre | Status | Gate og kildebevis |
|---|---|---|---|
| Lead Map | Se Leaflet-kart, status-/logo-pins, konkurrenter og live teamposisjoner | Aktiv · betinget | Eiergate + Lead Map API. `frontend/client/src/components/admin/LeadMapPanel.tsx` |
| Lead- og kartfilter | Søk, status, by/radius, lead/konkurrent, anbefaling og trusselnivå | Hybrid | Det synlige 7-dagersfilteret har ingen faktisk filterhandling |
| Leaddetalj | Kontakt, status, notat, tags, ansvarlig, besøk, prosjekt og oppfølging | Aktiv · betinget | `/api/admin-room/lead-map/*`; permissions håndhever deler av flyten |
| Beriking | BRREG, økonomi/IP, SSB-demografi, Google Places og nettstedsresearch | Aktiv · betinget | Krever eksterne tjenester og konfigurasjon |
| AI og outreach | Anbefaling, pitch, strategi og outreach-utkast | Aktiv · betinget | Blant annet `ai.use_claude` og `/api/integrations/outreach/compose` |
| Konkurrentarbeid | Opprett/vis trussel, Claude-vurdering og motkampanje | Aktiv · betinget | Sletting har egen permission; ekstern AI er betingelse |
| Prosjektkontekst | Koble leads til prosjekt, brand kit og market scan; lage rapport | Aktiv · betinget | Aktiv org/prosjekt og relevante permissions |
| Import/eksport | Google Places-import, enkel web-CSV-import og CSV-eksport | Hybrid | Kartets CSV-parser tar bare de første 100 radene; den dedikerte importsiden har en annen serverflyt |
| Påminnelser og aktivitet | Se forfalte, dagens og foreldede leads, kalender og aktivitet | Aktiv · betinget | Lead Map API og org-kontekst |
| iPad-paring | Opprette kortkode for native app | Aktiv · betinget | Krever gyldig sesjon og støttet native klient |
| My Day | Prioritert liste, nærhet, quota/projection/commission og hurtigkontakt | Aktiv · betinget | `LeadMapMyDayPanel.tsx`; montert i eierflaten |
| Ruteplan | Bygge rute og åpne Google Maps med stopp | Aktiv · betinget | `POST /api/leadgrid/routes/plan` |
| Leaderboard | Periode, team, sortering og teamresultat | Aktiv · betinget | admin, salgssjef eller teamleder; `LeadMapLeaderboardPanel.tsx` |
| Kvoter og auto-assign | Administrere teamkvoter og fordele leads | Aktiv · betinget | Lederroller og servergate |
| Territorier | Polygoner, administrative områder, sirkler og overlapp | Aktiv · betinget | `TerritoryGridManager.tsx` og territory-API |
| Territoriedekning | Coverage, orphan leads, teamstatistikk og live posisjon | Aktiv · betinget | `TerritoryCoveragePanel.tsx`, `TerritoryManagerDashboard.tsx` |

Lead Map har også tastaturnavigasjon, kart-/listevisning, rapportdialog,
statushistorikk og bulk prosjektildeling. Kjerneoperasjonene er koblet til API,
men hele flaten er **Aktiv · betinget** fordi aktiv inngang er eierstyrt.

### Market Intelligence i Admin Room

`MarketIntelligenceSection.tsx` lastes bak module feature `leadgrid` og viser:

- Lead Inbox med 30-sekunders oppdatering, godkjenning, avvisning, retry og
  tildeling via superadmin-API;
- Won/Lost-dashboard for 7, 30 og 90 dager, funnel, reps og eksport;
- planlagte PDF-rapporter med CRUD, send nå, mottakere og team-scope.

Status er **Aktiv · betinget**. Feature-gaten alene er ikke nok for en vanlig
organisasjonsbruker: Lead Inbox kaller `/api/superadmin/leads/inbox`, og hele
seksjonen ligger fortsatt under eierstyrt Admin Room.

## 5. Superadmin, partner og klientportal

### Superadmin

`/superadmin` er en direkte rute til `leadgrid-superadmin.tsx`. Serveren
avviser manglende `super_admin`-tilgang selv om URL-en er offentlig kjent.

Flaten inneholder:

- lead inbox;
- organisasjoner, opprettelse, BRREG-oppslag, mal og invitasjon;
- pause, read-only, suspend og close;
- audit-logget impersonation;
- betalinger og AI-tokenbruk;
- partnerreview og TestFlight;
- avtaler og templates;
- API-nøkler og webhooks;
- alerts, klientvarslingslogg og WhatsApp-maler;
- e-postbranding og audit.

Status er **Aktiv · betinget**. Primært kildebevis er
`frontend/client/src/pages/leadgrid-superadmin.tsx` og komponentene under
`frontend/client/src/components/leadgrid/`.

Det generelle Creatorhub-adminet har i tillegg en Leadgrid-seksjon for
offentlig pricing config, landing experience/media og testimonial-moderering.
Den er **Aktiv · betinget** og finnes i
`frontend/client/src/components/admin/LeadgridAdminSection.tsx`.

### Partnerverifisering

| Funksjon | Inngang | Status | Bevis og begrensning |
|---|---|---|---|
| Verifiseringswizard | `/innstillinger/partnerskap` | Aktiv · betinget | Sju steg, autosave, submit og dokumenter via singular `/api/leadgrid/partner-application/*`. `leadgrid-partner-wizard.tsx` og `partner-verification-routes.ts` |
| Partner-dashboard | `/partner-dashboard` | Aktiv · betinget | Progresjon, statushistorikk, reverifisering og sandbox credentials ved godkjenning. `leadgrid-partner-dashboard.tsx` |
| Eldre partnersøknad | Ingen montert rute | Legacy/ikke nåbar | `leadgrid-partner-application.tsx` bruker plural `/partner-applications`; importert, men ikke rendret av routeren |

Begge backendfamiliene er registrert. Dokumentasjonen må derfor ikke tolke
«montert serverrute» som at begge klientflytene er aktive.

### Klientportal og invitasjon

| Funksjon | Inngang | Status | Bevis og begrensning |
|---|---|---|---|
| Klientportal | `/c/{token}` | Offentlig flate | Tokenbasert visning uten Role Room-konto. `frontend/client/src/pages/leadgrid-client-portal.tsx` |
| Kundeaksept | Portalens velkomst | Offentlig flate | Seen/accept/focus persisteres via `/api/leadgrid-client/:token*` |
| Fokus og signaler | Portalinnhold | Offentlig flate | Viser score, behov, positive/negative signaler, leveranser og rådgiverkontakt |
| Varselpreferanser | Portalinnhold | Hybrid | Backendmodellen støtter e-post, SMS og WhatsApp; web viser e-post og WhatsApp, ikke SMS |
| Org-invitasjon | `/lead-map/accept` | Offentlig flate | Token/deep link i `frontend/client/src/pages/LeadMapAccept.tsx` |

Agency+-branding kan skjule «Powered by». Portalens token er tilgangsgrensen
og skal behandles som en hemmelig lenke.

## 6. Roller og faktisk nåbarhet

### Dagens brukerinnganger

| Bruker | Hva brukeren faktisk kan nå | Hva som ikke finnes i navigasjonen |
|---|---|---|
| Besøkende | landing, priser, guider, personvern, Connectors, Import-lenke, demo og registrering | Ingen reell «Logg inn til Leadgrid»-inngang |
| Innlogget org-bruker med URL | Import, Deals, Workflows og webhook destinations dersom API-gaten tillater det | Ingen felles dashboard/sidebar mellom sidene |
| Org-admin/partner | Partnerwizard og partner-dashboard med direkte URL | Ingen tydelig inngang fra Leadgrid-landingen |
| Klient med token | `/c/{token}` | Ingen ordinær konto eller produktnavigasjon |
| Daniel/eier | Admin Room → Marketing Cockpit → Leads | Dette er ikke publisert som generell Leadgrid-webapp |
| Superadmin | `/superadmin` og Leadgrid-adminpaneler | Ikke en sluttbrukerflate |

Landingssidens synlige hovednavigasjon går til Produkt, Løsninger,
Connectors, Import, Priser og Demo. Deals, Workflows, Partner, klientportal og
superadmin ligger utenfor den ordinære navigasjonen. Import er den eneste
innloggingskrevende produktflaten med tydelig lenke fra landingen.

### Rolle- og permissionmodell

Web/backend definerer blant annet `admin`, `salgssjef`, `teamleder`,
`salgskonsulent`, `promotor`, `member` og `viewer`. Nyere servermoduler har
også flere fagroller. Tilgang bygges av:

1. rolle-default;
2. per-bruker grant/revoke;
3. admin-bypass/all-permissions-gulv;
4. organisasjon, plan, entitlement og ekstern konfigurasjon.

Permissions dekker leads, besøk, konkurrenter, prosjekter, brand kit, market
scan, outreach, territorier, medlemmer, team, billing og AI. Kildebevis:

- `frontend/client/src/hooks/usePermissions.ts`;
- `backend/server/lead-map-permission-routes.ts`;
- `backend/migrations/286_lead_map_permissions.sql`.

`LeadMapViewAsBanner` lar enkelte lederroller forhåndsvise en rolle i
klienten. Dette endrer ikke serverens reelle permissions.

Den viktigste nåbarhetskonflikten er at RBAC-modellen kan gi en selger eller
teamleder tilgang til Lead Map-handlinger, mens den fullstendige webflaten er
montert inne i owner-only Admin Room. Permission er derfor ikke det samme som
en aktiv webinngang.

Delte Role Room-dashboardwidgets for Leadgrid-plan, org-bytte,
varselklokke og varselpreferanser er **Aktiv · betinget**, men de utgjør ikke
en Leadgrid web-shell. Kilde: `RoleRoomDashboardPanel.tsx`.

## 7. Broken, legacy og dokumenterte avvik

| Element | Status | Faktisk avvik | Kildebevis |
|---|---|---|---|
| `/leadgrid/map` | Legacy/ikke nåbar | Importens ferdig-CTA peker hit, men routeren har ingen map-route | `leadgrid-import.tsx`, `casting-main.tsx` |
| `/leadgrid/api-keys` | Legacy/ikke nåbar | Connectors har knapper til en rute som ikke finnes | `leadgrid-connectors.tsx` |
| `/leadgrid/partners` | Legacy/ikke nåbar | Connectors peker hit; aktiv partnerinngang har en annen URL | `leadgrid-connectors.tsx` |
| `/leadgrid/docs/zapier`, `/make`, `/slack`, `/github-actions`, `/webhooks` | Legacy/ikke nåbar | Dokumentasjonslenker uten routermatch | `leadgrid-connectors.tsx`, `casting-main.tsx` |
| `/leadgrid/developers` | Legacy/ikke nåbar | Footer bruker engelsk slug; aktiv rute er `/leadgrid/utviklere` | `leadgrid-landing.tsx` |
| App-venteliste | Demo/prototype | Klient og serverfil finnes, men serverfilen er ikke registrert | `leadgrid-app-waitlist-routes.ts`, `backend/server/index.ts` |
| Paid plan-handoff | Hybrid | Prissiden sender queryparametre som landingen ikke leser | `leadgrid-pricing.tsx`, `leadgrid-landing.tsx` |
| Pipeline «drag-and-drop» | Hybrid | Markedsføring lover drag/drop; webdeals grupperer kort uten stage-drag | `leadgrid-landing.tsx`, `leadgrid-deals.tsx` |
| Workflow conditions/manual run | Hybrid | Backend støtter mer enn webbyggeren eksponerer | `leadgrid-workflows.tsx`, `leadgrid-workflow-*.ts` |
| 7-dagers kartfilter | Hybrid | Synlig knapp uten koblet filtertilstand | `LeadMapPanel.tsx` |
| Portal-SMS | Hybrid | Datakontrakt støtter SMS, men kontrollen er ikke i web-UI | klientportalens notification preferences |
| Legacy partnersøknad | Legacy/ikke nåbar | Parallell plural API/klient er erstattet av singular wizard | `leadgrid-partner-application.tsx` |
| Lead Map org-panel | Legacy/ikke nåbar | Omfattende org/team-UI finnes, men er ikke montert | `LeadMapOrgPanel.tsx` |
| CRM customer drawer | Legacy/ikke nåbar | Komponenten og underkomponentene har ingen aktiv parent | `CrmCustomerDetailDrawer.tsx` |
| Varselkanal-onboarding på web | Legacy/ikke nåbar | Wizard finnes, men er ikke montert; eldre onboarding-doc lover en inngang | `NotificationChannelsOnboardingWizard.tsx`, `docs/leadgrid/customer-onboarding.md` |
| Admin Workspace ventelistetab | Demo/prototype | Ny adminflate finnes, men samme uregistrerte API blokkerer dataflyten | `pages/admin-workspace/LeadgridAppWaitlistTab.tsx` |

Andre avvik:

- landingslenken bruker `#løsninger`, mens seksjonen heter `#losninger`;
- dedikert-host-fallbacken skjuler manglende routes ved å vise forsiden;
- Connectors-katalogens «Live» beskriver også integrasjoner uten tilsvarende
  aktive konfigurasjons- eller dokumentasjonssider på web;
- web har to kommersielle modeller: offentlig Solo Free/Pro/Agency og en
  parallell Lead Map Discover/Pro/Agency Stripe-/entitlementmodell;
- kommentarer i Import sier at URL Research er iPad-only, mens aktiv webkode
  viser full batchflyt.

Disse punktene skal ikke omtales som aktive bare fordi en komponent eller
serverfil finnes.

## 8. Testgap og kildebevis

### Bekreftede servertester

Backend har målrettede tester for flere sentrale byggesteiner:

| Område | Testbevis |
|---|---|
| CSV-import og deduplisering | `backend/server/__tests__/leadgrid-import.test.ts` |
| URL Research og lokasjonsfallback | `backend/server/__tests__/leadgrid-url-research.test.ts`, `backend/server/leadgrid-bulk-url.test.ts` |
| Bransjeklassifisering | `backend/server/__tests__/leadgrid-industries.test.ts` |
| Intelligence/NBA/webhook-signatur | `backend/server/__tests__/leadgrid-intelligence-engine.test.ts` |
| Territoriegeometri og coverage | `backend/server/__tests__/leadgrid-territory-service.test.ts` |
| Ruteplan og fallback | `backend/server/__tests__/leadgrid-route-service.test.ts` |
| Deals, defaults, forecast og at-risk | `backend/server/leadgrid-deal-defaults.test.ts`, `backend/server/leadgrid-deals-service.test.ts` |
| Workflowtyper, extensions og engine | `backend/server/leadgrid-workflow-types.test.ts`, `leadgrid-workflow-extensions.test.ts`, `leadgrid-workflow-engine.test.ts` |
| Pricing-kontrakt | `backend/server/leadgrid-pricing-config.contract.test.ts` |
| Realtime lead-created | `backend/server/leadgrid-realtime-lead-created.test.ts` |
| Research-kvalitet | `backend/server/leadgrid-research-quality.test.ts` |
| Salgssignalsynk | `backend/server/integrations/leadgrid-sales-signal-sync.test.ts` |

Dette er i hovedsak tjeneste- og kontraktbevis, ikke bevis på at en bruker kan
fullføre samme flyt fra nettleseren.

### Manglende web-E2E

Gjennomgangen fant ingen dedikert browser-E2E som utøver:

- offentlig signup, demo eller venteliste;
- navigasjonen og alle offentlige URL-er;
- CSV/Excel-import og URL Research;
- Deals, Workflow Builder eller webhook destinations;
- partnerwizard og partner-dashboard;
- klientportal, tokenavvisning og varselpreferanser;
- superadmin og rolleavvisning;
- Admin Room Lead Map, territorier, My Day eller leaderboard;
- tillatt og sperret RBAC-bruker mot de samme API-ene.

`frontend/e2e/` har omfattende dekning for andre Creatorhub-flater, men ingen
bekreftet full Leadgrid-produktreise. Webhelheten er derfor **Krever
verifisering** selv der enkeltfunksjoner er klassifisert som aktive.

### Primære sannhetskilder

Ved senere revisjon skal disse kontrolleres først:

1. Host/bootstrap: `frontend/client/src/main.tsx` og
   `frontend/client/src/components/role-room/utils/runtime.ts`.
2. Aktiv webrouter: `frontend/client/src/components/role-room/casting-main.tsx`.
3. Offentlige sider: `frontend/client/src/pages/leadgrid-*.tsx` og
   `frontend/client/public/leadgrid-sitemap.xml`.
4. Admin Room: `frontend/client/src/pages/AdminRoom.tsx`,
   `MarketingCockpitTab.tsx` og `components/admin/LeadMap*.tsx`.
5. Superadmin/portal: `leadgrid-superadmin.tsx`,
   `leadgrid-client-portal.tsx` og partnerkomponentene.
6. Monterte serverruter: `backend/server/index.ts`.
7. Public API: `backend/server/leadgrid-public-api-v1.ts` og
   `backend/server/leadgrid-openapi-spec.ts`.
8. Permissions: `usePermissions.ts`, `lead-map-permission-routes.ts` og
   migrasjon `286_lead_map_permissions.sql`.

En side skal flyttes fra **Legacy/ikke nåbar** eller **Backend/API** til
**Aktiv** først når både inngangen, API-kallet, persistensen og korrekt
tilgangshåndhevelse er verifisert.
