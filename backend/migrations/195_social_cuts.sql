-- Repurpose-engine: social-cuts per prosjekt
--
-- Brukes for å transformere long-form-content (podcast, event,
-- dokumentar) til 30s/60s vertikal-cuts for IG Reels, TikTok, YouTube
-- Shorts. Hver cut har source-tid, dimensjoner, captions-burnt-flag,
-- og output-path. Lagres som "ready"/"approved"/"published" så
-- bjarne kan jobbe systematisk gjennom episodens highlights.

CREATE TABLE IF NOT EXISTS role_room_social_cuts (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- Source-video som cut ble extrahert fra
  source_video_path text NOT NULL,
  -- Trim-vindu
  start_sec real NOT NULL,
  end_sec real NOT NULL,
  -- Output-render
  output_path text,
  aspect_ratio text NOT NULL DEFAULT '9:16'
    CHECK (aspect_ratio IN ('9:16', '1:1', '4:5', '16:9')),
  captions_burnt boolean NOT NULL DEFAULT false,
  thumbnail_path text,
  -- Standout-score fra transkript-analyse (0-1)
  standout_score real,
  -- Transcript-tekst som ble brukt for denne cuten
  transcript_snippet text,
  -- Bjarne kan editerer headline/hook over cuten
  headline text,
  -- Workflow-status: extracted → reviewed → approved → published
  status text NOT NULL DEFAULT 'extracted'
    CHECK (status IN ('extracted', 'reviewed', 'approved', 'published', 'rejected')),
  -- Hvilken agent som lagde cuten
  agent_kind text,
  -- Hvor mange ganger denne cuten er rendret (for "regenerate")
  render_count int NOT NULL DEFAULT 0,
  rendered_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_cuts_project
  ON role_room_social_cuts(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_cuts_status
  ON role_room_social_cuts(project_id, status, created_at DESC);

COMMENT ON TABLE role_room_social_cuts IS
  'Repurpose-engine: 30s/60s vertikal-cuts utextrahert fra long-form '
  'content. Standout-score fra transkript-analyse, captions-burnt-flag, '
  'status workflow (extracted → reviewed → approved → published).';
