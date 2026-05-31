-- Agency Organizations — Phase 1.5 av B2B2Talent.
--
-- En "agency" er en organisasjon som leser talent-profiler: Stella Casting AS,
-- Norsk Skuespillersenter, eller et produksjonsselskap. Hver agency kan ha
-- flere brukere (medlemmer). Talenten gir consent til AGENCY-id, ikke
-- til individuelle medlemmer — så alle ansatte i Stella ser samme talent
-- når én Stella-ansatt har fått consent.
--
-- Felter:
--   type — matcher talent_consent_registry.partner_type (samme vokabular)
--   slug — stabilt URL-safe handle (eks. 'stella-casting')
--   verified — Creatorhub-admin har bekreftet at orgen er ekte
--   metadata — fleksibel JSONB for org-leveler, branding etc.

CREATE TABLE IF NOT EXISTS agency_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(60) NOT NULL,            -- 'stella_casting' | 'skuespillersenter'
                                         -- | 'production_company' | 'workshop_provider'
                                         -- | 'caster_individual'  (sjeldent — vanligvis user)
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  contact_email VARCHAR(255),
  website_url TEXT,
  about TEXT,
  logo_url TEXT,

  -- Eierskap og verifisering
  owner_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,

  -- Status: aktiv eller arkivert (slettes ikke — consent-rader peker hit)
  status VARCHAR(30) NOT NULL DEFAULT 'active',  -- active | archived

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_orgs_type_idx ON agency_orgs (type);
CREATE INDEX IF NOT EXISTS agency_orgs_owner_idx ON agency_orgs (owner_user_id);
CREATE INDEX IF NOT EXISTS agency_orgs_status_idx ON agency_orgs (status);

DROP TRIGGER IF EXISTS update_agency_orgs_updated_at ON agency_orgs;
CREATE TRIGGER update_agency_orgs_updated_at
  BEFORE UPDATE ON agency_orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Members-koblingen ligger på users-tabellen som FK (én user tilhører
-- maks én agency_org for nå — multi-agency-membership kan komme senere via
-- egen junction-tabell om behov).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS agency_org_id UUID REFERENCES agency_orgs(id) ON DELETE SET NULL;

-- agency_role: 'admin' (kan invitere kolleger, redigere org-profil),
-- 'member' (kan lese talents agency har consent fra).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS agency_role VARCHAR(30);

CREATE INDEX IF NOT EXISTS users_agency_org_id_idx ON users (agency_org_id);

-- Seed: Stella Casting og Norsk Skuespillersenter som "kjente" organisasjoner.
-- Slik kan talenter velge dem fra en dropdown uten at noen er logget inn først.
-- ON CONFLICT (slug) gjør seedet idempotent.
INSERT INTO agency_orgs (type, name, slug, contact_email, website_url, about, verified, verified_at)
VALUES
  ('stella_casting', 'Stella Casting AS', 'stella-casting',
   'post@stellacasting.no', 'https://www.stellacasting.no',
   'Norges ledende skuespiller- og castingbyrå. Representerer skuespillere for film, TV, reklame og scene.',
   TRUE, now()),
  ('skuespillersenter', 'Norsk Skuespillersenter', 'norsk-skuespillersenter',
   'post@skuespillersenter.no', 'https://www.skuespillersenter.no',
   'Etterutdanning og castingdatabase for norske skuespillere. Drives av Norsk Skuespillerforbund.',
   TRUE, now())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  contact_email = COALESCE(EXCLUDED.contact_email, agency_orgs.contact_email),
  website_url = COALESCE(EXCLUDED.website_url, agency_orgs.website_url),
  about = COALESCE(EXCLUDED.about, agency_orgs.about);
