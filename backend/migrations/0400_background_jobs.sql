-- 0400_background_jobs.sql
-- Jobb-kø for tunge operasjoner (teknisk backlog fra 14.07; utløst av
-- 18.07-funnene: probe-kjøringer, migrasjoner og fire-and-forget-
-- berikelser dør stille når Render redeployer midt i).
--
-- Design: samme mønster som geo_probe_runs, generalisert.
--   - Claim med FOR UPDATE SKIP LOCKED → trygt med flere instanser.
--   - heartbeat_at oppdateres under kjøring; jobber med død heartbeat
--     re-køes automatisk (deploy-restart-fikset, generalisert fra
--     resume-stale-plasteret).
--   - Retry m/ eksponentiell backoff til max_attempts, deretter 'dead'
--     med last_error — feil skal være synlige, aldri stille.
--   - dedupe_key (valgfri) hindrer duplikat-jobber mens en er aktiv.

CREATE TABLE IF NOT EXISTS background_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      VARCHAR(60) NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        VARCHAR(12) NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','completed','dead')),
  priority      INT NOT NULL DEFAULT 100,
  attempts      INT NOT NULL DEFAULT 0,
  max_attempts  INT NOT NULL DEFAULT 3,
  run_after     TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  heartbeat_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  last_error    TEXT,
  result        JSONB,
  dedupe_key    TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claim-stien: køede jobber klare for kjøring, i prioritets-/FIFO-rekkefølge.
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON background_jobs (priority, created_at)
  WHERE status = 'queued';

-- Stale-reclaim: kjørende jobber m/ heartbeat.
CREATE INDEX IF NOT EXISTS idx_background_jobs_running
  ON background_jobs (heartbeat_at)
  WHERE status = 'running';

-- Én aktiv jobb per dedupe-nøkkel (queued/running); ferdige blokkerer ikke.
CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_dedupe
  ON background_jobs (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('queued','running');

-- Opprydding/innsyn: siste jobber per type.
CREATE INDEX IF NOT EXISTS idx_background_jobs_recent
  ON background_jobs (job_type, created_at DESC);
