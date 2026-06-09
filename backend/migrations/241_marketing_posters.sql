-- Marketing posters — lagrede 4:5 Admin Room marketing-feed-posters
--
-- Brukes av WeeklyBriefEditor / MarketingFeedPoster i Newsletter Studio.
-- En rad = én lagret poster med template_id (weekly_brief / event /
-- product_launch), theme-token (purple/film/dance), variant
-- (standard/minimal/editorial) og fullt fields-JSONB-bobjekt.

CREATE TABLE IF NOT EXISTS marketing_posters (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  title text NOT NULL,
  template_id text NOT NULL DEFAULT 'weekly_brief',
  theme text NOT NULL DEFAULT 'purple',
  variant text NOT NULL DEFAULT 'standard',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_posters_template_updated
  ON marketing_posters(template_id, updated_at DESC);

COMMENT ON TABLE marketing_posters IS
  'Admin Room marketing-feed-posters (4:5 PNG-assets). fields-JSONB har MarketingPosterFields-shape per template_id.';
