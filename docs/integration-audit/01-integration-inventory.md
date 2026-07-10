# 1. Existing Integration Inventory + Credential Map

Metode (oppdragets §2): søk over source code (`backend/server/**`,
`frontend/**`), package-dependencies, env-deklarasjoner (`backend/render.yaml`,
`.env.example`-filer), GitHub Actions (`.github/workflows/`), API-ruter,
webhook-handlere, cron-jobber og frontend-API-klienter. Alle eksterne
API-hostnames i backend ble enumerert (`https://…`-litteraler) og hver
kandidat verifisert mot faktiske call-sites. Ingen hemmelige verdier er lest
eller gjengitt — kun navn på env-variabler.

Statusverdier følger oppdragets vokabular: `discovered / configured /
connected / partiallyImplemented / active / degraded / unavailable /
awaitingApproval / missingCredentials / disabled / deprecated / rejected`.

## §1 Integration Registry — eksisterende integrasjoner

Registry-feltene fra oppdraget §1 er formalisert i
`backend/server/integrations/integration-registry-schema.ts`. Tabellen under
er den utfylte kortformen (id, kategori, formål, auth, credentialReference,
scope, status, kodereferanse). Felter som ikke kan verifiseres fra repo
(quotas, kostnader, lastSuccessfulSync) er bevisst utelatt her — de skal leve
i registeret når det blir datadrevet, ikke gjettes i et dokument.

### Google-flater (detaljert i `docs/cto-audit/02`)

| integrationId | Formål | Auth | Credential-ref | Status | Kodereferanse |
|---|---|---|---|---|---|
| `google-workspace` | Drive/Gmail/Calendar/Meet/People/Admin | OAuth2 (+DWD) | `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_WORKSPACE_REFRESH_TOKEN`, `GOOGLE_IMPERSONATE_USER` | active | ~28 filer, f.eks. `google-oauth-shared.ts`, `google-calendar-project.ts` |
| `google-places` | Lead-/konkurrent-beriking, geosøk | API-nøkkel | `GOOGLE_PLACES_API_KEY` | active | `role-room-agent.ts`, `leadgrid-project-lead-discovery-routes.ts` |
| `google-ads` | Kampanje-innsikt, customer match, KPI | OAuth2 + developer token | `GOOGLE_ADS_DEVELOPER_TOKEN` (**ikke i render.yaml**) | partiallyImplemented → se §4 | `client-insights-service.ts`, `role-room-google-ads.ts`, `client-google-customer-match.ts` |
| `google-search-console` | Søkeytelse + site-verifisering (egne domener) | OAuth2 | brukers OAuth-token (kryptert) | active | `client-google-suite.ts`, `client-insights-service.ts` |
| `ga4-data-api` | Sessions/conversions (egne properties) | OAuth2 | brukers OAuth-token | active (via REST — npm-pakken er død, se §2) | `client-insights-service.ts:86-126`, `role-room-data-sources.ts` |
| `ga4-admin-api` | Property-/stream-discovery | OAuth2 | brukers OAuth-token | active | `client-google-suite.ts:63-124` |
| `google-tag-manager` | Container/tag-oppsett for kunder | OAuth2 | brukers OAuth-token | active | `client-google-suite.ts:994-1122` |
| `google-site-verification` | Domeneverifisering | OAuth2 | brukers OAuth-token | active | `client-google-suite.ts:161-187,752` |
| `google-indexing` | URL-notifications | OAuth2 | brukers OAuth-token | active | `client-google-suite.ts:963` |
| `youtube-data` | Publisering + innsikt (creator-modul) | OAuth2 | brukers OAuth-token | active | `social-publisher-youtube.ts`, `youtube-routes.ts` |
| `google-maps-js` | Geocoding i browser | Browser-nøkkel | frontend-nøkkel (referrer-restriksjon må bekreftes) | active | `frontend/client/src/services/GoogleMapsService.ts` |

### Norske/offentlige datakilder

| integrationId | Formål | Auth | Credential-ref | Status | Kodereferanse |
|---|---|---|---|---|---|
| `brreg` | Bedriftsprofil/organisasjonsdata, lead-beriking | Ingen (åpen API) | — | active | `lead-brreg-service.ts` + 9 andre filer (`data.brreg.no`) |
| `ssb` | Befolkning/alder/medianinntekt per kommune; lønnsstatistikk | Ingen (åpen API) | — | active | `lead-ssb-service.ts` (10s timeout, 7d cache), `nextrole-salary.ts` |
| `kartverket-geonorge` | Adresse-/geodata, reverse geocode | Ingen (åpen API) | — | active | `leadgrid-kartverket-routes.ts` + `ws.geonorge.no` (14 refs) |
| `met-no` | Værdata (Evendi) | Ingen (User-Agent-krav) | — | active | `evendi-weather-location-routes.ts` (`api.met.no`) |

### Sosiale/markedsførings-APIer (brukerens egne kontoer)

| integrationId | Formål | Auth | Credential-ref | Status | Kodereferanse |
|---|---|---|---|---|---|
| `meta-graph` | FB Pages/IG/WhatsApp/leads/KPI/Marketing | OAuth2 (app + brukertoken) | app-credentials + krypterte tokens | active | 43 filer (`graph.facebook.com`), bl.a. `role-room-kpi-connectors.ts`, `social-publisher-facebook-page.ts` |
| `tiktok-business` | Ads-/business-innsikt | OAuth2 | `TIKTOK_BUSINESS_APP_ID/SECRET` (**ikke i render.yaml**) | partiallyImplemented | `client-tiktok-suite.ts`, `role-room-tiktok-mcp.ts`, `open.tiktokapis.com` |
| `linkedin` | OAuth, ads, conversions, lead-sync | OAuth2 | `ROLE_ROOM_LINKEDIN_*` (i render.yaml) + `LINKEDIN_CLIENT_ID/SECRET` (**ikke i render.yaml**) | active / partiallyImplemented (to credential-sett) | `linkedin-oauth-routes.ts`, `role-room-linkedin-ads.ts`, `linkedin-conversions-service.ts` |
| `reddit` | Community-engasjement (script-app, lenker tilbake til original) | OAuth2 (script-app) | `REDDIT_CLIENT_ID/SECRET/USER_AGENT` (**ikke i render.yaml**) | partiallyImplemented | `reddit-engagement-service.ts` |

### AI-leverandører

| integrationId | Formål | Auth | Credential-ref | Status | Kodereferanse |
|---|---|---|---|---|---|
| `anthropic` | Kjerne-LLM (agent, market scan, anbefalinger) | API-nøkkel | `ANTHROPIC_API_KEY` (**ikke i render.yaml** — satt manuelt) | active | 89 filer |
| `openai` | Sekundær LLM/embeddings | API-nøkkel | `OPENAI_API_KEY` (i render.yaml) | active | 15 call-site-filer |
| `huggingface` | Inference (router + api-inference) | API-nøkkel | HF-token | active | div. ML-ruter |
| `elevenlabs` | TTS | API-nøkkel | — | active | `api.elevenlabs.io` |
| `cohere` | Rerank | API-nøkkel | `COHERE_API_KEY` (i render.yaml) | active | `role-room-agent.ts` |

### Kommunikasjon/infrastruktur (ikke markedsdata, men hører i registeret)

Twilio (SMS), Resend + Gmail SMTP (e-post), Cloudflare R2 (objektlager),
Render API (deploy/ops), Stripe (betaling), Web Push (VAPID), Neon (DB-konsoll).
Alle active; credential-refs i `render.yaml` bortsett fra Twilio/Resend som må
verifiseres (se §4).

## §2 Skjulte/døde integrasjoner funnet i skanningen

| Funn | Kategori (oppdragets §0) | Anbefaling |
|---|---|---|
| `google-trends-api@4.9.2` i `backend/package.json:206`, **null call-sites** | (4) kode/dep uten aktivering — og lib-en er en uoffisiell scraper (ToS-risiko) | Fjern fra package.json; erstatt aldri med scraperen — se Trends-strategien |
| `@google-analytics/data@5.2.1` i `backend/package.json:129`, **null call-sites** (GA4 går via REST) | (4) død dependency | Fjern, eller migrér REST-kallene til SDK-en bevisst — ikke la begge ligge |
| `GOOGLE_ADS_DEVELOPER_TOKEN` lest i `role-room-ads-cron.ts:269` m.fl., ikke deklarert i render.yaml | (4) kode finnes, credential-status ukjent | Deklarer i render.yaml (`sync:false`); bekreft token-klasse (leveranse 16) |
| Reddit/TikTok/LinkedIn(plain)-credentials udeklarert (se §4) | (4) | Samme — deklarer eller marker integrasjonen `missingCredentials` |
| `google-trends`/Keyword Planner: **ingen** `KeywordPlan*`-kall | (5) nødvendig datakilde finnes ikke | Se capability-matrix + Trends-assessment |
| Ingen Secret Manager, service accounts, Cloud Run/Functions/Scheduler/Tasks/PubSub/BigQuery/Firestore/Terraform | (3) ikke aktuelt — plattformen kjører ikke på GCP-infra | Ingen handling; re-evaluér ved ev. GCP-migrering |
| Cron kjører som GitHub Actions (`.github/workflows/*-cron*.yml`, 20+ workflows) | dokumentasjon | Registrer i registeret som syncMode=`scheduled` med frekvens fra workflow-fila |

## §3 Google Cloud API Inventory

`docs/cto-audit/02-google-cloud-integration-map.md` er fortsatt gyldig som
hovedinventar. Delta funnet i denne analysen:

1. **GA4 Data API er i aktiv bruk** via REST (`client-insights-service.ts`)
   — cto-audit-dokumentet sa «package present, unused»; presiseringen er at
   *npm-pakken* er ubrukt, men API-et brukes.
2. Tillegg: GA4 Admin API, Tag Manager API, Site Verification API og Indexing
   API er alle i aktiv bruk fra `client-google-suite.ts` (var ikke enumerert
   per-API i cto-auditen).
3. `analyticsadmin.googleapis.com` og `chat.googleapis.com` (Google Chat
   webhooks, `google-chat-health.ts`) hører også i inventaret.

## §4 Authentication and Credential Map (leveranse 7)

Prinsipp: rapportér *at* en credential finnes/mangler — aldri verdien.

**Deklarert i `backend/render.yaml` (sync:false — settes i Render-dashboard):**
`GOOGLE_CLIENT_ID/SECRET`, `CREATORHUB_GOOGLE_*`, `ROLE_ROOM_GOOGLE_*` (+
token-krypteringsnøkler), `GOOGLE_PLACES_API_KEY`, `GOOGLE_API_KEY`,
`ROLE_ROOM_LINKEDIN_*`, `OPENAI_API_KEY`, `COHERE_API_KEY`, `CLOUDFLARE_R2_*`,
`GMAIL_APP_PASSWORD`, `VAPID_*`, `JWT_SECRET`, `SESSION_SECRET`,
`ENCRYPTION_KEY`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`.

**Brukt i kode men IKKE deklarert i render.yaml** (trolig satt manuelt i
Render-dashboardet — udokumentert avhengighet, bør deklareres):

| Env-var | Integrasjon | Kodereferanse |
|---|---|---|
| `ANTHROPIC_API_KEY` | anthropic (kjerne!) | 89 filer |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | google-ads | `role-room-ads-cron.ts:269` |
| `REDDIT_CLIENT_ID/SECRET/USER_AGENT` | reddit | `reddit-engagement-service.ts` |
| `TIKTOK_BUSINESS_APP_ID/SECRET` | tiktok-business | `client-tiktok-suite.ts` |
| `LINKEDIN_CLIENT_ID/SECRET` | linkedin (plain-varianten) | `linkedin-oauth-routes.ts` |

**Token-lagring:** Google Workspace-/LinkedIn-OAuth-tokens lagres kryptert
(`encryptGoogleToken`/`ROLE_ROOM_*_TOKEN_ENCRYPTION_KEY` — riktig mønster, jf.
Security-rapporten). Dette mønsteret er malen for alle nye
bruker-tilkoblede datakilder (GSC/GA4/Ads for MI).

**Tenant-scoping av credentials:** brukertokens er user-/org-radete;
cto-auditens forbehold («ikke uniformt verifisert org-scopet») står — må
verifiseres per integrasjon før MI leser kundens data på tvers av orger.
