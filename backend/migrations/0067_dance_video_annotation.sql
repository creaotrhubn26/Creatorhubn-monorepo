-- 0067_dance_video_annotation.sql
-- Tidsstemplet kommentar-tråd for dance_video_clip — Slice V1.
--
-- En annotation er et review-comment på en spesifikk tid (eller tids-
-- intervall) i et klipp. Tråding via parent_id (selvref). Drawing-
-- og voice-felt er forberedt for V2/V3 men skrives ikke ennå.

CREATE TABLE IF NOT EXISTS dance_video_annotation (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  clip_id TEXT NOT NULL REFERENCES dance_video_clip(id) ON DELETE CASCADE,

  -- NULL = top-level kommentar; satt = tråd-svar.
  parent_id TEXT REFERENCES dance_video_annotation(id) ON DELETE CASCADE,

  author_user_id TEXT NOT NULL,

  body TEXT NOT NULL,

  -- Timestamping. timestamp_sec er pos i klippet (0..duration).
  -- end_sec valgfri for "marker fra X til Y" rangerings-kommentarer.
  timestamp_sec NUMERIC(10,2) NOT NULL,
  end_sec NUMERIC(10,2),

  -- Knytt til CountGrid (Slice 3) og segments hvis kjent.
  count_number INTEGER,
  segment_id TEXT,

  -- Hvilke dansere er adressert? @-mentions resolved til danserId-er.
  target_dancer_ids JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Lederens "pin" — flagger en kommentar som koreografens hoved-
  -- instruksjon, blir sticky øverst i tråden.
  is_director_pin BOOLEAN NOT NULL DEFAULT FALSE,

  -- 'open' | 'resolved'
  status TEXT NOT NULL DEFAULT 'open',

  -- V2 (drawing overlay): SVG-aktig path-array som overlay på frame.
  drawing JSONB,

  -- V3 (voice + sync): voice note tatt opp samtidig som video spilte.
  voice_note_storage_key TEXT,
  voice_note_signed_url TEXT,
  voice_note_signed_url_expires_at TIMESTAMPTZ,
  -- Drawing-keyframes synket til voice (timestamp → drawing-state).
  drawing_keyframes JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_video_annotation_status_values
    CHECK (status IN ('open','resolved'))
);

CREATE INDEX IF NOT EXISTS dance_video_annotation_clip_time_idx
  ON dance_video_annotation (clip_id, timestamp_sec ASC);

CREATE INDEX IF NOT EXISTS dance_video_annotation_clip_parent_idx
  ON dance_video_annotation (clip_id, parent_id);

CREATE INDEX IF NOT EXISTS dance_video_annotation_owner_idx
  ON dance_video_annotation (owner_user_id, created_at DESC);
