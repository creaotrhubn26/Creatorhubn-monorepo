-- File access audit — spore "hvem hentet hva, når, hvordan".
--
-- Logges asynkront fra alle file-serve-endepunkter (chunked-upload-routes,
-- gallery-routes, etc.) slik at vi har en forensics-trail hvis vi
-- mistenker uautorisert tilgang eller skal etterforske et brudd.
--
-- Tabellen partitioneres ikke i dag, men kan flyttes til hypertable
-- (Timescale) eller standard partition-by-month senere hvis volumet
-- vokser betydelig.

CREATE TABLE IF NOT EXISTS file_access_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
    -- Refererer chunked_uploads.final_file_id (vanligvis)
  backend TEXT NOT NULL,
    -- 'cloudflare_stream' | 'r2' | 'filesystem' | 'unknown'
  access_type TEXT NOT NULL,
    -- 'download' | 'stream_playback' | 'signed_url_generated' | 'preview'
  outcome TEXT NOT NULL,
    -- 'success' | 'not_found' | 'forbidden' | 'sign_failed' |
    -- 'path_traversal_blocked' | 'rate_limited'
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  -- Antall bytes leverede (filesystem only — vi vet ikke for redirects)
  bytes_served BIGINT,
  -- Frikolonne for ekstra kontekst
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS file_access_audit_user_idx
  ON file_access_audit (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS file_access_audit_file_idx
  ON file_access_audit (file_id, created_at DESC);

CREATE INDEX IF NOT EXISTS file_access_audit_outcome_idx
  ON file_access_audit (outcome, created_at DESC)
  WHERE outcome != 'success';

CREATE INDEX IF NOT EXISTS file_access_audit_recent_idx
  ON file_access_audit (created_at DESC);
