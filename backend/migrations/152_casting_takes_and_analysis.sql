-- Migration 152: casting_takes + casting_take_analysis + casting_analysis_jobs
--
-- Fase B-substrat: media-analyse-pipeline for on-set captured footage.
-- Coverage-agentene (gap, best-take) konsumerer analyzed-data, men selve
-- analysepipelinen er agnostisk for agentene — fremtidige agenter (color-
-- grading-suggestion, audio-mix-issue, etc.) bruker samme substrat.
--
-- Arkitektur:
--   casting_takes          = metadata per opptak (én rad per take)
--   casting_take_analysis  = analyse-resultater (én rad per take, idempotent)
--   casting_analysis_jobs  = pg-backed job queue for bakgrunns-prosessering
--
-- Design notes:
--   - JSONB heller enn normaliserte detalj-tabeller. Schema-evolusjon på
--     analyser uten migration; agenter spør på path.
--   - analyzer_version pinnes per release så re-analyse kan trigges når
--     en stage får bedre implementasjon.
--   - source-tagging (shot_list_id + shot_index) er VALGFRI. Hybrid:
--     manuell tagging ved upload, auto-deteksjon i fremtidig stage.

-- ── casting_takes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_takes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL,
  scene_id        UUID,

  -- Coverage-tagging — kobler take til en planlagt shot (valgfritt)
  shot_list_id    UUID,
  shot_index      INTEGER,
  take_number     INTEGER NOT NULL DEFAULT 1,

  -- R2-referanser
  media_key       TEXT NOT NULL,
  media_url       TEXT,
  media_type      VARCHAR(32) NOT NULL DEFAULT 'video',
  mime_type       VARCHAR(64),
  size_bytes      BIGINT,
  duration_sec    NUMERIC,

  -- Capture-context
  captured_at     TIMESTAMPTZ,
  uploaded_by     UUID,
  notes           TEXT,
  -- DPs "circled take"-konvensjon — markert som foretrukket på set
  marked_circled  BOOLEAN NOT NULL DEFAULT false,

  -- Processing-state (denormalisert fra job-queue for hurtig list-spørringer)
  processing_status VARCHAR(32) NOT NULL DEFAULT 'pending',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT casting_takes_media_type_valid
    CHECK (media_type IN ('video', 'audio')),
  CONSTRAINT casting_takes_status_valid
    CHECK (processing_status IN ('pending', 'queued', 'processing', 'analyzed', 'failed'))
);

-- Hot path: list takes for a scene
CREATE INDEX IF NOT EXISTS casting_takes_scene_idx
  ON casting_takes (scene_id, take_number)
  WHERE scene_id IS NOT NULL;

-- Coverage-spørring: alle takes for et planlagt shot
CREATE INDEX IF NOT EXISTS casting_takes_shot_idx
  ON casting_takes (shot_list_id, shot_index, take_number)
  WHERE shot_list_id IS NOT NULL;

-- Project-wide listing
CREATE INDEX IF NOT EXISTS casting_takes_project_idx
  ON casting_takes (project_id, created_at DESC);

-- Processing-monitoring
CREATE INDEX IF NOT EXISTS casting_takes_processing_idx
  ON casting_takes (processing_status, created_at)
  WHERE processing_status NOT IN ('analyzed');

-- ── casting_take_analysis ───────────────────────────────────────────
--
-- Én rad per take. Replace-on-reanalysis (latest wins). Hvert "analysis-
-- domain" er en JSONB-kolonne så agenter kan spørre på path uten å parse
-- hele resultatet.

CREATE TABLE IF NOT EXISTS casting_take_analysis (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id          UUID NOT NULL UNIQUE REFERENCES casting_takes(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL,

  -- Stage outputs (hver stage skriver sin egen kolonne)
  probe            JSONB,
  audio_analysis   JSONB,
  visual_analysis  JSONB,
  performance      JSONB,

  -- Composite — vektet score fra alle stages
  overall_score    NUMERIC,
  score_breakdown  JSONB,

  -- Lineage
  analyzer_version VARCHAR(64) NOT NULL,
  analyzed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Stage-level success/failure for delvis-analyse-tilfeller
  stage_status     JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT casting_take_analysis_score_range
    CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 1))
);

CREATE INDEX IF NOT EXISTS casting_take_analysis_project_idx
  ON casting_take_analysis (project_id);

-- Best-take-query: ranger takes for et shot
CREATE INDEX IF NOT EXISTS casting_take_analysis_score_idx
  ON casting_take_analysis (overall_score DESC NULLS LAST);

-- ── casting_analysis_jobs ───────────────────────────────────────────
--
-- pg-backed job queue. Worker poller med FOR UPDATE SKIP LOCKED for
-- parallell-safe claiming uten Redis/SQS.

CREATE TABLE IF NOT EXISTS casting_analysis_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id          UUID NOT NULL REFERENCES casting_takes(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL,

  -- Lifecycle: pending → claimed → processing → done|failed
  status           VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 3,
  priority         INTEGER NOT NULL DEFAULT 0,

  -- Worker-lock for parallell-claiming
  claimed_by       VARCHAR(255),
  claimed_at       TIMESTAMPTZ,
  -- Hvis claim er eldre enn dette, anses som "tapt" og kan re-claimes
  visibility_timeout_sec INTEGER NOT NULL DEFAULT 600,

  -- Resultater
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  error_message    TEXT,
  error_stage      VARCHAR(64),

  -- Scheduling — for delayed retry
  not_before       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT casting_analysis_jobs_status_valid
    CHECK (status IN ('pending', 'claimed', 'processing', 'done', 'failed'))
);

-- Hot path: worker.poll() finner neste klare job
CREATE INDEX IF NOT EXISTS casting_analysis_jobs_poll_idx
  ON casting_analysis_jobs (status, not_before, priority DESC, created_at)
  WHERE status IN ('pending', 'claimed');

-- Monitoring + debugging
CREATE INDEX IF NOT EXISTS casting_analysis_jobs_take_idx
  ON casting_analysis_jobs (take_id);

-- ── Trigger: oppdater updated_at automatisk ─────────────────────────

CREATE OR REPLACE FUNCTION casting_analysis_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS casting_takes_updated_at_trg ON casting_takes;
CREATE TRIGGER casting_takes_updated_at_trg
  BEFORE UPDATE ON casting_takes
  FOR EACH ROW
  EXECUTE FUNCTION casting_analysis_set_updated_at();

DROP TRIGGER IF EXISTS casting_take_analysis_updated_at_trg ON casting_take_analysis;
CREATE TRIGGER casting_take_analysis_updated_at_trg
  BEFORE UPDATE ON casting_take_analysis
  FOR EACH ROW
  EXECUTE FUNCTION casting_analysis_set_updated_at();

DROP TRIGGER IF EXISTS casting_analysis_jobs_updated_at_trg ON casting_analysis_jobs;
CREATE TRIGGER casting_analysis_jobs_updated_at_trg
  BEFORE UPDATE ON casting_analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION casting_analysis_set_updated_at();

-- ── Kommentarer for andre utviklere ─────────────────────────────────

COMMENT ON TABLE casting_takes IS
  'Fase B media-substrat. Én rad per opptak på set. Coverage-tagging (shot_list_id + shot_index) er valgfri — manuell ved upload, auto-deteksjon i fremtidig stage.';

COMMENT ON TABLE casting_take_analysis IS
  'Resultater fra analyse-pipelinen. Hver stage har egen JSONB-kolonne så agenter kan spørre på path uten å parse hele blobben. analyzer_version pinnes per release for idempotent re-analyse.';

COMMENT ON TABLE casting_analysis_jobs IS
  'pg-backed job queue. Worker poller med FOR UPDATE SKIP LOCKED. visibility_timeout_sec gjør at hung claims kan re-prøves av annen worker etter timeout.';
