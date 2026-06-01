-- Byrå-styrt tilgjengelighet for produksjon-partnership
--
-- Byråene må eksplisitt:
--   1. Godta vilkår for partnership-systemet (terms_accepted_at + terms_version)
--   2. Slå på discoverability — vises i produksjonsteam-søk (partnerships_enabled)
--   3. Kunne PAUSE midlertidig (eksisterende partnerships fortsetter,
--      men nye partnership-forespørsler og prosjekt-invitasjoner blokkeres)
--   4. Kunne STENGE permanent (revoke alle aktive partnerships)
--
-- Modell:
--   - partnerships_enabled = FALSE → ikke discoverable, ingen kan propose
--   - partnerships_enabled = TRUE + paused_at IS NULL → fullt aktiv
--   - partnerships_enabled = TRUE + paused_at IS NOT NULL → pause
--   - partnerships_enabled = FALSE + paused_at IS NOT NULL → tidligere
--     aktiv men har trukket seg (history bevart)
--
-- Vilkår-versjonering: terms_version lar oss kreve re-godkjenning ved
-- vilkårsendring (sett en høyere CURRENT_TERMS_VERSION i backend-koden).

ALTER TABLE agency_orgs
  ADD COLUMN IF NOT EXISTS partnerships_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS partnerships_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnerships_paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS partnerships_paused_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS partnerships_terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnerships_terms_version VARCHAR(20),
  ADD COLUMN IF NOT EXISTS partnerships_terms_accepted_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS partnerships_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnerships_enabled_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS partnerships_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS partnerships_closed_by_user_id VARCHAR(255);

-- Indeks for å filtrere på discoverability (produksjonsteam ser kun
-- aktive byråer i søk).
CREATE INDEX IF NOT EXISTS agency_orgs_partnerships_discoverable_idx
  ON agency_orgs (status, partnerships_enabled)
  WHERE status = 'active' AND partnerships_enabled = TRUE AND partnerships_paused_at IS NULL;


-- Audit-log for availability-endringer (GDPR + bevisbarhet)
CREATE TABLE IF NOT EXISTS agency_partnership_availability_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_org_id   UUID NOT NULL REFERENCES agency_orgs(id) ON DELETE CASCADE,
  actor_user_id   VARCHAR(255) REFERENCES users(id),
  action          VARCHAR(40) NOT NULL,   -- 'terms_accepted', 'enabled', 'paused', 'unpaused', 'closed'
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS apaa_agency_idx
  ON agency_partnership_availability_audit (agency_org_id, created_at DESC);


-- Per-partnership pause: byrå eller produksjon kan pause samarbeidet
-- mot ÉN spesifikk motpart uten å påvirke andre partnerships.
ALTER TABLE agency_production_partnerships
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_by_role VARCHAR(20)
    CHECK (paused_by_role IN ('agency','production')),
  ADD COLUMN IF NOT EXISTS paused_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS paused_reason TEXT;

CREATE INDEX IF NOT EXISTS agency_production_partnerships_paused_idx
  ON agency_production_partnerships (paused_at) WHERE paused_at IS NOT NULL;


-- For demo-bryåer (a1111... til a5555...): enable + accept terms automatisk
-- så demo-flyten fungerer end-to-end.
UPDATE agency_orgs
   SET partnerships_terms_accepted_at = now() - interval '7 days',
       partnerships_terms_version = '1.0',
       partnerships_terms_accepted_by_user_id = '99999999-9999-9999-9999-999999999999',
       partnerships_enabled = TRUE,
       partnerships_enabled_at = now() - interval '7 days',
       partnerships_enabled_by_user_id = '99999999-9999-9999-9999-999999999999'
 WHERE is_demo = TRUE
   AND id IN (
     'a1111111-1111-1111-1111-1111111111a1',
     'a2222222-2222-2222-2222-2222222222a2',
     'a3333333-3333-3333-3333-3333333333a3',
     'a4444444-4444-4444-4444-4444444444a4',
     'a5555555-5555-5555-5555-5555555555a5'
   );
