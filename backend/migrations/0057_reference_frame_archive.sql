-- 0057_reference_frame_archive.sql
-- Internal visual reference archive — photographer's own ShotDeck.
--
-- Photographers upload film stills / moodboard frames / previous-shoot
-- frames. Claude Vision auto-tags them (shot type, lighting mood, colour
-- palette, composition, cinematographer style) at upload time so the
-- corpus becomes searchable without manual effort.
--
-- Scope: owner_user_id. Each photographer has their own archive. Shared
-- team archives are a v2 concern — added when workspace/team model exists.
--
-- Storage: `source_url` points at S3/R2 (signed-read, not public). The
-- `thumbnail_url` is an optional low-res preview used in the search grid.

CREATE TABLE IF NOT EXISTS role_room_reference_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership + provenance
  owner_user_id TEXT NOT NULL,
  uploaded_by_user_id TEXT NOT NULL,       -- same as owner for now, but separate so team upload is a non-breaking add
  source_url TEXT NOT NULL,                -- S3/R2 object URL (signed-read)
  thumbnail_url TEXT,                       -- optional low-res for grid

  -- Manual metadata the user can fill in
  film_title TEXT,
  cinematographer TEXT,
  year INTEGER,
  notes TEXT,

  -- Claude Vision auto-tagging — stored as JSON so the schema can
  -- evolve without migrations. Shape:
  --   {
  --     "shotType": "close-up",
  --     "cameraAngle": "eye-level",
  --     "lensRange": "50-85mm",
  --     "lightingMood": "moody low-key",
  --     "colorPalette": ["#1a1a2e", "#c9a24e"],
  --     "composition": "rule-of-thirds, negative space right",
  --     "timeOfDay": "dusk",
  --     "suggestedCinematographerStyle": "Deakins",
  --     "keywords": ["interior", "solitude", "warm highlights"]
  --   }
  claude_tags JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Tags the user explicitly set (may override Claude's). Free-form array
  -- so the user can keyword their archive however they want.
  user_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  -- Optional project association — "this was used as ref on project X"
  used_on_project_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary read path: list-by-owner, filtered on tags. GIN on user_tags
-- gives fast tag-array lookups.
CREATE INDEX IF NOT EXISTS role_room_reference_frames_owner_idx
  ON role_room_reference_frames (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_reference_frames_user_tags_idx
  ON role_room_reference_frames USING GIN (user_tags);

-- Claude tags are JSONB — GIN with jsonb_path_ops for contains-queries
-- (e.g. @> '{"shotType":"close-up"}'). jsonb_path_ops is smaller + faster
-- than the default GIN when we only use @>.
CREATE INDEX IF NOT EXISTS role_room_reference_frames_claude_tags_idx
  ON role_room_reference_frames USING GIN (claude_tags jsonb_path_ops);

-- Cross-project reuse lookups ("what frames have I used on project X")
CREATE INDEX IF NOT EXISTS role_room_reference_frames_projects_idx
  ON role_room_reference_frames USING GIN (used_on_project_ids);
