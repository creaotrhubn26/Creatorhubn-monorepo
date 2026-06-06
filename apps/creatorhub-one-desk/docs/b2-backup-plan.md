# Creatorhub One Desk — Backblaze B2 offsite-backup

**Status:** Plan, eksekvering i gang
**Eier:** Daniel Qazi
**Sist oppdatert:** 2026-06-03
**Sporing-branch:** `feat/one-desk-b2-backup`

## Mål

Gi DIT/foto-brukere et tredje destinasjons-alternativ i copy-engine: «offsite cloud»
mot Backblaze B2. Hver bruker eier sin egen B2-konto, sin egen bucket og sin
egen DPA med Backblaze. Creatorhub er teknisk integrator — vi ser aldri filene
og aldri pengene.

## Hvorfor B2 (selv-eid) framfor R2 (Creatorhub-hostet)

| Aksen | B2 selv-eid | R2 Creatorhub-hostet |
|---|---|---|
| GDPR-rolle for oss | Underleverandør | Co-controller |
| Pris til sluttbruker | $6/TB/mo (~66 kr) | $15/TB/mo + 15% (~190 kr) |
| Onboarding-friksjon | 5 min Backblaze-signup | Null friksjon |
| Datasuverenitet | 100% fotograf | Delt med oss |
| Hvis Creatorhub legger ned | Filene bevart | Migrasjons-risiko |
| Kontraktsnivå | Direkte fotograf↔B2 | Via oss |

**Beslutning (2026-06-03):** B2 — fotografen eier lagring. Onboarding-flyten
integreres i Universal Dashboard så friksjonen håndteres en gang per fotograf,
ikke per prosjekt.

## Arkitektur

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  One Desk (Mac)  │────▶│  Creatorhub BE  │     │   Backblaze B2  │
│                  │     │                 │     │                 │
│  copy_engine     │     │  storage-prov.  │     │  fotografens    │
│  + b2_uploader   │     │  routes         │     │  bucket         │
└────────┬─────────┘     └─────────────────┘     └────────▲────────┘
         │                       │                        │
         │ (1) Bearer helper-tok │                        │
         │    fetch creds        │                        │
         │──────────────────────▶│                        │
         │                       │                        │
         │ (2) {key_id,          │                        │
         │     app_key,          │                        │
         │     bucket_id}        │                        │
         │◀──────────────────────│                        │
         │                                                │
         │ (3) b2_authorize_account                       │
         │────────────────────────────────────────────────▶│
         │                                                │
         │ (4) {api_url, auth_token, account_id}          │
         │◀───────────────────────────────────────────────│
         │                                                │
         │ (5) b2_get_upload_url                          │
         │────────────────────────────────────────────────▶│
         │                                                │
         │ (6) {upload_url, upload_auth_token}            │
         │◀───────────────────────────────────────────────│
         │                                                │
         │ (7) PUT file (SHA-1 i header, body = bytes)    │
         │────────────────────────────────────────────────▶│
         │                                                │
         │ (8) {fileId, contentSha1, ...}                 │
         │◀───────────────────────────────────────────────│
         │                                                │
         │ (9) verifiserer SHA-1, oppdaterer session_log  │
```

### Database

#### `user_storage_providers` (ny tabell)

Én rad per bruker per provider. En fotograf kan ha én B2-konto som brukes på
tvers av prosjekter — vi lagrer ikke duplikate creds per prosjekt.

```sql
CREATE TABLE user_storage_providers (
  id varchar PRIMARY KEY,
  user_id varchar NOT NULL,
  provider varchar(32) NOT NULL,  -- 'b2' (senere: 'wasabi')
  account_label text NOT NULL,    -- fotografens egen tag ("hovedkonto")
  key_id_encrypted text NOT NULL, -- AES-256-GCM
  application_key_encrypted text NOT NULL,
  validated_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, account_label)
);
```

#### `dit_destinations` (utvidet)

```sql
ALTER TABLE dit_destinations
  ADD COLUMN cloud_provider varchar(32),  -- 'b2' eller NULL
  ADD COLUMN cloud_provider_id varchar,   -- FK til user_storage_providers.id
  ADD COLUMN cloud_bucket text,           -- B2 bucket-navn
  ADD COLUMN cloud_bucket_id varchar(64), -- B2 bucket-id (immutabel)
  ADD COLUMN cloud_prefix text;           -- f.eks. "dit-backup/<project_id>/"
```

### Backend-endepunkter

| Metode | Path | Auth | Formål |
|---|---|---|---|
| POST | `/api/storage/providers` | userSession | Lagre + validér nye B2-creds |
| GET | `/api/storage/providers` | userSession | Liste eksisterende providers |
| DELETE | `/api/storage/providers/:id` | userSession | Fjern provider |
| GET | `/api/dit/projects/:projectId/destinations/with-creds` | helper-token | Returner destinasjoner m/ DEKRYPTERTE B2-creds (kun til One Desk) |

### Rust-moduler

#### `b2_uploader.rs` (ny)

```rust
pub struct B2Auth { api_url, auth_token, account_id, allowed }
pub struct B2UploadUrl { upload_url, upload_auth_token }

pub async fn authorize(key_id: &str, app_key: &str) -> Result<B2Auth>
pub async fn get_upload_url(auth: &B2Auth, bucket_id: &str) -> Result<B2UploadUrl>
pub async fn upload_file(
    upload: &B2UploadUrl,
    file_path: &Path,
    dest_name: &str,
    sha1: &str,
) -> Result<B2UploadResult>

pub async fn delete_file_version(auth: &B2Auth, file_id: &str, file_name: &str) -> Result<()>
```

#### `copy_engine.rs` (utvidet)

`process_destination` får ny branch:
```rust
if let Some("b2") = dest_spec.cloud_provider.as_deref() {
    process_b2_destination(...).await  // B2-upload + SHA-1 + verify
} else {
    process_local_destination(...).await  // dagens kode
}
```

Hash-strategien: B2 krever **SHA-1** i `X-Bz-Content-Sha1`-header. Vi beregner
SHA-1 ved siden av xxHash64 (xxHash64 fortsatt brukt for lokal-verify og
session_log; SHA-1 kun for B2). Begge går i én pass over filen.

## Implementasjons-faser

### Fase 1 — Backend + Rust foundation (PR-A)

**Files:**
- `backend/migrations/231_dit_cloud_destinations.sql` (✓ klart)
- `backend/migrations/232_user_storage_providers.sql` (ny)
- `backend/server/storage-providers-routes.ts` (ny)
- `backend/server/dit-backup-routes.ts` (utvid `/destinations`-endepunkt med creds-variant)
- `apps/creatorhub-one-desk/src-tauri/Cargo.toml` (+ `sha1 = "0.10"`)
- `apps/creatorhub-one-desk/src-tauri/src/b2_uploader.rs` (ny, ~250 LOC + tester)
- `apps/creatorhub-one-desk/src-tauri/src/copy_engine.rs` (utvid m/ cloud-branch)
- `apps/creatorhub-one-desk/src-tauri/src/copy_session.rs` (DestinationSpec får cloud-felter)
- `apps/creatorhub-one-desk/src/api.ts` (ny `DitDestination`-felter)

**Tester:**
- `b2_uploader::tests::sha1_computed_correctly`
- `b2_uploader::tests::authorize_uses_basic_auth`
- `b2_uploader::tests::upload_includes_required_headers`
- Mock-server (httpmock) for B2 API
- Backend: integrasjonstest for `/api/storage/providers` create + list + validate

**Akseptkriterier:**
- [ ] Migrasjon idempotent (`ADD COLUMN IF NOT EXISTS`)
- [ ] `cargo test --lib` grønn
- [ ] `npx tsc --noEmit` grønn for både backend og frontend
- [ ] B2-creds aldri returnert til frontend uten Bearer helper-token
- [ ] B2-validering kjører faktisk `authorize` mot Backblaze ved opprettelse

### Fase 2 — Universal Dashboard onboarding (PR-B)

**Files:**
- `frontend/client/src/components/onboarding/StorageProviderStep.tsx` (ny)
- `frontend/client/src/components/onboarding/OnboardingFlow.tsx` (legg til steg)
- `frontend/client/src/components/settings/StorageProvidersPanel.tsx` (ny)
- `frontend/client/src/api/storageProviders.ts` (ny)

**UX:**
1. Onboarding-steg «Sett opp ekstern backup»:
   - Radio: «Jeg har en Backblaze-konto» / «Opprett ny»
   - «Opprett ny»: åpner Backblaze signup-URL i ny fane med callback-link
   - Skjema: Account label + Key ID + Application Key + Bucket-navn
   - Spinner: «Validerer mot Backblaze…» (kaller backend, som kaller B2-authorize)
   - Success: «✓ Tilkoblet [bucket-navn]»
   - «Hopp over»: lokal-only forblir lov
2. I prosjekt-creation-wizard (etterfølgende): «Aktiver offsite-backup for dette prosjektet?» som ett-klikk hvis storage-provider finnes
3. Settings-side i Universal Dashboard: liste over providers, status, mulighet å fjerne

**Akseptkriterier:**
- [ ] Bruker kan fullføre onboarding uten å sette opp B2 (skip-flow virker)
- [ ] Validering-feil viser tydelig melding («Ugyldig Application Key»)
- [ ] Etter opprettelse vises providers i settings-panel
- [ ] E2E: oppretterprovider → oppretterprosjekt → ser cloud-destinasjon i One Desk

### Fase 3 — GDPR-styrking (PR-C)

**Files:**
- `frontend/client/src/components/onboarding/StorageProviderStep.tsx` (utvid)
- `frontend/client/src/components/settings/ProjectDataRetentionPanel.tsx` (ny)
- `apps/creatorhub-one-desk/src-tauri/src/b2_uploader.rs` (+ `delete_file_version`)
- `backend/server/storage-providers-routes.ts` (+ DELETE-route som sletter B2-filer)
- `apps/creatorhub-one-desk/docs/legal/subprocessor-disclosure-template.md` (ny)

**Innhold:**
1. Onboarding-skjerm: link til Backblaze' DPA («Backblaze er din underleverandør — signer DPA før du tar dette i bruk: [link]»)
2. EU-region-tvang: ved bucket-opprettelse hint «velg `EU Central` for GDPR-samsvar»
3. «Slett alle filer for dette prosjektet fra B2»-knapp i prosjekt-settings
   - Henter alle hashes fra `session_log`
   - Iterer over og kaller `b2_delete_file_version`
   - Skriver audit-rad til ny `gdpr_deletion_audit`-tabell
4. Subprocessor-tekst-snippet fotografen kan kopiere inn i sin egen
   personvernerklæring

**Akseptkriterier:**
- [ ] DPA-link funker og er synlig før Apply-knapp er aktiv
- [ ] Slette-knapp sletter FAKTISK fra B2 (verifiseres i test mot mock-server)
- [ ] Audit-logg fanger hver sletting med user_id + tidspunkt + antall filer

## Stabilitets-protokoll per fase

Etter HVER fase, FØR commit:

1. **TypeScript**: `npx tsc --noEmit` for både backend og frontend (one-desk + Universal Dashboard)
2. **Rust**: `cargo test --lib` med ALLE tester (ikke bare nye)
3. **Migrasjoner**: kjør mot lokal/staging DB med `ROLLBACK` for å verifisere idempotens
4. **CI-status**: `gh pr view <nr> --json statusCheckRollup` → alle grønne før merge
5. **Manuelt røyk-test**: 
   - Bygg `.app` lokalt
   - Installer til `/Applications`
   - Logg inn med Google-konto
   - Verifiser at eksisterende lokal-backup fortsatt virker (regresjon-sjekk)
6. **Backend deploy-verifisering**: etter Render-deploy, curl test-endepunktene:
   ```bash
   curl -X POST $API/api/storage/providers -H "Cookie: session=..." -d '{...}'
   ```

## Risiko + mitigering

| Risiko | Sannsynlighet | Mitigering |
|---|---|---|
| B2-API endrer seg | Lav | Bruk versjon `b2_v2`-prefiks, ikke `b2_v3` (stabil i ~5 år) |
| Stor fil >5GB | Medium | Logg advarsel + fall tilbake til lokal-only i v1; multipart-upload i v2 |
| Bruker mister Application Key | Medium | Validering ved opprettelse; UI viser «Tilkoblet [bucket-navn]» som bekreftelse |
| Schrems II / US-region | Lav (hvis EU-tvang) | UI defaulter til Amsterdam, vi tester aldri US |
| GDPR-erasure-request | Sikker hendelse | Slette-flyten i Fase 3 dekker dette |
| Backend-creds-leakage | Kritisk | Aldri returner plaintext til frontend; krypteringskey-rotering dokumentert |

## Pris-modell

Vi tar **0 kr i påslag**. Fotografen betaler Backblaze direkte ($6/TB/mo).

| Scenario | Lagret | Backblaze-faktura/mo |
|---|---|---|
| 1 bryllup (50 GB) | 0,05 TB | ~3 kr |
| 5 år à 25 bryllup | 3 TB | ~200 kr |
| 1 års produksjon | 5 TB | ~330 kr |
| 3 års arkiv | 15 TB | ~1 000 kr |

## Open questions (avgjøres underveis)

- [ ] Skal vi støtte bytte av bucket mellom prosjekter, eller binde provider→bucket 1:1?  
      **Foreslått:** 1:1 i v1, frigi i v2 hvis behov.
- [ ] Skal cloud-destinasjon kjøres parallelt med lokal, eller etter at lokal er ferdig?  
      **Foreslått:** Parallelt (dagens copy_engine støtter N destinasjoner allerede).
- [ ] Hvis B2-upload feiler midlertidig, skal vi retry i bakgrunn eller kreve manuell re-trigger?  
      **Foreslått:** 3 retries m/ exponential backoff, deretter session_log-error + UI-indikator.

## Fase 4 — Aktivering + One Desk-integrasjon

Kritisk gap som ble identifisert etter Fase 1-3: vi hadde infrastrukturen
men ingen vei fra «provider satt opp» til «filer havner i B2».

### PR-D1: Backend bucket-list + cloud-destination create

**Endepunkter:**

- `GET /api/storage/providers/:id/buckets` — lister buckets fra B2's
  `b2_list_buckets` med region-info (advarsel hvis ikke EU-Central).
- `POST /api/dit/projects/:projectId/destinations/cloud` — `{ provider_id,
  bucket_id, bucket_name, prefix?, label }` → setter inn rad i
  `dit_destinations` med `cloud_provider='b2'`.

### PR-D2: One Desk fetch with-creds

- Ny Rust-Tauri-command `fetch_destinations_with_creds()` som kaller
  `/api/dit/projects/:id/destinations/with-creds` (eksisterer fra Fase 1).
- BackupDialog.tsx kaller dette ved start istedenfor å plukke fra
  ProjectInfo.destinations (som mangler creds).

### PR-D3: Frontend «Aktiver offsite»-UI

- `CloudDestinationActivator.tsx` standalone-komponent: liste over aktive
  cloud-destinasjoner for prosjekt + «Aktiver offsite»-knapp → 2-trinns
  dialog: velg provider → velg bucket → klikk Aktiver.
- EU-region-tvang: bucket-listingen flagger non-EU-buckets rødt med
  advarsel «Anbefales ikke for GDPR-samsvar — bytt til EU Central».

## Endrings-logg

- 2026-06-03: Initial plan, B2-selv-eid valgt over R2-hosted. Migrasjon 231 drafted.
- 2026-06-03: **Fase 1 shipped** (PR #223). Backend storage-providers-routes,
  migrasjoner 231+232, Rust b2_uploader + copy_engine-routing, 22/22 tester grønne.
- 2026-06-03: **Fase 2 shipped** (samme PR). Universal Dashboard onboarding-
  steg via StorageProviderStep (variant=wizard|settings), StorageProvidersPanel
  for admin, profesjons-nøytral kopi som dekker alle 4 profesjoner.
- 2026-06-03: **Fase 3 shipped** (samme PR). Migrasjon 233 gdpr_deletion_audit,
  POST /api/storage/providers/:id/erase-project for right-to-erasure med
  audit-logging, subprocessor-disclosure-template.md ferdigskrevet for
  fotografenes egne personvernerklæringer.

