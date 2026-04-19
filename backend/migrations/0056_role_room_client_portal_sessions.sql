-- 0056_role_room_client_portal_sessions.sql
-- Slice 4 av Marketing Plan Engine: klientens innlogging + dashboard.
--
-- Produsent (fotograf) inviterer klienten via e-post → vi genererer en
-- lang, signert token → klient klikker lenken → dashboardet er det
-- første de ser. Ingen passord, ingen OTP: magic-link-tokenet ER
-- sesjonen. Rotasjon skjer ved at produsenten kan revokere + sende
-- ny invitasjon hvis lenken havner på avveie.
--
-- Scoping: en portal-sesjon er bundet til én klient (e-post) og ett
-- prosjekt. Samme klient kan ha flere sesjoner (én per prosjekt
-- produsenten har invitert dem til).

CREATE TABLE IF NOT EXISTS role_room_client_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Base64url-kodet tilfeldig streng. Denne er både identifikator OG
  -- hemmelighet — alle som har tokenet kan se dashboardet, så det må
  -- behandles som en bærer-token (send over HTTPS, aldri log i plain).
  session_token TEXT NOT NULL UNIQUE,

  client_email TEXT NOT NULL,
  client_name TEXT,                       -- valgfri; fyllt hvis produsenten oppga navn
  project_id TEXT NOT NULL,
  invited_by_user_id TEXT NOT NULL,       -- produsentens CreatorHub user-id

  -- Status og TTL
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,        -- default 30d frem i tid, produsenten kan sette kortere

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,               -- oppdateres ved hver /session-oppslag
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_client_portal_sessions_project_idx
  ON role_room_client_portal_sessions (project_id, status);

CREATE INDEX IF NOT EXISTS role_room_client_portal_sessions_email_idx
  ON role_room_client_portal_sessions (client_email);

CREATE INDEX IF NOT EXISTS role_room_client_portal_sessions_token_active_idx
  ON role_room_client_portal_sessions (session_token)
  WHERE status = 'active';

COMMENT ON TABLE role_room_client_portal_sessions IS
  'Magic-link sesjoner for klient-portalen. session_token er både ID og hemmelighet. expires_at default 30d; status revoked stopper videre tilgang uten å slette audit-raden.';
