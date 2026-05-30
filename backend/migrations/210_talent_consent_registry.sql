-- Talent Consent Registry — granular samtykke per partner per scope.
--
-- Daniel's krav: skuespilleren eier sin egen profil. Partnere (Stella Casting,
-- Norsk Skuespillersenter, produksjonsselskap, individuelle castere) kan
-- bare se det talenten har gitt eksplisitt tilgang til. Talenten kan
-- trekke tilgangen når som helst.
--
-- partner_type identifiserer hva slags partner: kan være en organisasjon (eks
-- "stella_casting", "skuespillersenter", "production_company") eller en
-- spesifikk caster-profil. partner_ref er den lokale ID-en innenfor det
-- partner_type-rommet (eks Stella Casting sin business-id, eller user_id for
-- en individuell caster).

CREATE TABLE IF NOT EXISTS talent_consent_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

  -- Partner-identifikasjon
  partner_type VARCHAR(60) NOT NULL,   -- 'stella_casting' | 'skuespillersenter'
                                        -- | 'production_company' | 'caster_individual'
                                        -- | 'workshop_provider'
  partner_ref VARCHAR(255) NOT NULL,   -- partner-spesifikk ID (org-id eller user-id)
  partner_display_name VARCHAR(255),   -- cache for visning (kan bli stale)

  -- Hva er gitt tilgang til (granular scope)
  -- scope: 'basic_profile' | 'media_portfolio' | 'contact_info'
  --        | 'demographics' | 'availability' | 'audition_invitations'
  --        | 'self_tape_review' | 'full_profile'
  scope VARCHAR(60) NOT NULL,

  -- Status og audit
  status VARCHAR(20) NOT NULL DEFAULT 'granted',  -- granted | revoked | expired
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by VARCHAR(255),             -- normalt talent.owner_user_id; kan være talenten selv
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(255),
  expires_at TIMESTAMPTZ,              -- valgfri TTL — for tidsbegrensede tilganger

  -- Kontekst for tilgangsforespørselen (audit/varsel)
  request_context JSONB DEFAULT '{}',  -- {"requested_via":"stella_link","project_ref":"..."}
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- En partner kan ha bare ÉN aktiv consent per (talent, scope) — vi insert-
  -- replacer hvis status endres. UNIQUE-constraint på (talent, partner, scope)
  -- via partial index over 'granted'-rader.
  CONSTRAINT talent_consent_unique_active UNIQUE (talent_id, partner_type, partner_ref, scope)
);

CREATE INDEX IF NOT EXISTS talent_consent_talent_idx ON talent_consent_registry (talent_id);
CREATE INDEX IF NOT EXISTS talent_consent_partner_idx ON talent_consent_registry (partner_type, partner_ref);
CREATE INDEX IF NOT EXISTS talent_consent_status_idx ON talent_consent_registry (status);

-- Trigger som oppdaterer updated_at.
DROP TRIGGER IF EXISTS update_talent_consent_registry_updated_at ON talent_consent_registry;
CREATE TRIGGER update_talent_consent_registry_updated_at
  BEFORE UPDATE ON talent_consent_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit-tabell: hver gang en partner faktisk LESER en talent-profil
-- (anti-abuse + GDPR-art.30-loggføring av databehandling).
CREATE TABLE IF NOT EXISTS talent_access_audit (
  id BIGSERIAL PRIMARY KEY,
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  partner_type VARCHAR(60) NOT NULL,
  partner_ref VARCHAR(255) NOT NULL,
  scope VARCHAR(60) NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accessed_by VARCHAR(255),            -- user-id for handlingen
  access_context JSONB DEFAULT '{}'    -- {"endpoint":"/talents/search","filter":"..."}
);

CREATE INDEX IF NOT EXISTS talent_access_audit_talent_idx ON talent_access_audit (talent_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS talent_access_audit_partner_idx ON talent_access_audit (partner_type, partner_ref, accessed_at DESC);
