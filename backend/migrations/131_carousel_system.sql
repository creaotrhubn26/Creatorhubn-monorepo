-- Migration 131: Website-to-Carousel system
-- See memory/website_to_carousel_architecture.md for the full design.
-- All five tables shipped together (one source-of-truth, easier rollback).

-- 1. Cached BrandProfile from a website URL (7-day TTL)
CREATE TABLE IF NOT EXISTS website_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  url TEXT NOT NULL,
  url_hash VARCHAR(64) NOT NULL,                    -- sha256(url) for dedup
  brand_profile JSONB NOT NULL,                     -- BrandProfile shape
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hero_screenshot_key TEXT,                         -- R2 key for hero shot
  fullpage_screenshot_key TEXT,                     -- R2 key for fullpage
  UNIQUE (user_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_website_analyses_user
  ON website_analyses(user_id, fetched_at DESC);

-- 2. One row per generated week of content (1 draft = 7 posts)
CREATE TABLE IF NOT EXISTS carousel_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  website_analysis_id UUID NOT NULL REFERENCES website_analyses(id) ON DELETE CASCADE,
  week_starting DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'ready', 'partially_approved', 'published', 'failed')),
  generation_started_at TIMESTAMPTZ,
  generation_completed_at TIMESTAMPTZ,
  generation_error TEXT,
  total_posts INTEGER NOT NULL DEFAULT 7,
  approved_post_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carousel_drafts_user_week
  ON carousel_drafts(user_id, week_starting DESC);

-- 3. One row per day-of-week post (7 per draft)
CREATE TABLE IF NOT EXISTS carousel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES carousel_drafts(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  format VARCHAR(40) NOT NULL CHECK (format IN
    ('humor', 'educational', 'bts', 'customer_story', 'promo', 'seasonal', 'story_insight')),
  primary_platform VARCHAR(20) NOT NULL CHECK (primary_platform IN
    ('instagram', 'facebook', 'linkedin', 'pinterest', 'youtube')),
  hook TEXT NOT NULL,
  narrative TEXT NOT NULL,
  caption JSONB NOT NULL,                           -- { "instagram": "...", "linkedin": "...", … }
  scheduled_at TIMESTAMPTZ,
  feed_planner_post_id UUID,                        -- backref once published
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'rejected')),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR,
  UNIQUE (draft_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_carousel_posts_draft ON carousel_posts(draft_id);
CREATE INDEX IF NOT EXISTS idx_carousel_posts_status ON carousel_posts(status, scheduled_at);

-- 4. Each carousel post has 4-8 slides
CREATE TABLE IF NOT EXISTS carousel_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES carousel_posts(id) ON DELETE CASCADE,
  slide_index SMALLINT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN
    ('cover', 'context', 'reveal', 'point', 'quote', 'cta')),
  layout VARCHAR(40) NOT NULL,
  text_blocks JSONB NOT NULL,                       -- [{ content, position, style }, …]
  image_ref JSONB NOT NULL,                         -- { strategy: 'brand-asset'|'stock'|'ai'|'gallery', … }
  brand_overlays JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_url TEXT,                                -- R2 url after render
  pressroom_template_id VARCHAR(60),
  UNIQUE (post_id, slide_index)
);

CREATE INDEX IF NOT EXISTS idx_carousel_slides_post ON carousel_slides(post_id, slide_index);

-- 5. Snapshot history for revisions (audit + undo)
CREATE TABLE IF NOT EXISTS carousel_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES carousel_posts(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by VARCHAR NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_summary TEXT,
  UNIQUE (post_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_carousel_versions_post
  ON carousel_versions(post_id, version_number DESC);

COMMENT ON TABLE website_analyses IS
  'Cached brand profile extracted from a website URL. 7d TTL, refresh on stale.';
COMMENT ON COLUMN carousel_posts.caption IS
  'Per-platform caption variants — keyed by platform name.';
