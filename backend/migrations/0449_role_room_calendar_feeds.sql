-- 0449_role_room_calendar_feeds.sql
--
-- Del A punkt 60: envegs kalendersynk (iCal/ICS).
--
-- «Vanligste grunn til at planlegger ignoreres» — folk lever i Google
-- Calendar, Outlook eller Apple Calendar. En plan som ikke dukker opp der,
-- blir ikke sett.
--
-- Token i URL-en framfor sesjonsinnlogging: kalenderklienter henter en URL
-- periodisk uten å kunne logge inn. Det er slik ICS-abonnement fungerer hos
-- alle leverandører. Konsekvensen er at URL-en ER hemmeligheten, så den må
-- kunne trekkes tilbake — derav revoked_at framfor sletting, slik at et
-- lekket abonnement kan stenges uten å miste sporet av at det fantes.

CREATE TABLE IF NOT EXISTS role_room_calendar_feeds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Ugjettbart. Ligger i abonnements-URL-en.
  feed_token      VARCHAR(64) NOT NULL UNIQUE,

  -- Hvem abonnementet ble laget for, og av hvem.
  label           VARCHAR(255),
  created_by_user_id VARCHAR(255),

  -- Hva feeden inneholder: opptaksdager, frister, eller begge.
  scope           VARCHAR(20) NOT NULL DEFAULT 'all'
                  CHECK (scope IN ('shoot_days','deadlines','all')),

  -- Tilbaketrekking framfor sletting: et lekket abonnement skal kunne
  -- stenges uten at man mister at det har eksistert.
  revoked_at      TIMESTAMPTZ,
  revoked_by_user_id VARCHAR(255),

  -- Driftsinnsikt: en feed ingen henter er en feed ingen bruker.
  last_accessed_at TIMESTAMPTZ,
  access_count     INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_calendar_feeds_project
  ON role_room_calendar_feeds (project_id)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE role_room_calendar_feeds IS
  'Abonnements-URL-er for envegs kalendersynk (Del A punkt 60). Tokenet er hemmeligheten.';
COMMENT ON COLUMN role_room_calendar_feeds.revoked_at IS
  'Satt ved tilbaketrekking. Feeden svarer 404 etterpå, men raden beholdes for sporbarhet.';
