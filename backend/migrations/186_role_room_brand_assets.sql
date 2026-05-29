-- Brand assets per prosjekt — logoer, icons og overlay-bilder som
-- gjenbrukes på tvers av thumbnails, posts og creative-editor-output.
--
-- Lagres som data:URLs i tabellen (matcher eksisterende
-- customImageUrl-mønster i role_room_feed_plans). Cap 1 MB per asset
-- per CHECK-constraint. For større assets (videoer, design-files) bør
-- vi gå over til R2/S3-lagring senere.

CREATE TABLE IF NOT EXISTS role_room_brand_assets (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo', 'icon', 'overlay', 'template-bg')),
  name text NOT NULL,
  data_url text NOT NULL CHECK (length(data_url) <= 1500000),
  source_filename text,
  width_px int,
  height_px int,
  tags text[] DEFAULT '{}',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_project_kind
  ON role_room_brand_assets(project_id, kind, created_at DESC);

COMMENT ON TABLE role_room_brand_assets IS
  'Per-prosjekt asset-bibliotek for Thumbnail Creator og Creative Editor. '
  'Lagrer logoer/icons/overlays som data:URLs (≤1 MB per asset).';
