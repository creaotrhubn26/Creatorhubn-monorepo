-- 0089_role_room_shared_research.sql
-- DB-fallback for share-links som er for store til å pakkes inline i
-- token (>500kB komprimert). Tokenet er da bare en kort UUID-pointer
-- til en row her. Ingen sensitiv data — payload er allerede approved
-- for sharing av brukeren som lagde linken.
--
-- Cleanup-cron sletter utløpte rader daglig (kjøres i et separat job
-- senere; foreløpig får DB-en bare gradvis vokse, payload er typisk
-- 100-700 kB JSON så 1000 utløpte rows = ~500 MB i absolutt verste fall).

CREATE TABLE IF NOT EXISTS role_room_shared_research (
  token TEXT PRIMARY KEY,                 -- short UUID, separate from HMAC token
  payload JSONB NOT NULL,                 -- the full shared research result
  created_by TEXT,                         -- userId / email
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_shared_research_expires_idx
  ON role_room_shared_research (expires_at);
CREATE INDEX IF NOT EXISTS role_room_shared_research_creator_idx
  ON role_room_shared_research (created_by, created_at DESC);

COMMENT ON TABLE role_room_shared_research IS
  'DB-fallback for share-links der payloadet er for stort til å pakkes inn i en HMAC-token URL. Tokenet er en kort UUID som peker hit. Cleanup-cron sletter utløpte rader.';
