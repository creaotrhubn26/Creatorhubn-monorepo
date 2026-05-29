-- B-roll Library — per-prosjekt klipp-bibliotek med vision-AI-tagging.
--
-- Hvert klipp har:
--   - filsti (kan være Tauri app_data eller bruker-spesifisert)
--   - preview-asset-stier (3-sek MP4 + thumbnail PNG for hover-preview)
--   - vision_analysis JSONB med strukturert metadata fra Claude vision-AI
--     (objekter, scene, mood, motion, shot-type, color-palette, etc.)
--   - tags (avledet fra vision_analysis, men editerbar av Bjarne)
--   - usage_count (hvor mange ganger klippet er brukt i renders/suggestions)
--   - last_used_at (når sist brukt — påvirker sort-order)

CREATE TABLE IF NOT EXISTS role_room_broll_clips (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  preview_video_path text,
  preview_thumbnail_path text,
  -- Vision-AI strukturert output (objekter, scene, mood, etc.)
  vision_analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Editerbar tag-liste (start = avledet fra vision, men Bjarne kan justere)
  tags text[] DEFAULT '{}',
  -- Brukerens egen beskrivelse av klippet
  user_description text,
  -- Klipp-varighet i sek
  duration_sec real DEFAULT 0,
  -- Tekniske metadata
  width int,
  height int,
  fps real,
  -- Tracking — hvor ofte klippet foreslås + brukes
  suggestion_count int NOT NULL DEFAULT 0,
  approval_count int NOT NULL DEFAULT 0,
  rejection_count int NOT NULL DEFAULT 0,
  usage_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  -- Analyse-status så vi kan vise loading-state i UI
  analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'analyzing', 'ready', 'failed')),
  analysis_error text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broll_project
  ON role_room_broll_clips(project_id, last_used_at DESC NULLS LAST,
                            created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broll_tags
  ON role_room_broll_clips USING GIN (tags);

COMMENT ON TABLE role_room_broll_clips IS
  'Per-prosjekt B-roll-bibliotek med Claude-vision-AI-tagging. '
  'Hver klipp har strukturert metadata for autopilot context-matching '
  '(samme scene/subject men annen vinkel, audio-context-match osv.).';
