-- Migration 144: dit_backup_tracking
--
-- Komplett tracking-system for DIT-backup-arbeid på filmset.
-- Erstatter den fiktive set-level backup-state med ekte per-take
-- per-destination tracking av faktiske fil-kopierings-jobber.
--
-- Arkitektur:
--   1. dit_destinations    = konfigurerte backup-destinasjoner per
--                            prosjekt (Original, Primary RAID,
--                            Secondary RAID, Offsite, LTO osv.)
--   2. dit_helper_tokens   = auth-token som DIT-station bruker for
--                            å POSTe status fra CLI-helperen
--   3. dit_backup_jobs     = én rad per kilde-fil per destinasjon
--                            (1 take filmet på 2 kameraer × 4
--                            destinasjoner = 8 jobs)
--   4. dit_backup_events   = append-only audit-log
--
-- Den native CLI-helperen (@theroleroom/dit-helper) skriver via
-- POST /api/dit/jobs til disse tabellene. Frontend leser real-time
-- via GET /api/dit/jobs/by-project og oppdaterer Live Set UI.
--
-- Sjekksum-stack: vi bruker xxHash64 (rask, kollisionsfri for
-- film-bruksområdet). Industri-standard via Pomfort/ShotPut. MD5
-- og SHA-256 også støttet for backward-compatibility, men xxHash64
-- er anbefalt for prod-bruk.

CREATE TABLE IF NOT EXISTS dit_destinations (
  id            varchar PRIMARY KEY,
  project_id    varchar NOT NULL,
  -- Type: 'original' (kamera-kort), 'primary' (hoved-RAID),
  -- 'secondary' (sekundær-RAID), 'offsite' (cloud/LTO/annen-lokasjon)
  destination_type varchar(32) NOT NULL,
  label         text NOT NULL,
  -- Filsystem-sti hvor backup skal lagres. NULL for 'original'
  -- (kortet er allerede der). For LTO: pool-navn.
  path          text,
  -- Type lagringsmedium: 'raid' | 'lto' | 's3' | 'gcs' | 'local'
  storage_type  varchar(32) NOT NULL DEFAULT 'raid',
  -- Antall fyste opp av admin
  priority      integer NOT NULL DEFAULT 1,
  -- Status: 'configured' = klart, 'active' = mottar jobs,
  -- 'paused' = midlertidig av, 'archived' = ikke i bruk
  status        varchar(20) NOT NULL DEFAULT 'configured',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dit_destinations_project_idx ON dit_destinations (project_id);
CREATE INDEX IF NOT EXISTS dit_destinations_type_idx ON dit_destinations (destination_type);

-- Helper-tokens. DIT genererer i AdminRoom, paster inn i CLI-config.
-- Token roteres månedlig av sikkerhetshensyn.
CREATE TABLE IF NOT EXISTS dit_helper_tokens (
  id            varchar PRIMARY KEY,
  project_id    varchar NOT NULL,
  -- SHA-256 av selve tokenet (vi lagrer aldri klartekst)
  token_hash    varchar(64) NOT NULL,
  -- Vises i UI så DIT vet hvilken som er hvilken
  label         text NOT NULL,
  -- Hvilken DIT-station denne tokenet er for ('mac-studio-3' etc.)
  station_name  text,
  -- IP-restriksjon (CIDR) — valgfri whitelist
  ip_whitelist  text[],
  -- Når tokenet ble sist brukt
  last_used_at  timestamptz,
  -- Når tokenet utløper (default +90 dager)
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    varchar,
  revoked_at    timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS dit_helper_tokens_hash_idx ON dit_helper_tokens (token_hash);
CREATE INDEX IF NOT EXISTS dit_helper_tokens_project_idx ON dit_helper_tokens (project_id);

-- Backup-jobs. En per kilde-fil per destinasjon. CLI-helperen
-- oppretter raden ved start av jobben og oppdaterer status etter
-- hvert hash matcher (verifisering).
CREATE TABLE IF NOT EXISTS dit_backup_jobs (
  id              varchar PRIMARY KEY,
  project_id      varchar NOT NULL,
  destination_id  varchar NOT NULL REFERENCES dit_destinations(id) ON DELETE CASCADE,
  -- Knytter mot take-rad i Live Set hvis CLI-helperen kan parse
  -- timecode/scene/take fra filnavn-konvensjon. NULL hvis ikke matchet.
  take_id         varchar,
  -- Kilde-fil (absolute path slik DIT-station ser den)
  source_path     text NOT NULL,
  source_size_bytes bigint,
  source_hash     varchar(64),  -- xxHash64 / MD5 / SHA-256 — algo i hash_algorithm
  -- Destinasjons-fil etter copy
  dest_path       text,
  dest_size_bytes bigint,
  dest_hash       varchar(64),
  hash_algorithm  varchar(16) NOT NULL DEFAULT 'xxh64',
  -- Status: 'queued' = oppdaget, 'copying' = pågår,
  -- 'verifying' = hash-sammenligning, 'verified' = OK,
  -- 'failed' = mismatch eller copy-feil, 'skipped' = allerede der
  status          varchar(20) NOT NULL DEFAULT 'queued',
  bytes_copied    bigint DEFAULT 0,
  -- Tids-stemper
  queued_at       timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  -- Feil-info
  error_code      varchar(64),
  error_message   text,
  -- Helper-/host-info for audit
  helper_token_id varchar REFERENCES dit_helper_tokens(id) ON DELETE SET NULL,
  helper_hostname text,
  helper_version  varchar(32),
  -- Kamera-/klipp-metadata (best-effort, NULL hvis ikke kjent)
  camera_id       varchar,
  reel_id         varchar,
  clip_id         varchar
);

CREATE INDEX IF NOT EXISTS dit_backup_jobs_project_idx ON dit_backup_jobs (project_id);
CREATE INDEX IF NOT EXISTS dit_backup_jobs_destination_idx ON dit_backup_jobs (destination_id);
CREATE INDEX IF NOT EXISTS dit_backup_jobs_take_idx ON dit_backup_jobs (take_id) WHERE take_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dit_backup_jobs_status_idx ON dit_backup_jobs (status);
CREATE INDEX IF NOT EXISTS dit_backup_jobs_queued_idx ON dit_backup_jobs (queued_at DESC);

-- Append-only event-log for audit-spor. Aldri DELETE; aldri UPDATE.
CREATE TABLE IF NOT EXISTS dit_backup_events (
  id              bigserial PRIMARY KEY,
  job_id          varchar NOT NULL REFERENCES dit_backup_jobs(id) ON DELETE CASCADE,
  event_type      varchar(40) NOT NULL,
  -- 'queued' | 'copy_started' | 'copy_progress' | 'copy_completed' |
  -- 'verify_started' | 'verify_succeeded' | 'verify_failed' |
  -- 'job_failed' | 'job_resumed' | 'job_cancelled'
  payload         jsonb DEFAULT '{}'::jsonb,
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dit_backup_events_job_idx ON dit_backup_events (job_id, at DESC);

-- Trigger for updated_at på dit_destinations
CREATE OR REPLACE FUNCTION dit_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dit_destinations_updated_at_trigger ON dit_destinations;
CREATE TRIGGER dit_destinations_updated_at_trigger
  BEFORE UPDATE ON dit_destinations
  FOR EACH ROW EXECUTE FUNCTION dit_set_updated_at();

-- View: per-take backup-status (brukes av Live Set UI)
-- Aggregerer jobs per take per destination-type til et enkelt status-objekt
CREATE OR REPLACE VIEW dit_take_backup_status AS
SELECT
  j.take_id,
  j.project_id,
  jsonb_object_agg(
    d.destination_type,
    jsonb_build_object(
      'job_id', j.id,
      'status', j.status,
      'completed_at', j.completed_at,
      'destination_label', d.label,
      'bytes_total', j.source_size_bytes,
      'bytes_copied', j.bytes_copied
    )
  ) AS destinations
FROM dit_backup_jobs j
JOIN dit_destinations d ON d.id = j.destination_id
WHERE j.take_id IS NOT NULL
GROUP BY j.take_id, j.project_id;
