# CreatorHub priser & plan-tier

Sentral oversikt over CreatorHub Norge sine plan-tier, hva som inngår, og hvordan overforbruk håndteres. Brukes som ankerpunkt for både frontend-UI (subscription-velger, marketplace, billing-side) og backend (plan-grenser, storage-quota-enforcement, Stripe-konfig).

> **Endring krever oppdatering av:** `backend/server/index.ts` (`platformSubscriptionPlans`), `backend/server/storage-quota-service.ts` (`PLAN_STORAGE_GB`, `PLAN_ALLOWS_OVERAGE`), og denne dokumentet. Hold de tre i sync.

---

## CreatorHub-plattform (kreatør-abonnement)

Disse er de offisielle plan-tierne for kreatører som bruker CreatorHub som CRM/file-management/billing-platform.

| Tier | Pris | Storage-grense | Overage | Prosjekter | Klienter | Trial |
|---|---|---|---|---|---|---|
| **Prototype** (gratis) | 0 kr/mnd | 2 GB | ❌ Hard cap | 3 | 5 | – |
| **Trial** | 0 kr (14d) | 10 GB | ❌ Hard cap | – | – | 14 dager |
| **Basic Creator** | 249 kr/mnd | 10 GB | ❌ Hard cap | 25 | 100 | – |
| **Professional Creator** | 449 kr/mnd | 50 GB | ✅ Metered | Unlimited | Unlimited | – |
| **Premium Studio** | 1 199 kr/mnd | 250 GB | ✅ Metered | Unlimited | Unlimited | – |
| **Enterprise** | Contact sales | 1 000 GB (1 TB) | ✅ Metered | Unlimited | Unlimited | – |

**Stripe price-IDs:** `CREATORHUB_STRIPE_PRICE_ID_*` env-vars per tier.

### Overage-modell

- **Hard cap (Prototype, Trial, Basic):** Brukeren får `HTTP 507 Insufficient Storage` ved upload som ville overskredet grensen. Eneste vei videre er å (a) slette filer, (b) oppgradere planen.
- **Metered (Pro, Premium, Enterprise):** Brukeren får laste opp ubegrenset. Overage rapporteres til Stripe via `subscriptionItems.createUsageRecord({ action: 'set', quantity: overageGB })` ved hver upload-finish (chunked + single-shot). Faktureres på neste billing-syklus.

Forutsetning for metered: `subscriptions.stripe_storage_meter_item_id` må peke til en Stripe-subscription-item med `recurring.usage_type='metered'`. Settes manuelt av admin via `PUT /api/admin/storage-billing/subscriptions/:id/meter-item`.

### Anbefalt overage-pris per GB

Storage-overage prises ikke standard ennå (settes per kunde-avtale). Anbefalt utgangspunkt:
- **Professional / Premium:** ~5 kr per GB per måned
- **Enterprise:** forhandles individuelt

---

## Role Room (forretnings-abonnement)

Separat fra CreatorHub-plattformen. Role Room er en B2B-plattform for kreative team og casting.

| Tier | Pris | Seat-minimum | Storage |
|---|---|---|---|
| **Innholdsprodusent** (Content Producer) | 495 kr/seat/mnd | 1 | Følger CreatorHub-tier |
| **Produksjonsteam** (Production Team) | 795 kr/seat/mnd | 3 | Følger CreatorHub-tier |

**Seat-metering:** Implementert i `role-room-seat-stripe-sync.ts` — automatisk justering av `subscriptionItems.quantity` når brukere legges til/fjernes fra team. Prorate-billing.

**Storage:** Role Room har ikke separat storage-grense; bruker eier-kontoens CreatorHub-plan-grense.

**Stripe price-IDs:**
- `ROLE_ROOM_STRIPE_PRICE_ID_CONTENT_PRODUCER`
- `ROLE_ROOM_STRIPE_PRICE_ID_PRODUCTION_TEAM`

---

## Post Agent (vertikalt abonnement)

Eget abonnement for fotograf/dancer/musiker-produktet "Post Agent".

| Tier | Pris | Pris-ID env |
|---|---|---|
| Monthly | – | `STRIPE_PRICE_POST_AGENT_MONTHLY` |
| Yearly | – | `STRIPE_PRICE_POST_AGENT_YEARLY` |

Storage: følger CreatorHub-grensen til eieren.

---

## Storage-modellen i detalj

### Ledger-arkitektur

- **Tabell:** `user_storage_consumption` (PK: `user_id`)
  - `total_bytes` — running total
  - `filesystem_bytes`, `r2_bytes`, `stream_bytes` — per-backend breakdown
  - `last_updated`, `last_stripe_sync_at`, `last_synced_overage_gb`
- **Audit:** `storage_consumption_events` — én rad per upload/delete/admin-adjust
- **Atomisk oppdatering:** PL/pgSQL-funksjon `apply_storage_consumption_delta()` oppdaterer både total + audit i én transaksjon

### Storage-backends

Hver upload rutes til riktig backend basert på MIME-type:

| MIME | Backend | Hvor |
|---|---|---|
| `video/*` | Cloudflare Stream | Adaptive HLS-streaming |
| Alle andre | Cloudflare R2 | S3-kompatibel object storage |
| Fallback | Local filesystem | Hvis hverken Stream eller R2 er konfigurert |

Routing skjer i `upload-storage-router.ts` etter at chunks er assemblet (eller etter at multer har mottatt single-shot-fila).

### Quota-enforcement

- **Pre-upload:** `canUserUpload(pool, userId, additionalBytes)` kalles i `/api/chunked-upload/init` og `/api/uploads/file`. Returnerer 507 hvis hard cap nås.
- **Post-finish:** `recordStorageUsage()` registrerer bytes i ledger; `pushStorageUsageToStripe()` pusher overage-GB til Stripe (fire-and-forget).

### Reconciliation

Ledgeren kan drifte hvis filer slettes utenfor våre vanlige paths (admin-action, manuell R2-cleanup, etc.). `POST /api/admin/storage-billing/users/:userId/recompute` aggregerer på nytt fra `chunked_uploads`-bordet.

For full reconciliation mot R2 (oppdage filer som ligger der men ikke i vår DB) kreves en separat job som lister R2-objekter per user-prefix og sjekker mot `chunked_uploads.metadata->r2Key`. Ikke implementert ennå.

---

## Brukerflyt: Fredrik nær storage-grensen

1. Fredrik er på Basic-plan (10 GB), har brukt 9.2 GB.
2. Dashboardet viser `StorageUsageBanner` (expanded) med gul progress-bar (92%) og melding "8% av lagringen er igjen."
3. CTA: "Oppgrader plan" (peker til settings-tab).
4. Fredrik prøver å laste opp 1.5 GB bryllups-bilder.
5. Backend kjører `canUserUpload(userId, 1500_000_000)` — returnerer `{ ok: false, reason: 'plan_limit_reached_no_overage', message: 'Lagringen er full. Planen din (basic) inkluderer 10 GB. Du har brukt 9.20 GB...' }`.
6. Frontend mottar 507 → viser modal med oppgraderings-CTA + lenke til å slette gamle filer.

## Brukerflyt: Fredrik på Pro med overage

1. Fredrik er på Professional (50 GB), har brukt 60 GB → overage 10 GB.
2. `StorageUsageBanner` (expanded) viser rød progress-bar + melding "Overforbruk: 10 GB — faktureres automatisk via Stripe".
3. Fredrik laster opp 5 GB til.
4. Backend tillater (Pro tillater overage). `recordStorageUsage()` oppdaterer til 65 GB.
5. `pushStorageUsageToStripe()` kalles fire-and-forget. Sender `usage_record` med `quantity: 15` (overage-GB avrundet oppover) til Fredriks `stripe_storage_meter_item_id`.
6. Neste billing-syklus inkluderer 15 GB × overage-pris.

---

## Endrings-historikk

| Dato | Endring |
|---|---|
| 2026-05-31 | Initial dokumentasjon. Plan-grenser hentet fra `platformSubscriptionPlans` i `index.ts:18900-19100`. |
