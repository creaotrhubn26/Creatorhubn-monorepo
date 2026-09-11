-- 0582_leadgrid_email_outreach_compliance.sql
-- Leadgrid e-postmarkedsføring: organisasjonsomfattende dokumentasjon og sperrer.
--
-- Offentlig tilgjengelig e-post er ikke i seg selv et utsendelsesgrunnlag.
-- Adressetype, samtykke/kundeunntak og reservasjon lagres derfor separat og
-- avgjøres på organisasjonsnivå, på tvers av alle kundeprosjekter.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS leadgrid_email_compliance_profiles (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  address_classification TEXT NOT NULL DEFAULT 'unknown'
    CHECK (address_classification IN ('unknown', 'verified_shared', 'named_person')),
  classification_source TEXT,
  classification_evidence TEXT,
  classification_verified_at TIMESTAMPTZ,
  classification_verified_by_user_id TEXT,
  existing_customer_active BOOLEAN NOT NULL DEFAULT FALSE,
  existing_customer_source TEXT,
  existing_customer_relationship TEXT,
  existing_customer_similar_services TEXT,
  electronic_address_provided_at TIMESTAMPTZ,
  collection_opt_out_offered_at TIMESTAMPTZ,
  existing_customer_attested_at TIMESTAMPTZ,
  existing_customer_attested_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, email_normalized),
  CHECK (email_normalized = LOWER(BTRIM(email_normalized))),
  CHECK (LENGTH(email_normalized) BETWEEN 3 AND 320),
  CHECK (
    address_classification = 'unknown'
    OR (
      classification_source IS NOT NULL
      AND classification_evidence IS NOT NULL
      AND classification_verified_at IS NOT NULL
      AND classification_verified_by_user_id IS NOT NULL
    )
  ),
  CHECK (
    existing_customer_active = FALSE
    OR (
      existing_customer_source IS NOT NULL
      AND existing_customer_relationship IS NOT NULL
      AND existing_customer_similar_services IS NOT NULL
      AND electronic_address_provided_at IS NOT NULL
      AND collection_opt_out_offered_at IS NOT NULL
      AND existing_customer_attested_at IS NOT NULL
      AND existing_customer_attested_by_user_id IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_email_compliance_classification
  ON leadgrid_email_compliance_profiles (organization_id, address_classification);

CREATE TABLE IF NOT EXISTS leadgrid_email_marketing_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('grant', 'withdraw')),
  contact_name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'direct_marketing_email',
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  source TEXT NOT NULL,
  evidence TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  recorded_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email_normalized = LOWER(BTRIM(email_normalized))),
  CHECK (LENGTH(email_normalized) BETWEEN 3 AND 320),
  CHECK (LENGTH(contact_name) BETWEEN 1 AND 300),
  CHECK (LENGTH(purpose) BETWEEN 1 AND 300),
  CHECK (LENGTH(consent_text) BETWEEN 1 AND 4000),
  CHECK (LENGTH(consent_version) BETWEEN 1 AND 100),
  CHECK (LENGTH(source) BETWEEN 1 AND 300),
  CHECK (LENGTH(evidence) BETWEEN 1 AND 4000),
  CHECK (expires_at IS NULL OR expires_at > occurred_at)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_email_consent_latest
  ON leadgrid_email_marketing_consent_events
    (organization_id, email_normalized, occurred_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS leadgrid_email_suppressions (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('recipient_objection', 'unsubscribe', 'manual_block', 'hard_bounce', 'complaint')),
  source TEXT NOT NULL,
  notes TEXT,
  suppressed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by_user_id TEXT NOT NULL,
  PRIMARY KEY (organization_id, email_normalized),
  CHECK (email_normalized = LOWER(BTRIM(email_normalized))),
  CHECK (LENGTH(email_normalized) BETWEEN 3 AND 320),
  CHECK (LENGTH(source) BETWEEN 1 AND 300)
);

CREATE TABLE IF NOT EXISTS leadgrid_email_gdpr_processing_records (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  data_subject_name TEXT NOT NULL,
  legal_basis TEXT NOT NULL
    CHECK (legal_basis IN (
      'consent', 'contract', 'legal_obligation', 'vital_interests',
      'public_task', 'legitimate_interests'
    )),
  purpose TEXT NOT NULL,
  source TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL,
  retention_until TIMESTAMPTZ NOT NULL,
  legitimate_interest_goal TEXT,
  necessity_assessment TEXT,
  balancing_assessment TEXT,
  safeguards TEXT,
  indirect_collection BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_notice_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (privacy_notice_status IN ('pending', 'sent', 'exempt')),
  privacy_notice_sent_at TIMESTAMPTZ,
  privacy_notice_method TEXT,
  privacy_notice_reference TEXT,
  recorded_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, email_normalized),
  CHECK (email_normalized = LOWER(BTRIM(email_normalized))),
  CHECK (LENGTH(email_normalized) BETWEEN 3 AND 320),
  CHECK (retention_until > collected_at),
  CHECK (
    legal_basis <> 'legitimate_interests'
    OR (
      legitimate_interest_goal IS NOT NULL
      AND necessity_assessment IS NOT NULL
      AND balancing_assessment IS NOT NULL
      AND safeguards IS NOT NULL
    )
  ),
  CHECK (
    privacy_notice_status <> 'sent'
    OR (
      privacy_notice_sent_at IS NOT NULL
      AND privacy_notice_method IS NOT NULL
      AND privacy_notice_reference IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_email_gdpr_retention
  ON leadgrid_email_gdpr_processing_records (organization_id, retention_until);

COMMENT ON TABLE leadgrid_email_compliance_profiles IS
  'Organisasjonsomfattende adressetype og dokumentasjon for Leadgrid-markedsføring. Public availability is never permission.';
COMMENT ON TABLE leadgrid_email_marketing_consent_events IS
  'Append-only historikk over samtykke og tilbaketrekking, med ordlyd, formål, kilde, tidspunkt og registrerende bruker.';
COMMENT ON TABLE leadgrid_email_suppressions IS
  'Absolutt organisasjonsomfattende sperreliste på tvers av Leadgrid-prosjekter.';
COMMENT ON TABLE leadgrid_email_gdpr_processing_records IS
  'Separat GDPR-grunnlag for personopplysninger. Berettiget interesse krever mål, nødvendighet, interesseavveining og tiltak; det gir aldri i seg selv tillatelse til e-postmarkedsføring.';

COMMIT;
