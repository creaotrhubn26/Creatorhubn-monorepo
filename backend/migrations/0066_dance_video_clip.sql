-- 0066_dance_video_clip.sql
-- Dance video review-stack — Slice V1.
--
-- En dance_video_clip er én videofil som kan reviewes: en rehearsal-
-- opptak, en koreografi-referanse, eller en performance-recording.
-- Filer ligger i R2 (samme bucket som choreography music).
--
-- Scoping: per (owner_user_id, choreography_id). project_id valgfri.
-- segment_id valgfri (klipp kan dekke hele eller bare ett segment).
--
-- Lifecycle: ingen auto-cascade ved sletting av choreography enda —
-- klippene har sjelvstendig verdi (kan flyttes til reel-portefølje).
-- En egen retention-rutine (ikke implementert) kan rydde basert på
-- captured_at + kind senere.

CREATE TABLE IF NOT EXISTS dance_video_clip (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  choreography_id TEXT,
  segment_id TEXT,

  -- 'rehearsal' | 'reference' | 'performance'
  kind TEXT NOT NULL DEFAULT 'rehearsal',

  title TEXT NOT NULL,
  -- R2-objekt-nøkkel (stable, kan re-signeres senere).
  storage_key TEXT NOT NULL,
  -- Cached signed URL — refreshes via signMusicUrl-mønsteret når <24h til utløp.
  signed_url TEXT,
  signed_url_expires_at TIMESTAMPTZ,

  duration_sec NUMERIC(10,2),
  mime TEXT NOT NULL,
  source_user_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_video_clip_kind_values
    CHECK (kind IN ('rehearsal','reference','performance'))
);

CREATE INDEX IF NOT EXISTS dance_video_clip_owner_choreo_idx
  ON dance_video_clip (owner_user_id, choreography_id, captured_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS dance_video_clip_owner_project_idx
  ON dance_video_clip (owner_user_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dance_video_clip_segment_idx
  ON dance_video_clip (segment_id) WHERE segment_id IS NOT NULL;
