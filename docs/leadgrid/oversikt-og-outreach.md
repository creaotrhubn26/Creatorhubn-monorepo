# Leadgrid — oversikt og outreach-løsning

**Dato**: 2026-07-01
**Status**: Kartlegging av produktet slik det ligger i monorepoet i dag.

Leadgrid er The Role Rooms norske feltsalgs- og leadplattform. Posisjoneringen
fra landingssiden (`frontend/client/src/pages/leadgrid-landing.tsx`) oppsummerer
produktet: **«Gjør kartet om til kunder»** — med flyten
*Finn → Organiser → Følg opp → Book → Lukk* og prisplanene
Starter 249 / Pro 799 / Team 1499.

---

## Produktflatene

| Flate | Hvor | Hvem bruker den |
|---|---|---|
| **Web-app** | `frontend/client/src/pages/leadgrid-*.tsx` | Salgssjefer, teamledere, org-admin |
| **iPad-app «LeadMapApp»** | `ipad/LeadMapApp/` | Selgere i felt (dør-til-dør / oppsøkende salg) |
| **Klientportal** | `/c/{token}` (`leadgrid-client-portal-routes.ts`) | Kundens kunder — token-basert, ingen innlogging |
| **Backend** | `backend/server/leadgrid-*.ts` + `lead-map-*.ts` (100+ filer) | Discovery, AI, workflows, varsling, forecasting, API |

### Web-app
- Kartbasert CRM (Leaflet) med lead-pins, detalj-drawer og bulk-actions
  (`admin-room/LeadMapPanel.tsx`)
- Deals-pipeline: 8-stegs Kanban med sannsynlighet, forventet lukkedato og
  vektet pipeline-forecast (`leadgrid-deals.tsx`)
- «Min dag»-panel: kvote-progresjon, tildelte leads sortert på prioritet og
  avstand, hurtigknapper Ring/E-post/Logg besøk (`LeadMapMyDayPanel.tsx`)
- Workflow-bygger, analytics, planlagte rapporter, fakturering (Stripe),
  partner-marketplace og offentlig utvikler-API

### iPad-app (LeadMapApp)
- MapKit-kart med statusfargede lead-pins og konkurrent-pins
- GPS-verifisert besøkslogging («Du er X meter fra leaden»), besøkstype,
  samtalereferat med Apple Pencil-støtte
- AI-outreach-strategi rett i lead-detaljen (kanal + åpningsreplikk + sekvens)
- Ruteplanlegging, territorier, dekningsanalyse
- Offline-kø (GRDB/SQLite) — leads og besøk caches og synkes ved dekning
- Pitch-deck-studio for presentasjon i kundemøtet, kalender/påminnelser,
  Apple Watch-widgets

### Klientportal
Prospektet/kunden ser sin egen markeds-score (0–100), identifiserte behov,
positive/negative signaler og leveranse-fremdrift — og kan be om fokus.
Hvert nytt funn utløser branded varsel (e-post/WhatsApp).

---

## Hvordan Leadgrid når potensielle kunder — med egen løsning

Hele kjeden fra «finn en fremmed bedrift» til «signert avtale» er dekket
uten eksterne verktøy.

### 1. Finne potensielle kunder (discovery)

| Mekanisme | Fil | Hva den gjør |
|---|---|---|
| **Market Scan** | `leadgrid-market-scan-routes.ts` | Bransje + region → Claude + Brønnøysund + Google Places finner bedrifter og auto-oppretter leads som pins, med konkurrentanalyse og kampanjemuligheter |
| **URL-research** | `leadgrid-url-research-routes.ts` | Lim inn nettside-URL → Brreg-oppslag + skraping + Claude-syntese → bedriftsprofil med opportunity-score (0–100), draft-first (preview → commit) |
| **Kontinuerlig discovery** | `leadgrid-continuous-discovery.ts` | Cron-workflow («daglig 06:00») som automatisk fyller på med nye leads per prosjekt, med dedup |
| **Prosjekt-discovery** | `leadgrid-project-lead-discovery-routes.ts` | AI leser prosjektets ICP/posisjonering og genererer Places-søk selv |
| **Lead Scout** | `lead-scout-service.ts` | Crawler leadens nettside: avdekker manglende GA4/GTM/Meta-pixel, SEO-hull og tech-stack → konkrete behov som salgsargument |
| **Inbound** | `linkedin-leadsync-service.ts`, Meta Lead Ads | Skjemaleads fra LinkedIn og Meta mates rett inn i `agency_leads` |
| **Import** | `leadgrid-import-routes.ts` | CSV/XLSX-import med kolonnemapping og dedup-strategi |

### 2. AI som bestemmer *hvordan* man tar kontakt

- **Outreach-strategi per lead** (`lead-outreach-strategy.ts`,
  `POST /api/admin-room/lead-map/leads/:id/strategy`): Claude tar
  lead-profilen + eget brand-kit og foreslår:
  - primærkanal: cold call / e-post / Instagram-DM / LinkedIn / fysisk
    besøk / SMS / social proof
  - personalisert åpningsreplikk (1–2 setninger)
  - beste tidspunkt på dagen/uka
  - 3–5-trinns oppfølgingssekvens med dag-offset
  - begrunnelse + confidence
  - Foreslår kun kanaler leaden faktisk har (mangler e-post → ekskluderes)
- **Rank-all** (`lead-map-competitor-routes.ts`): Claude rangerer alle åpne
  leads 0–100 etter «kjør outreach nå»-match mot egen posisjonering
- **Intelligence Engine** (`leadgrid-intelligence-engine.ts`): lead-score
  (6 vektede dimensjoner), temperatur (cold→ready), forventet verdi i NOK og
  **Next Best Action** med anbefalt kanal, tidspunkt og prioritet
- **Full intelligensrapport** (`leadgrid-agent-bridge-service.ts`): Brreg +
  nettstedsanalyse + konkurrenter + merch-fit + trusler + SWOT +
  outreach-strategi i én feiltolerant pipeline per lead
- **Lead-research** (`leadgrid-research-routes.ts`): dypdykk per lead med
  beslutningstaker-kartlegging og first-touch-anbefaling med mal, 30 dagers cache

### 3. Kanalene (innebygd)

| Kanal | Løsning |
|---|---|
| **E-post** | Resend (`transactional-email-service.ts`) med per-org branding — logo, avsendernavn, signatur, farger, reply-to (`leadgrid-email-branding-routes.ts`). Drypp-sekvenser dag 1/3/7/14 (`leadgrid-drips-routes.ts`) |
| **WhatsApp** | Meta Cloud API. To modeller (`docs/leadgrid/customer-onboarding.md`): **B — delt nummer** (Leadgrids WABA, 0,15 NOK/melding, kundens branding i body) eller **A — egen WABA** (kundens eget nummer og avsendernavn). 5 forhåndsgodkjente utility-templates NO+EN (`leadgrid-whatsapp-templates.ts`, `docs/leadgrid/whatsapp-templates.md`) med portal-lenke-knapp |
| **Fysisk besøk** | iPad-appens kjerne: GPS-verifisert besøkslogging, ruteplanlegging, territorier med breach-deteksjon (`leadgrid-territory-routes.ts`) |
| **Telefon** | `schedule_call`-workflowaction (`leadgrid_phone_calls`) + native ring-lenke i appene |
| **Møtebooking** | `book_meeting`-action med møtetype, varighet og valgfri kalenderinvitasjon |
| **SMS** | Planlagt, ikke aktiv — Twilio droppet, Sinch vurderes (notat i `client-notification-service.ts`) |

WhatsApp-fall håndteres ved at e-post alltid sendes i samme
`notifyClient()`-kall — prospektet mister aldri varselet.

### 4. Orkestrering: workflow-motoren

`leadgrid-workflow-engine.ts` + `leadgrid-workflow-types.ts`:

- **15 triggere**: lead opprettet / status- og temperaturendring /
  pipeline-steg / deal-endringer / e-post åpnet / lenke klikket / møte
  booket / no-show / proposal åpnet / kontrakt signert / manuell / cron
- **18 actions**: send_email, send_sms, send_whatsapp, schedule_call,
  book_meeting, ai_pitch_generate, leadgrid.discover_leads,
  change_pipeline_stage, assign_to_user, create_task, wait,
  post_to_webhook, trigger_zapier m.fl.
- **Betingelser**: lead-score, bransje, by, deal-beløp, temperatur
- Audit-logg i `leadgrid_workflow_executions`, webhook-rate-limit
  60 POST/min per destinasjon

Eksempel på helautomatisk sekvens uten eksterne verktøy:
*ny lead → AI-research → send branded e-post → vent 3 dager →
planlegg oppfølgingsanrop → ved «møte booket»: send WhatsApp-bekreftelse.*

### 5. Etter første kontakt

- **Klientportalen** holder prospektet varmt med score, funn og leveranser;
  «be om fokus» ruter tilbake til rådgiveren innen 1 virkedag
- **Varsling** (`client-notification-service.ts`): 5 event-typer
  (leveranse klar, fokus-ønske mottatt, score endret, nytt funn,
  månedsrapport) over e-post + WhatsApp, med opt-in og audit-logg
- **Momentum** (`leadgrid-momentum-service.ts`): daglig aktivitets-score
  (0–100) mot mål — kontakter, oppfølginger, møter, pipeline-bevegelser
- **Forecasting** (`leadgrid-forecasting-service.ts`): 90-dagers
  pipeline-prognose (p10/p50/p90) med attribusjon per NBA-actiontype
- **Planlagte rapporter** (`leadgrid-scheduled-reports-routes.ts`):
  daglig/ukentlig/månedlig PDF på e-post per org/team/person

### 6. Integrasjoner utover egen løsning

- **Offentlig API v1** (`leadgrid-public-api-v1.ts`): leads CRUD +
  NBA-anbefalinger med API-nøkkel, scopes og rate-limit
- **Webhooks** med secret-rotasjon, **Zapier**-action i workflows

---

## Oppsummering

Leadgrid er ikke bare et CRM — det er en lukket loop der plattformen selv:

1. **Finner** prospektene (Places / Brreg / Claude / inbound-skjemaer)
2. **Analyserer** dem (behov, score, beslutningstakere, konkurrenter)
3. **Anbefaler** kanal, åpningsreplikk og tidspunkt per lead
4. **Sender** meldingene på egen e-post- og WhatsApp-infrastruktur
5. **Følger opp** automatisk via workflows, drypp og klientportal

Det eneste hullet i kanalporteføljen i dag er SMS, som er designet inn i
workflow-typene men ikke koblet til leverandør ennå.

---

## Go-to-market: bruke Leadgrid til å selge Leadgrid (dogfooding)

Den sterkeste demoen av Leadgrid er at Leadgrid selv skaffer sine egne
kunder. Alt under bruker kun funksjonalitet som allerede finnes i repoet.

### Hvem vi jakter på (ICP)

Produktet er bygget for team som driver oppsøkende salg mot lokale
bedrifter. De mest naturlige segmentene:

1. **Byråer** (marketing-/webbyrå) som selger til SMB — de har allerede
   Agency-tier og partner-marketplace bygget for seg
   (`leadgrid-partners-routes.ts`)
2. **Feltsalgsteam** — telecom, energi, betalingsterminaler, forsikring:
   dør-til-dør-teamene iPad-appen er designet for
3. **Selvstendige selgere/konsulenter** — Solo Free → Solo Pro-stigen
   med drypp og grace-period finnes allerede (`leadgrid-drips-routes.ts`)

### Fase 1 — sett opp eget workspace

1. Opprett Leadgrid-org med eget brand-kit (posisjonering + tone) — dette
   mater `lead-outreach-strategy.ts` og rank-all, slik at AI-forslagene
   selger *Leadgrid* med riktig stemme
2. Aktiver varslingskanaler etter egen onboarding-guide
   (`docs/leadgrid/customer-onboarding.md`): e-post-branding + WhatsApp
   (egen WABA finnes allerede — se `leadgrid-whatsapp-templates.ts`)

### Fase 2 — fyll kartet med prospekter (discovery)

1. **Market Scan** per segment og region: «webbyrå i Bergen»,
   «solcelleinstallatører i Viken» → auto-opprettede pins med
   Places-berikelse (`leadgrid-market-scan-routes.ts`)
2. **Kontinuerlig discovery** som cron-workflow («daglig 06:00») per
   prioritert by, med dedup (`leadgrid-continuous-discovery.ts`)
3. **Lead Scout** på hver lead: avdekk manglende GA4/pixel/SEO
   (`lead-scout-service.ts`) — for byrå-segmentet er funnene i seg selv
   samtaleåpneren: «kundene deres lekker målbar trafikk»
4. **Inbound**: Meta Lead Ads + LinkedIn Lead Sync er allerede koblet
   (`linkedin-leadsync-service.ts`) — landingssiden har GA4- og
   Google Ads-konvertering på plass (`leadgrid-landing.tsx`)

### Fase 3 — prioriter og ta kontakt

1. **Rank-all** mot vår egen posisjonering → topp 20 «kjør outreach nå»
2. **Outreach-strategi per lead** → kanal, åpningsreplikk, beste tidspunkt
   og 3–5-trinns sekvens — generert av produktet vi selger
3. Kjør sekvensen som **workflow**: branded e-post dag 0 →
   `schedule_call` dag 3 → WhatsApp-oppfølging etter møtebooking →
   `book_meeting` med kalenderinvitasjon

### Fase 4 — klientportalen som salgsvåpen

Det unike trikset produktet muliggjør: kjør full intelligensrapport på
prospektet (`leadgrid-agent-bridge-service.ts`) og send dem **deres egen
klientportal-lenke** (`/c/{token}`). Prospektet ser sin faktiske
markeds-score, sine behov og konkurrentsignaler — gratis. Det er både
verdi levert før første møte og en live-demo av produktet de vurderer.
Hvert nye funn utløser branded varsel som drar dem tilbake.

### Fase 5 — konverter og behold

1. **Drypp-løpet** dag 1/3/7/14 etter aha-øyeblikket er allerede bygget,
   inkl. rabattkode dag 14 (`leadgrid-drips-routes.ts`)
2. **Partner-kanalen**: verifiserte byråer i marketplace
   (`leadgrid-partner-dashboard.tsx`) videreselger Leadgrid til sine
   SMB-kunder — én byrå-avtale gir mange sluttkunder
3. Mål alt med **momentum-score** (daglige kontakter/møter mot mål) og
   **forecasting** (p10/p50/p90 på pipeline) — samme dashboards som
   kundene får

### Målbilde per uke (én selger)

| Steg | Verktøy | Volum |
|---|---|---|
| Nye leads på kart | Market Scan + kontinuerlig discovery | 100–200 |
| Kvalifisert med scout + score | Lead Scout + Intelligence Engine | 40–60 |
| Aktiv outreach-sekvens | Workflows (e-post/telefon/WhatsApp) | 20–30 |
| Portal-lenker sendt | Agent bridge + klientportal | 10–15 |
| Bookede møter | `book_meeting` + kalender | 3–5 |

Hvert vunnet møte er samtidig et casestudie: «denne pipelinen fant deg,
analyserte deg og booket dette møtet — det er produktet.»
