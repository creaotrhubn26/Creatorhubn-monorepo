-- 287_lead_map_member_locations.sql
--
-- Live selger-posisjoner på Lead Map. Frontend henter geolokasjon
-- (Geolocation API) ved opt-in og sender den til heartbeat-endepunktet.
-- Kartet plotter alle aktive selgere med deres profil-avatar som pin.
--
-- Stale posisjoner (eldre enn 15 min) filtreres bort i query.

BEGIN;

CREATE TABLE IF NOT EXISTS member_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  -- Hvilken aktivitet: 'idle' (bare logget inn), 'visit' (på et besøk),
  -- 'driving' (under transport), 'event' (på et event)
  activity VARCHAR(40) DEFAULT 'idle',
  -- Hvis aktiviteten henger sammen med et spesifikt lead/besøk
  current_lead_id VARCHAR(255),
  current_visit_id VARCHAR(255),
  -- Sharing-opt-in (krever GDPR-samtykke fra brukeren)
  is_sharing BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_member_locations_org_active
  ON member_locations (organization_id, updated_at DESC)
  WHERE is_sharing = TRUE;

-- ─────────────────────────────────────────────────────────────────
-- GDPR-samtykke: hver bruker må eksplisitt opt-in til posisjonsdeling
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_location_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address VARCHAR(64),
  user_agent TEXT,
  UNIQUE (user_id, organization_id)
);

COMMIT;
