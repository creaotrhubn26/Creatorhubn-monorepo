-- Lower Thirds — navn/title-overlays per prosjekt med timeline-based
-- inn/ut og style-presets.
--
-- Inspirert av academy-systemets LowerThirdsStudio men forenklet for
-- video-editor-konteksten: én collection per prosjekt med items-array
-- som inneholder timeline-position, style, animation og safe-guides.
--
-- Brukes av Event/Podcast/Documentary/Corporate/Short Film-agenter
-- der lower-thirds er konvensjon for taler-introduksjon, intervju-
-- navn, sponsor-roll og sub-titles.

CREATE TABLE IF NOT EXISTS role_room_lower_thirds (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  collection_name text NOT NULL DEFAULT 'Default',
  -- Hele items-listen som JSONB. UI eier formatet — backend cappar size.
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Hvilken agent (kind) lower-thirds tilhører — vi kan presentere
  -- riktige style-presets basert på dette
  agent_kind text,
  -- Sist brukte style-preset, for "use as default" i ny item
  default_style_preset text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, collection_name)
);

CREATE INDEX IF NOT EXISTS idx_lower_thirds_project
  ON role_room_lower_thirds(project_id, updated_at DESC);

COMMENT ON TABLE role_room_lower_thirds IS
  'Lower-thirds-overlays per prosjekt. Hver collection inneholder en '
  'items-array med timeline-baserte navn/title/sub-text-cards som '
  'rendres over video (Event/Podcast/Documentary/Corporate/Short Film).';
