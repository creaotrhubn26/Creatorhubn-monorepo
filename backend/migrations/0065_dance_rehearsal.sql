-- 0065_dance_rehearsal.sql
-- Rehearsal-logg for dans-vertikalen.
--
-- Én rad per planlagt prøve. Plan-felt (focus_areas, invited_dancer_ids) og
-- etter-prøven-felt (segment_reviews, dancer_follow_ups) ligger som JSONB
-- så hele prøven oppdateres atomisk via en enkelt PATCH. Når et segment-
-- review markeres som 'approved', kjører service-laget også en
-- UPDATE mot dance_choreography_segment for å bumpe segmentets approval.
--
-- Scoping: per (owner_user_id, choreography_id). project_id valgfri.

CREATE TABLE IF NOT EXISTS dance_rehearsal (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  choreography_id TEXT NOT NULL,

  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  invited_dancer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'planned',

  -- Plan-felt (settes før prøven)
  focus_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  video_review_planned BOOLEAN NOT NULL DEFAULT FALSE,
  pre_notes TEXT,

  -- Etter-prøven-felt
  segment_reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  dancer_follow_ups JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_notes TEXT,
  recording_url TEXT,
  choreography_changelog TEXT,

  project_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_rehearsal_status_values
    CHECK (status IN ('planned','in_progress','completed','cancelled'))
);

CREATE INDEX IF NOT EXISTS dance_rehearsal_owner_choreo_idx
  ON dance_rehearsal (owner_user_id, choreography_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS dance_rehearsal_owner_project_idx
  ON dance_rehearsal (owner_user_id, project_id, scheduled_at DESC);
