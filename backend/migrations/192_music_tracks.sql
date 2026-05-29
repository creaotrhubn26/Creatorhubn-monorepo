-- Music Library — per-prosjekt musikk-bibliotek med librosa-analyse-
-- output. Foundation for music-suggestion (per chapter/scene) og auto-
-- ducking under voice-segmenter.
--
-- Felles infrastruktur med B-roll (samme universal-læring-pattern,
-- samme per-projekt-scope, samme suggestion-rangering).

CREATE TABLE IF NOT EXISTS role_room_music_tracks (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  preview_audio_path text,
  waveform_image_path text,
  -- Librosa-output: { bpm, bpmConfidence, key, mode (major/minor),
  --                    durationSec, energyCurve[], segments[], spectralCentroid,
  --                    rmsAverage, peakLoudness, suggestedFor[], tags[] }
  audio_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags text[] DEFAULT '{}',
  -- Bjarne's egen kategorisering: cinematic, intro, transitional, etc.
  user_description text,
  duration_sec real DEFAULT 0,
  -- Stats
  suggestion_count int NOT NULL DEFAULT 0,
  approval_count int NOT NULL DEFAULT 0,
  rejection_count int NOT NULL DEFAULT 0,
  usage_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'analyzing', 'ready', 'failed')),
  analysis_error text,
  -- Licensing-tracking (for sponsor-reports, royalty-tracking senere)
  license_type text, -- 'royalty-free', 'commercial', 'cc-by', 'owned'
  license_info text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_project
  ON role_room_music_tracks(project_id, last_used_at DESC NULLS LAST,
                              created_at DESC);

CREATE INDEX IF NOT EXISTS idx_music_tags
  ON role_room_music_tracks USING GIN (tags);

COMMENT ON TABLE role_room_music_tracks IS
  'Per-prosjekt musikk-bibliotek med librosa-analyse. Brukes for '
  'chapter-baserte forslag (BPM/key/mood/energy matching) og auto-'
  'ducking under voice-segmenter.';
