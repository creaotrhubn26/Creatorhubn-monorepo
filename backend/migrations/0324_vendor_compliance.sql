-- 0324_vendor_compliance.sql
-- Creatorhub Vendor Standard — obligatorisk compliance-modul for eksterne
-- redigeringsvendors (spesielt utenlandske som behandler norske fotografers
-- bilde-/video-/lydmateriale på vegne av kunder).
--
-- Fire pilarer: Kvalitet, Lagring, GDPR, Leveranse.
-- Ekstra kontroll for vendors UTENFOR EØS: SCC + Transfer Impact Assessment.
--
-- Konvensjoner (migrate.sh): egen BEGIN/COMMIT, idempotent IF NOT EXISTS.
-- Forankret på vendor_onboarding_profiles (jf. 0323).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Compliance-status pr. pilar (pending|approved|rejected|na)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_quality_status varchar DEFAULT 'pending';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_storage_status varchar DEFAULT 'pending';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_gdpr_status varchar DEFAULT 'pending';
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_delivery_status varchar DEFAULT 'pending';

-- Overordnet aksept av Creatorhub Vendor Standard (obligatorisk for utenlandske)
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_accepted boolean DEFAULT false;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_accepted_at timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS compliance_version varchar;

-- GDPR-avtaleverk
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS dpa_signed boolean DEFAULT false;          -- databehandleravtale
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS dpa_signed_at timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS dpa_document_url varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS nda_signed boolean DEFAULT false;          -- konfidensialitet
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS nda_signed_at timestamp;

-- EØS-status + ekstra kontroll for tredjeland (utenfor EØS)
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS is_eea boolean DEFAULT true;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS scc_signed boolean DEFAULT false;          -- Standard Contractual Clauses
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS scc_signed_at timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS tia_completed boolean DEFAULT false;       -- Transfer Impact Assessment
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS tia_completed_at timestamp;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS tia_document_url varchar;
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS data_processing_location varchar;          -- hvor data behandles

-- Bruksbegrensninger
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS subcontractors_allowed boolean DEFAULT false; -- underleverandør krever godkjenning
ALTER TABLE vendor_onboarding_profiles ADD COLUMN IF NOT EXISTS portfolio_use_allowed boolean DEFAULT false; -- ingen portefølje/AI-trening u/skriftlig samtykke

-- ─────────────────────────────────────────────────────────────────────────
-- Audit av compliance-aksept (hvilke krav vendor har akseptert, når, versjon)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_compliance_acceptances (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vendor_user_id"   varchar NOT NULL,
  -- quality|storage|gdpr|delivery|dpa|nda|scc|tia|no_subcontractors|no_portfolio_use|standard
  "requirement"      varchar NOT NULL,
  "accepted"         boolean NOT NULL DEFAULT true,
  "version"          varchar,
  "ip_address"       varchar,
  "detail"           jsonb,
  "created_at"       timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vca_vendor ON vendor_compliance_acceptances (vendor_user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Oppdrags-nivå kvalitetskontroll (maks revisjoner + konfidensialitet)
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS max_revisions integer DEFAULT 2;
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS revisions_used integer DEFAULT 0;
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS confidentiality_ack boolean DEFAULT false;
-- Kvalitetsstandard valgt for oppdraget (jsonb: tekniske minimumskrav, stil, osv.)
ALTER TABLE editing_jobs ADD COLUMN IF NOT EXISTS quality_spec jsonb;

COMMIT;
