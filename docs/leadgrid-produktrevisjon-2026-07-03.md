# Leadgrid produktrevisjon + GTM via eget system — 2026-07-03

Gjennomført med tre parallelle kode-revisjoner: iPad-appen (`ipad/LeadMapApp/`), Catalyst web + backend (`backend/server/` + `frontend/client/src/`), og delsystemene (workflows, discovery, deals, salgsledelse, team, kommunikasjon, rapporter, AI).

## 1. Sammendrag

Backend-en er rik (territories m/ Kartverket-grenser, workflow-engine, weighted forecast, scheduled reports, public API, WebSocket-realtime, drips, RBAC) — mer enn iPad-appen eksponerer. Tre systemiske brudd hindrer «preferred system»-status:

1. **Kommunikasjon ut er en fasade**: `send_email`/`send_sms`/`send_whatsapp`/`notify_channel`/`ai_pitch_generate` i workflow-engine logges som `deferred` og sendes ALDRI (`leadgrid-workflow-engine.ts:629-640`). Ingen SMS-provider. iPad sender brukeren ut via `mailto:`/`tel:`.
2. **Team og tildeling er lokal på hver iPad**: `SalesTeamStore` = UserDefaults JSON (`SalesTeamStore.swift:8`), `AssignToTeamMemberSheet` = «Lokalt for nå» (`:21`). En leders team-oppsett finnes ikke på noen annen enhet.
3. **KPI-er er delvis pynt**: sales-leadership `trend` = hardkodet `0` (`sales-leadership-routes.ts:490`), provisjons-config lagres men brukes aldri til beregning, iPad-momentum returnerer alltid 14/22/3/7 (`Oversikt/Mocks.swift:117-120`) — enda backend-endepunktet `/api/leadgrid/momentum/today` finnes og fungerer (`leadgrid-momentum-service.ts:256`).

**De 3 viktigste grepene:** (a) wire ekte e-post-sending i workflows via Resend (allerede integrert i `transactional-email-service.ts`), (b) `/leadgrid/sales-teams`-backend + iPad-sync, (c) ekte trend/provisjon/momentum-binding.

## 2. Prioritert funn-tabell

| # | Spor | Funn | App | Impact | Innsats | Anbefalt grep | Fil/rute |
|---|------|------|-----|--------|---------|---------------|----------|
| 1 | 1+2 | Workflow-actions `send_email/sms/whatsapp/notify_channel/ai_pitch_generate` logges som «deferred» — sendes aldri | Begge | Kritisk | M | Ekte kø → Resend; SMS-provider (Twilio) senere | `leadgrid-workflow-engine.ts:629-640` |
| 2 | 1+2 | Team + lead-tildeling lagres i UserDefaults, ikke backend — ikke delt mellom enheter/web | iPad | Kritisk | M | Mig + `GET/POST/PATCH /api/leadgrid/sales-teams` + swap i SalesTeamStore | `SalesTeamStore.swift:8,84-100`, `AssignToTeamMemberSheet.swift:21` |
| 3 | 1 | Sales-leadership `trend` hardkodet `0 AS trend` | Begge | Høy | L | Beregn uke-mot-uke fra won deals/aktiviteter | `sales-leadership-routes.ts:436,490` |
| 4 | 1 | iPad-momentum hardkodet (14/22/3/7) — backend-endepunkt finnes og er korrekt | iPad | Høy | L (quick win) | Bytt `Mocks.fetchMomentumToday()` → `APIClient.fetchMomentumToday()` (`APIClient.swift:2975`) | `Oversikt/Mocks.swift:117-120` |
| 5 | 2 | Provisjons-config (balanced/aggressive/conservative) lagres men brukes aldri til beregning | Begge | Høy | M | Beregn provisjon fra won deals × aktiv modell; vis per selger | `sales_commission_configs` |
| 6 | 2 | Oppfølgingskø på iPad er hardkodet — ingen backend | iPad | Høy | M | Bind mot reminders/tasks-endepunkter | `FollowUpDetailSheet.swift:35-36` |
| 7 | 2 | Tilbud-sending finnes ikke (`.proposal`-activity ubrukt) | Begge | Høy | H | PDF-tilbud fra mal + send via Resend + `proposal.opened`-trigger (finnes alt) | `LogActivitySheet.swift:45` |
| 8 | 1 | E-post fra iPad går via `mailto:` → historikk havner i Mail, ikke Leadgrid | iPad | Høy | M | In-app composer → backend-send → auto-logget aktivitet | `KartView.swift:1440` |
| 9 | 1 | Deal-stages hardkodet, ikke per org | Begge | Middels | M | `org_pipeline_stages`-tabell + fallback til default | `leadgrid-deal-defaults.ts` |
| 10 | 3 | ICP-discovery = 16 faste regex-patterns; bransjer utenfor lista gir null treff | Backend | Middels | L | Claude-fallback når regex bommer (AI-kø finnes: `leadgrid-ai-queue.ts`) | `leadgrid-project-lead-discovery-routes.ts:313` |
| 11 | 2 | Kommune-scopet discovery mangler — Kartverket-grensene brukes ikke som discovery-filter | Backend | Middels | M | `kommune_nr` i `leadgrid_project_discovery_config` + polygon-filter | `leadgrid-continuous-discovery.ts` |
| 12 | 1 | Leads/Møter/Team-faner mangler loading/feil-tilstander; Oversikt viser 0/0/0 uten tom-tilstand | iPad | Middels | L | Standardiser `ProjectsLoadState`-mønsteret (`AppState.swift:176`) | — |
| 13 | 1 | CSV/PDF-eksport finnes på web men ikke iPad | iPad | Middels | L | Kall samme endepunkt + share sheet | `lead-export-routes.ts:396,436`, `LeadExportDialog.tsx` |
| 14 | 1 | Workflows/reports/branding/API-keys = web-only; salgsledelse-UI = iPad-only | Begge | Middels | M/H | Minst read-only innsyn på motsatt flate | — |
| 15 | 1 | Ingen strukturerte «hvorfor tapt»-kategorier på deal-nivå (WonLostDashboard finnes på web) | Begge | Lav | M | `lost_reason`-enum + obligatorisk ved Lost | `leadgrid-deals-service.ts` |
| 16 | 2 | HubSpot/Salesforce-sync ikke implementert (bekreftet) | Backend | Lav | H | La ligge; public API + webhooks dekker mye | `leadgrid-public-api-v1.ts` |

**Allerede bra:** offline-kø + posisjonssampling (RouteTracker/OfflineActionQueue), momentum-servicen backend-side, territory-matching med Kartverket + breach-logging, workflow-engine med HMAC-webhooks + audit-logg, Resend-integrasjon, RBAC, onboarding-tour + drips, scheduled PDF-reports, public API + OpenAPI.

## 3. Topp 10 «preferred system»-lekkasjer (rangert)

1. **Oppfølgings-e-post til prospekter** — workflows «sender» men gjør det ikke → Mailchimp/HubSpot-lekkasje. Verste lekkasjen; det er kjernen i produktløftet.
2. **Team-koordinering** — tildelinger synker ikke → WhatsApp/Excel for «hvem tar hva».
3. **Oppfølgingsliste i felt** — mock på iPad → Apple Påminnelser/kalender.
4. **Tilbud** — ingen generering/sending → Word/Pages + privat e-post.
5. **E-posthistorikk** — `mailto:` gjør Mail.app til CRM-historikken.
6. **Provisjon/lønnsgrunnlag** — beregnes ikke → salgssjefens Excel-ark blir fasit.
7. **Leaderboard-momentum** — trend=0 → leder lager egen ukesrapport utenfor.
8. **Eksport i felt** — kun web → «send meg lista på mail»-kultur.
9. **Egendefinert salgsprosess** — hardkodede stages → parallell tracking i eget ark.
10. **Kalender** — Google-OAuth finnes (`leadgrid-google-auth-routes.ts:81-173`) men møte-til-kalender-sync bør verifiseres e2e; dobbeltbooking driver folk til Google Calendar som primærsystem.

## 4. Spor 3 — Leadgrid bruker Leadgrid (GTM/dogfooding)

**Leadgrids egen ICP:** norske SMB-er med oppsøkende felt-salg, 3–25 selgere: solenergi-installatører, alarm/sikkerhet, telecom-forhandlere, eiendomsmeglere, håndverk (tak/fasade), bemanningsbyråer, mediebyråer med utesalg, regnskapsbyråer.

**Første dogfooding-funn:** solenergi, alarmselskap, bemanning og telecom mangler i de 16 regex-patterns — Leadgrid kan i dag ikke finne sin egen ICP med eget discovery-system. Funn #10 er selvbekreftende og bør fikses først.

**Kampanjen i appen:**
- Egen org «Leadgrid Salg» med discovery-config per region: `industry_query='eiendomsmegler'|'solcelle'|'alarmselskap'`, city_filter Oslo → Lillestrøm/Romerike → Bergen/Trondheim/Stavanger. Continuous discovery (cron) på.
- Territorier: Kartverket-kommuner per selger (Romerike som pilot), breach-logging på.
- Deal-stages: dagens hardkodede passer Leadgrids eget salg (opening→meeting→proposal→closing→won).
- Workflows: `welcome_new_lead`, `auto_followup_7_days`, `escalate_hot_leads`, `lost_lead_recovery_30d` — alle blokkert av funn #1 til send_email er wiret.
- Konkurranse: `weekly_revenue`-template + premie fra prize catalog; leaderboard krever funn #3.
- Outreach: de 7 Leadgrid-default-templatene i admin-room gjenbrukes som sekvens-innhold.

**Proof by usage:** «Vi fant dere med Leadgrid» som opener; live momentum/pipeline-tall i pitch deck (PitchDeckStudioView finnes på iPad); månedlige case-tall (X leads oppdaget, Y møter booket, Z vunnet) fra scheduled reports; `PoweredByLeadgridBanner` på alt utgående.

**Manglende features = mest solgbare (flagget):** e-postsekvenser som faktisk sender (#1), team-sync (#2), provisjonsberegning (#5), tilbudssending (#7).

## 5. Neste 2 uker

**Uke 1 — gjør tallene og kommunikasjonen ekte:**
1. iPad momentum-binding (funn #4 — quick win, endepunktet finnes)
2. Trend-beregning sales-leadership (#3)
3. `sales-teams` backend-API + iPad-sync (#2)
4. Wire `send_email` i workflow-engine → Resend, med retry + per-org rate-limit (#1)

**Uke 2 — lukk felt-flyten og start dogfooding:**
5. Oppfølgingskø backend-binding (#6) + loading/error-states (#12)
6. Provisjonsberegning fra won deals (#5)
7. ICP: Claude-fallback + utvid patterns med Leadgrids egen ICP (#10)
8. Eksport + in-app e-postlogging på iPad (#13, #8)
9. Sett opp «Leadgrid Salg»-org og kjør første discovery-kampanje på Romerike — hvert friksjonspunkt logges som produkt-backlog

## Vedlegg: delsystem-modenhet (estimat fra kodegjennomgang)

| Delsystem | Estimat | Kommentar |
|-----------|---------|-----------|
| Discovery/ICP | 75 % | Places + continuous discovery + auto-brand-scan funker; ICP = fast regex |
| Deals/forecast | 60 % | Weighted forecast + at-risk funker; stages hardkodet |
| AI (queue/research/intelligence) | 60 % | Kø + URL-research + intelligence-cron live; pitch-generator deferred |
| Workflows | 40 % | 16 triggere/20 actions/10 templates + engine; all kommunikasjon deferred |
| Salgsledelse | 40 % | Contests/premier/fulfillment live; trend + provisjon placeholder |
| Rapporter/eksport | 40 % | Scheduled PDF + web-eksport; mangler iPad-eksport + custom builder |
| Team/tildeling | 20 % | Territory-matching live; team-data 100 % lokal på iPad |
| Kommunikasjon | 15 % | Onboarding-drips + transactional; ingen sekvenser/SMS/workflow-send |
