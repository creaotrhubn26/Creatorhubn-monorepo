-- 252_content_calendar.sql
--
-- Content Calendar for marketing-fanen i Admin Room.
-- Lar admin planlegge content-publisering på tvers av platformer
-- (Instagram, LinkedIn, blogg, nyhetsbrev, ...).
--
-- To tabeller:
--   - content_calendar_items: hver enkelt post/reel/blog/video
--   - content_calendar_campaigns: gruppering (eks. "Sommer 2026")
--
-- Items kan tilhøre en campaign via campaign_id (uten harde FK), så
-- vi unngår migrasjons-rekkefølge-bekymringer ved senere endringer.

CREATE TABLE IF NOT EXISTS content_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL DEFAULT 'post', -- 'post' | 'reel' | 'story' | 'blog' | 'newsletter' | 'video'
  platforms TEXT[] NOT NULL DEFAULT ARRAY['instagram','linkedin'], -- skal posters
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'scheduled' | 'published' | 'failed'
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  campaign_id UUID,
  asset_urls TEXT[] DEFAULT '{}',
  copy_text TEXT,
  hashtags TEXT[] DEFAULT '{}',
  author_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_calendar_scheduled_idx
  ON content_calendar_items (scheduled_for ASC)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS content_calendar_status_idx
  ON content_calendar_items (status, scheduled_for DESC);

CREATE TABLE IF NOT EXISTS content_calendar_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  start_date DATE,
  end_date DATE,
  budget_nok INTEGER,
  goal TEXT, -- 'awareness' | 'conversion' | 'engagement' | 'retention'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed 1 demo-campaign + 2 demo-items
INSERT INTO content_calendar_campaigns (name, description, goal) VALUES
  ('Sommer 2026', 'Sommerkampanje for fotograf-marketplace', 'awareness')
ON CONFLICT (name) DO NOTHING;

INSERT INTO content_calendar_items (title, description, content_type, platforms, status, scheduled_for) VALUES
  ('Sommer-poster Instagram', 'Sommerkampanje launch', 'post', ARRAY['instagram'], 'scheduled', now() + interval '3 days'),
  ('Blog: Beste fotografer i Oslo', 'SEO-blog-post', 'blog', ARRAY['blog'], 'draft', NULL)
ON CONFLICT DO NOTHING;
