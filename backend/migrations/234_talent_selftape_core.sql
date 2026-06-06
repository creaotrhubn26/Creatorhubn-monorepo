-- Self-Tape Studio — kjerne-tabeller (Fase A av spec)
--
-- Tre tabeller for selftape-flyten:
--   1. talent_selftape_projects — prosjekt-konteinere (1 per audition)
--   2. talent_selftape_takes — opptak (N per prosjekt)
--   3. talent_selftape_ai_feedback — AI-vurdering per take
--
-- Spec: docs/specs/SELF_TAPE_STUDIO_SPEC.md

CREATE TABLE IF NOT EXISTS talent_selftape_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id       UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  poster_url      TEXT,
  poster_color    VARCHAR(7),                -- "#a855f7" fallback bg
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','submitted','archived')),
  role_name       VARCHAR(120),               -- "Sara"
  role_type       VARCHAR(60),                -- "Supporting"
  scene_label     VARCHAR(80),                -- "Scene 3"
  sides_pages     SMALLINT,                   -- 2
  sides_content   TEXT,                       -- markdown av manus
  brief_url       TEXT,
  source_casting_project_id VARCHAR(255),     -- valgfri FK til casting_projects
  source_partnership_id UUID REFERENCES agency_production_partnerships(id) ON DELETE SET NULL,
  current_take_id UUID,                       -- siste valgte take (FK satt etter takes-tabell)
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_selftape_projects_talent_idx
  ON talent_selftape_projects(talent_id, status);
CREATE INDEX IF NOT EXISTS talent_selftape_projects_demo_idx
  ON talent_selftape_projects(is_demo) WHERE is_demo = TRUE;


CREATE TABLE IF NOT EXISTS talent_selftape_takes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES talent_selftape_projects(id) ON DELETE CASCADE,
  take_number     SMALLINT NOT NULL,
  duration_ms     INT NOT NULL DEFAULT 0,
  thumbnail_url   TEXT,
  video_url       TEXT,
  stream_uid      VARCHAR(64),                -- CF Stream UID
  hls_manifest    TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'uploading'
                   CHECK (status IN ('uploading','processing','ready','failed')),
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
                   -- {resolution, fps, codec, file_size_bytes, ...}
  ai_feedback_id  UUID,                       -- FK satt etter ai_feedback-tabell
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT talent_selftape_takes_project_take_unique
    UNIQUE (project_id, take_number)
);

CREATE INDEX IF NOT EXISTS talent_selftape_takes_project_idx
  ON talent_selftape_takes(project_id, take_number DESC);
CREATE INDEX IF NOT EXISTS talent_selftape_takes_status_idx
  ON talent_selftape_takes(status) WHERE status IN ('uploading','processing');


CREATE TABLE IF NOT EXISTS talent_selftape_ai_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id         UUID NOT NULL REFERENCES talent_selftape_takes(id) ON DELETE CASCADE,
  model_version   VARCHAR(40),                -- "claude-opus-4-7" eller "gpt-4o-vision"

  -- 5 kategorier
  eye_line        JSONB,                      -- {grade, note}
  pacing          JSONB,
  sound           JSONB,
  lighting        JSONB,
  performance     JSONB,

  -- Tekniske sjekker
  camera_check    JSONB,                      -- {status, resolution, frame_rate, stability}
  audio_check     JSONB,
  framing_check   JSONB,

  overall_grade   VARCHAR(20),
  detailed_md     TEXT,

  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','generating','ready','failed')),
  error_message   TEXT,
  generated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_selftape_ai_feedback_take_idx
  ON talent_selftape_ai_feedback(take_id);

-- Sett FK fra takes til feedback (sirkulær FK, må komme etter begge tabeller)
ALTER TABLE talent_selftape_takes
  ADD CONSTRAINT talent_selftape_takes_ai_feedback_fk
  FOREIGN KEY (ai_feedback_id) REFERENCES talent_selftape_ai_feedback(id) ON DELETE SET NULL;

-- current_take_id FK på projects (sirkulær)
ALTER TABLE talent_selftape_projects
  ADD CONSTRAINT talent_selftape_projects_current_take_fk
  FOREIGN KEY (current_take_id) REFERENCES talent_selftape_takes(id) ON DELETE SET NULL;


-- updated_at-trigger (gjenbruker funksjonen fra Phase 9)
CREATE OR REPLACE FUNCTION talent_selftape_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsp_set_updated_at ON talent_selftape_projects;
CREATE TRIGGER tsp_set_updated_at
  BEFORE UPDATE ON talent_selftape_projects
  FOR EACH ROW EXECUTE FUNCTION talent_selftape_set_updated_at();

DROP TRIGGER IF EXISTS tst_set_updated_at ON talent_selftape_takes;
CREATE TRIGGER tst_set_updated_at
  BEFORE UPDATE ON talent_selftape_takes
  FOR EACH ROW EXECUTE FUNCTION talent_selftape_set_updated_at();
