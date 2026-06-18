-- 0323_editing_vendor_marketplace.sql
-- Foto & Video redigerings-marketplace: fotografer/videografer hyrer inn
-- eksterne redigeringsbedrifter (vendortype 'editing') via vendor-systemet.
--
-- Inneholder:
--   1. Utvider `vendor_onboarding_profiles` (den universelle vendor-profilen,
--      vendor_type='editing') med godkjenning / signert avtale / B2-kompatibilitet
--      (driver badgene «Vendor godkjent» / «Avtale signert» / «B2 Backblaze-kompatibel»)
--   2. `editing_jobs`        — forespørsel/oppdrag fra fotograf -> redigeringsvendor
--   3. `editing_job_files`   — filer levert av vendor (staging -> fotografens B2)
--   4. `editing_job_events`  — full audit-logg per oppdrag
--
-- Konvensjoner (se migrate.sh): egen BEGIN/COMMIT (IKKE --single-transaction),
-- ON_ERROR_STOP-vennlig, alt idempotent via IF NOT EXISTS.
--
-- VIKTIG om datamodell (verifisert mot live Neon 2026-06-18):
--   * `vendors` = Evendi bryllups-katalog (category_id/status/why-how-what) — IKKE rørt her.
--   * Redigeringsvendor = bruker med vendor_onboarding_profiles.vendor_type='editing',
--     godkjent via `invitations` (profession='editing', status='approved'),
--     med tjenester/priser i `vendor_showcase_products` (vendor_id = user_id).
--   * editing_jobs.vendor_id = vendorens user_id (samme som vendor_showcase_products.vendor_id).
--   * photographer_client_galleries.id = uuid.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Vendor-godkjenning, signert avtale og B2-kompatibilitet
--    (på den universelle vendor-profilen, ikke Evendi-katalogen)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS approval_status varchar DEFAULT 'pending';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS approved_by varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS approval_date timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS agreement_signed boolean DEFAULT false;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS agreement_signed_at timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS agreement_document_url varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS b2_compatible boolean DEFAULT false;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS b2_region varchar;
-- Stripe Connect-konto for utbetaling til vendor (destination charge)
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS stripe_connect_account_id varchar;
-- Vises i fotografens discovery-liste
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS turnaround_days integer;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS availability_status varchar DEFAULT 'available';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS rating numeric(3, 2);
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS logo_url varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS tagline varchar;

-- Utenlandsk vendor (External company outside of Norway): slipper brreg org.nr,
-- bruker land + utenlandsk reg.nr/VAT i stedet. Påvirker også Stripe Connect (cross-border) + MVA.
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS country varchar DEFAULT 'NO';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS is_foreign boolean DEFAULT false;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS foreign_registration_number varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS vat_number varchar;

CREATE INDEX IF NOT EXISTS idx_vop_vendor_type ON vendor_onboarding_profiles (vendor_type);
CREATE INDEX IF NOT EXISTS idx_vop_approval_status ON vendor_onboarding_profiles (approval_status);

-- ─────────────────────────────────────────────────────────────────────────
-- 1b. Utenlandsk-vendor-felt på søknaden (invitations) — brreg er Norge-spesifikt
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS is_foreign boolean DEFAULT false;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS country varchar DEFAULT 'NO';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS foreign_registration_number varchar;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS vat_number varchar;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. editing_jobs — forespørsel/oppdrag
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editing_jobs (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Løs referanse til prosjekt (blandet id-type i kodebasen -> ingen hard FK)
  "project_id"          varchar,
  "project_title"       varchar,
  -- Kjøper (fotograf/videograf)
  "photographer_id"     varchar NOT NULL,
  "photographer_email"  varchar,
  -- Leverandør (kan være NULL ved «velg senere»)
  "vendor_id"           varchar,
  "vendor_name"         varchar,
  -- requested -> accepted/declined -> in_progress -> delivered -> approved -> delivered_to_client
  "status"              varchar NOT NULL DEFAULT 'draft',
  -- Valgte tjenester/pakker fra vendorens priskatalog (VendorProductManager)
  "requested_services"  jsonb DEFAULT '[]'::jsonb,
  "brief"               text,
  "raw_files_info"      jsonb,
  -- Økonomi (beløp i øre, NOK)
  "amount_cents"        integer DEFAULT 0,
  "currency"            varchar DEFAULT 'NOK',
  "platform_fee_cents"  integer DEFAULT 0,
  "payment_status"      varchar DEFAULT 'unpaid', -- unpaid|held|released|refunded
  "stripe_payment_intent_id" varchar,
  "stripe_transfer_id"  varchar,
  -- Sikker B2-overføring
  "staging_bucket"      varchar,
  "staging_prefix"      varchar,                  -- editing-staging/{jobId}/
  "destination_cloud_destination_id" varchar,     -- per-prosjekt cloud-destinasjon (fotografens B2)
  "upload_token_jti"    varchar,                  -- aktiv opplastings-token (for revokering)
  "upload_token_expires_at" timestamp,
  -- Resultat -> Showcase
  "gallery_id"          uuid,                     -- photographer_client_galleries.id
  -- Tidsstempler for livssyklusen
  "requested_at"        timestamp,
  "accepted_at"         timestamp,
  "declined_at"         timestamp,
  "delivered_at"        timestamp,
  "approved_at"         timestamp,
  "delivered_to_client_at" timestamp,
  "created_at"          timestamp DEFAULT now(),
  "updated_at"          timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editing_jobs_photographer ON editing_jobs (photographer_id);
CREATE INDEX IF NOT EXISTS idx_editing_jobs_vendor ON editing_jobs (vendor_id);
CREATE INDEX IF NOT EXISTS idx_editing_jobs_status ON editing_jobs (status);
CREATE INDEX IF NOT EXISTS idx_editing_jobs_project ON editing_jobs (project_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. editing_job_files — filer levert av vendor
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editing_job_files (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id"           uuid NOT NULL,
  "file_name"        varchar NOT NULL,
  "staging_key"      varchar,        -- nøkkel i staging-bøtta
  "destination_key"  varchar,        -- nøkkel etter kopi til fotografens bøtte
  "size_bytes"       bigint,
  "content_type"     varchar,
  "checksum"         varchar,
  -- staged -> copying -> copied -> failed -> deleted
  "transfer_status"  varchar NOT NULL DEFAULT 'staged',
  "transfer_error"   text,
  "uploaded_at"      timestamp,
  "copied_at"        timestamp,
  "created_at"       timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editing_job_files_job ON editing_job_files (job_id);
CREATE INDEX IF NOT EXISTS idx_editing_job_files_status ON editing_job_files (transfer_status);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. editing_job_events — audit-logg
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editing_job_events (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id"      uuid NOT NULL,
  "event_type"  varchar NOT NULL, -- created|requested|accepted|declined|token_minted|token_revoked|
                                  -- file_uploaded|transfer_started|transfer_completed|transfer_failed|
                                  -- staging_purged|payment_held|payment_released|approved|delivered_to_client
  "actor"       varchar,          -- photographer_id | vendor_id | 'system'
  "actor_role"  varchar,          -- photographer|vendor|system|admin
  "detail"      jsonb,
  "created_at"  timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_editing_job_events_job ON editing_job_events (job_id);
CREATE INDEX IF NOT EXISTS idx_editing_job_events_type ON editing_job_events (event_type);

COMMIT;
