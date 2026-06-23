# Leadgrid — skalerings-roadmap

> **Primær lens:** alt vurderes på "hva skjer ved 10× / 100× / 1000× volum".
> **Sist oppdatert:** 2026-06-23 etter PR #851/#854/#855/#856/#857/#858/#859/#861/#862/#863.
> **Levetid:** levende doc — oppdateres når terskler endrer seg.

## 1. Hvor er vi nå (baseline 2026-06-23)

| Metrikk | Verdi | Skalerings-bekymring |
|---|---|---|
| Aktive orgs | 1 (Creatorhub AS) | Ingen multi-tenant test |
| Aktive leads | ~2 i prod (verifisert via cron) | Datamodell utesta |
| Backend-instance | 1 (Render free plan) | Cold-start risiko, 1 vCPU |
| DB-tier | Neon (pooled) | Auto-scale, men ingen read-replicas |
| Webhook-subscribers | 0 aktive | HMAC/retry untested ved last |
| Daily cron-volum | 2 leads × 4 queries = 8 DB-calls | Trivielt |
| AI-kall/dag | Markedsføring + research = ~10-50 Claude-kall | Innen Anthropic-quota |

## 2. Skalerings-terskler — når slår hvert problem til?

Hver bekymring fra robusthet-auditen har en **konkret terskel** (data-volum/last-pattern) der den slutter å være teoretisk og blir produksjons-blokker.

### A. Database-laget

| Problem | Terskel | Symptom | Hvorfor |
|---|---|---|---|
| **N+1 i `computeIntelligenceForLead`** | 100 leads/org | Cron @ 04:00 UTC tar > 60s | 100 leads × 4 par-queries = 400 DB-roundtrips. Neon pooler bra, men latency dominerer. |
| **Tabell-vekst `lead_scores_history`** | 10k leads × 30 dager = 300k rader | Query-tider på `/history` >300ms | Index er `(lead_id, computed_at DESC)`. Greit til 10M, men cron logger 1 rad/lead/dag. |
| **`webhook_delivery_queue` vokser** | 100 webhook-subs × 10% feilrate × 30 dager = 90k rader | Worker scanner blir treig | Retry-worker scanner uten LIMIT/cleanup. |
| **`lead_recommendations` vokser** | 10k leads × 10 NBA-bytter = 100k rader | "Pending"-query treig | Eksisterende partial-index er bra, men status-mix vokser. |
| **`crm_lead_activities` historie** | 1M aktiviteter | Engagement-facet bruker 5s+ | Vi har ingen partisjonering. |
| **Concurrent cron-runs** | Hvis cron tar > 24t | Race conditions, dobbel scoring | Cron-token hindrer dette, men ingen mutex på DB-nivå. |

### B. Compute / API-laget

| Problem | Terskel | Symptom | Hvorfor |
|---|---|---|---|
| **Render free plan cold-start** | 15 min uten trafikk | iPad timeout, retry-storm | Render free-tier sover. Render Standard ($25/mnd) løser. |
| **Express 30s default timeout** | Meeting-notes med >25s lyd | iPad får 504 | Whisper kan ta 30-60s for lange opptak. |
| **Node-pg pool exhaustion** | 50 samtidige cron-leads × 4 queries = 200 connections | "too many clients" | Default pool = 10. Neon pooler er separat. |
| **In-memory `activeSessions` Map** | Backend restart | Alle iPad-tokens må re-hydreres | Hydrert fra DB ved boot (allerede fikset), men ingen Redis ennå. |
| **Claude API rate-limit** | 50 RPM på Anthropic-tier | 429-feiler | Vi har ingen request-queue. |
| **Whisper API rate-limit** | 50 RPM på OpenAI tier-1 | 429 → meeting-note feiler | Vi har ingen retry/backoff. |
| **Google Distance Matrix quota** | 100k requests/mnd gratis | Route-planning faller tilbake til haversine | Vi har fallback, men ingen monitoring. |

### C. Multi-tenant isolasjon

| Problem | Terskel | Symptom | Hvorfor |
|---|---|---|---|
| **`crm_customers.owner_user_id`-mønster sårbar** | Org med 100+ medlemmer | Lead-lekkasje på tvers? | Subquery `WHERE user_id = c.owner_user_id` returnerer FØRSTE org. Hvis bruker er i 2 orgs → race. |
| **Felles cron for alle orgs** | 100 orgs × 1k leads = 100k cron-jobs | Cron timeout > 5 min | Vi har ingen per-org-scheduling. |
| **Webhook signing-secret pr. sub** | 100 subs/org × 100 orgs = 10k secrets | Rotering manuell | Ingen automatisk rotering. |
| **AI-kost pr. org ikke trackes** | 1 org abuser Claude → blokkerer alle | Bill-sjokk | Ingen per-org rate-limit eller cost-cap. |

### D. iPad-app

| Problem | Terskel | Symptom | Hvorfor |
|---|---|---|---|
| **Ingen offline-kø** | Selger i felt uten 4G | NBA-execute glipper, ingen retry | Vi har ingen CoreData-kø. |
| **Pipeline-kanban polling** | 200+ leads i pipeline | UI stutter, batteri-drain | Bruker `fetchNBARecommendations(limit:200)` + N×`fetchLeadIntelligence` |
| **MapKit pin-rendering** | 1000+ pins på Kart | iPad 60fps droppes til 20fps | Ingen klustring; alle pins rendres som annotations |
| **Bilde/audio-upload uten chunking** | Voice-memo > 10MB | Connection-drop midt i upload | base64 i body — vi bør chunke via multipart |

### E. Observability

| Problem | Terskel | Symptom | Hvorfor |
|---|---|---|---|
| **Ingen Sentry** | Første prod-fail i felt | Vi vet ikke før kunde klager | console.warn i Render-logs er ikke gjennomsøkbart |
| **Ingen post-deploy smoke-test** | Nye PR-er | Brytene endpoints uten varsel | Vi oppdaget mig 313-bugen kun fordi vi testet manuelt |
| **Ingen cron-success alert** | Cron feiler stille @ 04:00 | Scores blir 24+ timer stale | GH-action returnerer success selv ved HTTP 500 |
| **Ingen perf-baseline** | Latency øker gradvis | "Føles tregt" uten data | Ingen p95/p99-måling pr endpoint |

## 3. Skalerings-roadmap — 3 nivåer

### Nivå 1 — **Robusthet** (juli 2026 — overlev 10 orgs × 1k leads)

Mål: ingen overraskelser under 10× nåværende last. Tid: ~2 uker.

**Sprint R1 (uke 1):**
1. **Sentry-integrasjon** på Leadgrid-stack
   - `npm i @sentry/node` + `Sentry.init({ dsn, environment, tracesSampleRate: 0.1 })`
   - Wrap alle `register*Routes` i error-handler middleware
   - Manuell `Sentry.captureException(err)` i alle catch-blocker i `leadgrid-*`
2. **Post-deploy smoke-test** GH-action
   - Kjør etter Render-deploy: hit alle 13 endepunkter, krev 401/200 (ikke 404/500)
   - Hit `/api/leadgrid/intelligence/cron/daily-rescore` med token og krev `ok:true`
   - Pages til Slack ved feil
3. **Migrate fail-fast option**
   - Ny env-var `MIGRATE_STOP_ON_FAILURE=1` på Render
   - Endre `migrate.sh` til å `exit 1` ved første mig-feil hvis flagget satt
   - Ikke endre default-oppførsel (eksisterende mig-batch kan ha tolererte feil)
4. **Schema-validator** på boot
   - Ny `backend/server/leadgrid-schema-check.ts` som SELECT'er kjente kolonner ved boot
   - Logger advarsel hvis `pipeline_stage` eller andre kritiske kolonner mangler
   - Kjør som del av health-check

**Sprint R2 (uke 2):**
5. **Cron-failure auto-retry**
   - 3× retry med exponential backoff i `leadgrid-intelligence-rescore.yml`
   - Slack-alert hvis alle 3 feiler
6. **Data-retention-cron**
   - Ny `leadgrid-cleanup-cron.yml` — kjør daglig
   - Slett `lead_scores_history` > 90 dager
   - Slett `lead_recommendations` med `status IN ('dismissed','expired')` > 30 dager
   - Slett `webhook_delivery_queue` med `status='exhausted'` > 30 dager
7. **Timing-safe token-compare**
   - Erstatt `provided !== expected` med `crypto.timingSafeEqual(Buffer.from(...))`
   - Gjelder: cron-token, webhook-signature-verify
8. **Async meeting-notes**
   - POST returnerer 202 + `meeting_note_id` umiddelbart
   - Whisper + Claude flyttes til bakgrunns-worker (samme proc, men `setImmediate`)
   - Emit webhook `meeting_note.processed` ved completion
9. **Zod-validering på 5 mest brukte endpoints**
   - `POST /intelligence/recommendations/:id/execute`
   - `POST /meeting-notes/upload-audio`
   - `POST /routes/plan`
   - `PATCH /intelligence/weights`
   - `POST /territories`

**Måling etter R1+R2:**
- Sentry har <5 unhandled errors/dag
- Post-deploy smoke-test er grønn på 100% av siste 10 deploys
- Cron-failure rate < 1%
- Tabell-størrelser stabile (vekst < 10% / uke)

### Nivå 2 — **Horisontal skalering** (aug-okt 2026 — 100 orgs × 10k leads)

Mål: takle 100× nåværende last. Tid: ~6 uker.

**Sprint H1 — Database (uke 3-4):**
1. **Batch-fetch i `computeIntelligenceForLead`**
   - Erstatt 4 separate queries med 1 CTE-basert query:
     ```sql
     WITH lead AS (SELECT ... FROM crm_customers WHERE id = $1),
          acts AS (SELECT customer_id, json_agg(activity_type ORDER BY created_at DESC LIMIT 60) FROM crm_lead_activities WHERE customer_id = (SELECT id FROM lead) GROUP BY customer_id),
          ...
     ```
   - Mål: 10k leads × 1 query = 10k roundtrips (mot 40k i dag)
2. **Cron pre-fetch + in-memory scoring**
   - Hent ALLE candidate-leads + deres activities/needs/signals i ett SELECT
   - Score in-memory i Node, batch-INSERT scores_history (én transaksjon per 1000)
   - Mål: 10k leads-cron < 30s (mot ~5-10min med naiv N+1)
3. **Materialized view `crm_lead_intel_summary`**
   - For analytics-dashboards som ikke trenger sanntid
   - Refreshes hvert 5 min via cron
4. **Neon read-replica for analytics**
   - Sett `ANALYTICS_DATABASE_URL` env-var → peker til Neon-read-replica
   - Routes analytics-queries dit, write-routes til primary
   - Eliminer read-locks på primary

**Sprint H2 — Compute (uke 5-6):**
5. **Render-oppgradering**
   - Backend: free → Standard ($25/mnd) for å eliminere cold-start
   - Webhook-worker: ny dedikert Render-service som drainer `webhook_delivery_queue`
   - Cron-worker: ny dedikert (kjører kun cron-endpoints, isolert pool)
6. **Express timeout-økning + chunked upload**
   - `app.use(timeout('120s'))` for AI-tunge endpoints
   - Multipart-upload for meeting-notes (chunk + assemble i Backblaze)
7. **AI-kø med rate-limiting**
   - Ny `backend/server/ai-queue-worker.ts` (bullmq + Redis ELLER pg-boss + Postgres)
   - Alle Claude/Whisper-kall går via køen, max 30 RPM globalt
   - Per-org rate-limit (50/min default, justerbar via `org_settings`)
8. **Connection pool-tuning**
   - Sett `pg.Pool({ max: 30, idleTimeoutMillis: 30000 })`
   - Monitor pool-stats via `pool.totalCount, pool.idleCount, pool.waitingCount`

**Sprint H3 — Multi-tenant herding (uke 7-8):**
9. **Migration: `crm_customers.organization_id` (denormalisert)**
   - Mig 319: `ALTER TABLE crm_customers ADD COLUMN organization_id UUID`
   - Backfill via cron: `UPDATE ... SET organization_id = (SELECT primary org via members)`
   - Trigger: når lead opprettes, sett `organization_id` direkte fra requesten
   - Etter backfill: alle queries kan bruke `WHERE organization_id = $1` direkte (eliminerer subquery)
10. **Per-org AI-cost tracking**
    - Ny tabell `org_ai_usage` (org_id, date, claude_input_tokens, claude_output_tokens, whisper_seconds, total_cost_usd)
    - Hver AI-kall logger pr request
    - Daily summary + alert hvis org overskrider plan-cap
11. **Per-tenant webhook-secret-rotering**
    - Ny endpoint `POST /api/leadgrid/webhooks/:id/rotate-secret`
    - Auto-rotering hver 90 dag (cron)
    - Grace-periode: gammel secret valid 7 dager etter rotering

**Måling etter H1+H2+H3:**
- Cron @ 10k leads under 30s
- p95 latency på `/follow-up-queue` < 300ms ved 100 RPS
- Backend memory stabil under 512MB ved peak
- AI-cost pr org synlig i admin-dashboard

### Nivå 3 — **Platform** (nov 2026 — feb 2027: 1000 orgs × 100k leads)

Mål: bli en plattform andre bygger på. Tid: ~14 uker.

**Sprint P1 — Real-time (uke 9-12):**
1. **WebSocket-push for iPad**
   - Backend: `socket.io` på `/socket/intelligence`
   - Backend pusher `nba.updated` event når Intelligence Engine rescores en lead
   - iPad subscriber → opportunistic UI update uten poll
2. **CDC fra Postgres → event-stream**
   - Bruker Neon LogicalReplication ELLER trigger-based event-table
   - Strøm crm_customers-endringer til Kafka-light (Redpanda Cloud) eller NATS JetStream
   - Subscribers: analytics, webhook-emitter, ML-feature-store
3. **iPad offline-kø (CoreData)**
   - Ny `OfflineActionQueue.swift` — queuer alle POST mens nettet er nede
   - Reachability-monitor drainer køen ved connectivity
   - Conflict-resolution: server-side `If-Match: <version>` header

**Sprint P2 — ML + Forecasting (uke 13-18):**
4. **ML-trained scoring-vekter**
   - Daglig ETL: dump `lead_scores_history` + actual `pipeline_stage` outcomes
   - Train gradient-boosted model (XGBoost) → optimal vekter pr facet
   - Backend `fetchWeights()` returnerer ML-trained vekter fallback til DEFAULT
5. **Attribution-modell**
   - Hva korrelerer høyest med won? (besøk-rate, follow-up-frekvens, NBA-aksept-rate)
   - Per-org dashboard: "Dine top-3 vinnende taktikker"
6. **Pipeline forecasting**
   - Claude (eller XGBoost) tar nåværende pipeline + historisk velocity → predikerer Q-revenue
   - Konfidens-bånd (10/50/90 percentil)
   - Auto-alert hvis predicted < target

**Sprint P3 — Plattform-API (uke 19-22):**
7. **Public API + dokumentasjon**
   - OpenAPI 3.1 spec auto-generert fra route-definisjoner
   - `api.leadgrid.no/docs` — Swagger UI
   - Per-partner API-keys (eksisterer i `api_keys`-tabell)
   - Rate-limit pr partner (1000 req/min default)
8. **Salesforce + HubSpot connector**
   - Out-of-the-box mapping: Leadgrid `lead` ↔ Salesforce `Lead`
   - Bi-directional sync (webhook fra Leadgrid → SF, polling fra SF → Leadgrid)
   - OAuth-integrert i `/connectors/{salesforce,hubspot}`
9. **Embeddable widget for partner-nettsteder**
   - `<script src="cdn.leadgrid.no/widget.js">` → renders pipeline-kanban i partner-app
   - JWT-basert auth, scoped til ett org

### Nivå 4 — **Hyperscale** (mars 2027+: 10000 orgs × 1M leads)

Mål: bli et alternativ til Salesforce for SMB i Norden.

1. **Multi-region deployment**
   - Render → AWS ECS (eu-west-1 + eu-north-1)
   - Cloudflare R2 for B2-erstatning (lavere egress)
   - Latency-routed via Cloudflare DNS
2. **Postgres → Citus (sharded)** eller flytt til CockroachDB
   - Sharded på `organization_id`
   - Eller: keep Neon men dele opp per region
3. **Kafka for event-streaming**
   - Redpanda Cloud i hver region
   - Connectors: → Snowflake (analytics), → Sentry (errors), → custom partner-webhooks
4. **Kubernetes for compute**
   - HPA basert på cron-queue-depth
   - Spot-instances for ML-training
5. **SOC 2 Type II + ISO 27001**
   - Compliance for enterprise-sales
   - Audit-trail på alle data-tilganger (PostgreSQL row-level security)

## 4. Konkrete tiltak NESTE 14 dager (prioritert)

| Dag | Tiltak | Eier | Måling |
|---|---|---|---|
| 1-2 | Sentry på Leadgrid-stack | backend | Errors flyter inn |
| 2-3 | Post-deploy smoke-test (GH-action) | devops | 100% grønn på siste deploy |
| 3-4 | Cron auto-retry 3× | devops | Cron-failure < 1% |
| 4-5 | Schema-validator på boot | backend | Boot feiler hvis kritiske kolonner mangler |
| 5-7 | Data-retention-cron | backend | scores_history vokst < 10%/uke |
| 7-8 | Timing-safe compare | security | crypto.timingSafeEqual brukt |
| 8-10 | Async meeting-notes (202 + worker) | backend | iPad-request < 200ms |
| 10-12 | Zod-validering på 5 endpoints | backend | Ingen JSON-relaterte 500-er |
| 12-14 | iPad offline-kø MVP | ios | NBA-execute retry-er ved 4G-drop |

## 5. Måleparameter (KPI-er)

Disse må trackes i admin-dashboard fra dag én:

**System-helse:**
- Backend uptime (SLO: 99.5%)
- API p95 latency pr endpoint (SLO: < 300ms)
- Cron success-rate (SLO: > 99%)
- Webhook delivery-rate (SLO: > 95%)

**Skalering:**
- Aktive orgs
- Total leads (org-90percentil + maks)
- Daily AI-kall (Claude tokens, Whisper sek)
- DB-størrelse per tabell

**Forretning:**
- Conversion rate (leads → won)
- NBA-aksept-rate (anbefalt → executed)
- Forecasting accuracy (predicted vs actual revenue)
- Cost per converted lead (AI-cost / wons)

## 6. Beslutningspunkter

Når nådd, må vi velge mellom:
1. **Når 50 orgs:** flytt fra Render free → Standard. Sett opp Sentry, smoke-test, retention.
2. **Når 200 orgs:** legg til Render-worker-services for cron + webhook-drain.
3. **Når 1000 orgs:** denormaliser `crm_customers.organization_id`, ML-trained scoring.
4. **Når 5000 orgs:** evaluer Postgres-sharding eller migrasjon til CockroachDB.
5. **Når 10000 orgs:** multi-region, Kafka, dedikert ML-platform.

## 7. Hva som er bra allerede

For balanse — disse byggene er allerede skalerings-vennlige:

- **Idempotent migrasjoner** med `IF NOT EXISTS` (mig 313-318)
- **Webhook fire-and-forget** med abort-timeout (webhook-emitter.ts)
- **Webhook retry-queue** (mig 313 + cron)
- **Partial-indexes** på `crm_customers` (filtrerer ut archived)
- **Chunked cron-iterasjon** (CHUNK_SIZE=50)
- **HMAC-signering** Stripe-stil (sha256=hex)
- **Lazy imports** i Agent Bridge (modul-feiler abort'er ikke hele rapport)
- **Permission-katalog** RBAC med per-bruker overstyringer (mig 286)
- **Smart Route Planner** filtrerer på territory FØR Distance Matrix (sparer Google quota)

## 8. Spørsmål for produkt-eier (Daniel)

Disse må svares før vi går videre:

1. **AI-budsjett pr org?** I dag har vi ingen cap. Forslag: 1k Claude-kall/mnd inkludert i Pro, 10k i Agency.
2. **SLA-løfter til kunder?** Trenger vi 99.5% eller 99.9%? Kostnad skalerer ~10× mellom dem.
3. **Compliance-mål?** SOC 2 / ISO 27001 først for å vinne enterprise, eller venter vi til 1000 orgs?
4. **iPad-target?** Holder vi iPad-only, eller skal vi prioritere web for skalering?
5. **Partner-API offentlig?** Når åpner vi for 3.-parts integrasjoner (SF/HubSpot)?

---

*Denne doc'en er levende. Oppdater ved hver milestone. Sjekk `_migrations_applied` + Render metrics for å validere antagelsene.*
