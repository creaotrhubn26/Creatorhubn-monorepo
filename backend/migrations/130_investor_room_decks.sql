-- Migration 130: Investor Room — pitch decks
-- Focused subset of full pitch-deck-system; supports 8-section investor template.
-- See memory/investor_room_scope.md.

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  project_id VARCHAR,
  business_profile_id VARCHAR REFERENCES business_profiles(id) ON DELETE SET NULL,
  template_id VARCHAR(60) NOT NULL DEFAULT 'investor-pitch-v1',
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  slide_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_decks_project ON decks(project_id);

CREATE TABLE IF NOT EXISTS deck_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  section VARCHAR(40) NOT NULL,           -- 'cover'|'problem'|'solution'|'market'|'business_model'|'competition'|'traction'|'team'|'funding'|'cta'
  layout VARCHAR(40) NOT NULL DEFAULT 'standard',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  thumbnail_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deck_id, position)
);

CREATE INDEX IF NOT EXISTS idx_deck_slides_deck ON deck_slides(deck_id, position);

CREATE TABLE IF NOT EXISTS deck_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  slug VARCHAR(20) NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  allow_download BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deck_share_slug ON deck_share_links(slug);

CREATE TABLE IF NOT EXISTS deck_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id UUID NOT NULL REFERENCES deck_share_links(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES deck_slides(id) ON DELETE SET NULL,
  viewer_ip_hash TEXT,
  viewer_country VARCHAR(2),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deck_view_events_link ON deck_view_events(share_link_id, created_at DESC);

COMMENT ON COLUMN deck_slides.section IS
  'investor-pitch-v1 sections: cover, problem, solution, market, business_model, competition, traction, team, funding, cta';
