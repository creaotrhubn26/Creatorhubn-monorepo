-- 0330_partner_program_portal.sql
-- Creatorhub Partner Program (Foto & Video editing): offentlig søknad → godkjenning
-- → magic-link portal-tilgang. + felt som gjør verifikasjons-stegene ekte.
-- Egen tabell fra LeadGrid partner_applications (0317). Apply m/ ON_ERROR_STOP=1,
-- IKKE --single-transaction.
BEGIN;

-- (A) Offentlig søknad fra ekstern redigerings-studio (FØR godkjenning).
CREATE TABLE IF NOT EXISTS editing_partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name varchar(300) NOT NULL,
  country varchar(2) NOT NULL DEFAULT 'NO',          -- ISO-2
  is_foreign boolean NOT NULL DEFAULT false,         -- server-derivert (country<>'NO')
  is_eea boolean,                                     -- server-derivert (isEeaCountry)
  registration_number varchar(120),
  vat_number varchar(120),
  contact_name varchar(200) NOT NULL,
  contact_email varchar(255) NOT NULL,
  phone varchar(60),
  website varchar(500),
  team_size integer,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,         -- string[]
  pricing_model varchar(40),                           -- per_image|per_hour|per_project|subscription
  currency varchar(8),
  price_range varchar(120),
  portfolio_url varchar(500),
  notes text,
  -- GDPR/samtykke (lawful basis-spor) — håndhevet i route (privacy må være true)
  consent_contact boolean NOT NULL DEFAULT false,
  consent_privacy boolean NOT NULL DEFAULT false,
  privacy_policy_version varchar(40),
  consent_text_hash varchar(64),
  consent_ip varchar(64),
  consent_user_agent text,
  consent_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'pending',       -- pending|reviewing|approved|rejected|withdrawn
  review_notes text,
  reviewed_by varchar(255),
  reviewed_at timestamptz,
  vendor_user_id varchar(255),                         -- users.id opprettet ved godkjenning
  invitation_id uuid,                                  -- invitations.id (valgfri metadata)
  locale varchar(8) DEFAULT 'en',
  source varchar(40) DEFAULT 'public_form',
  purge_after timestamptz,                             -- retensjon for avviste/trukne
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_epa_email ON editing_partner_applications (lower(contact_email));
CREATE INDEX IF NOT EXISTS idx_epa_status ON editing_partner_applications (status);
-- Myk dedupe: maks én aktiv søknad per e-post
CREATE UNIQUE INDEX IF NOT EXISTS uq_epa_active_email
  ON editing_partner_applications (lower(contact_email))
  WHERE status IN ('pending', 'reviewing');

-- (B) Godkjennings-audit + step-backing-felt på vendor-profilen (writeren som lukker gapet).
ALTER TABLE vendor_onboarding_profiles
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by varchar(255),
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS portfolio_submitted boolean NOT NULL DEFAULT false, -- backer steg 2
  ADD COLUMN IF NOT EXISTS payment_connected boolean NOT NULL DEFAULT false;    -- backer steg 6

-- (C) Magic-link portal-tokens — lagrer KUN sha256(raw); rå sendes på e-post én gang.
-- Ingen harde FK (dual public/legacy users-skjema) — integritet håndheves i app.
CREATE TABLE IF NOT EXISTS editing_partner_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jti varchar(32) NOT NULL UNIQUE,                     -- offentlig id i URL (?jti=..&t=..)
  token_hash varchar(64) NOT NULL,                     -- sha256(rawToken) hex
  vendor_user_id varchar(255) NOT NULL,                -- users.id (opprettet ved godkjenning)
  email varchar(255) NOT NULL,
  purpose varchar(32) NOT NULL DEFAULT 'portal_access',
  expires_at timestamptz NOT NULL,                     -- now()+14d
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by varchar(255),
  redeemed_ip varchar(64),
  redeemed_user_agent text
);
CREATE INDEX IF NOT EXISTS idx_eppt_jti ON editing_partner_portal_tokens (jti);
CREATE INDEX IF NOT EXISTS idx_eppt_vendor ON editing_partner_portal_tokens (vendor_user_id, created_at DESC);

COMMIT;
