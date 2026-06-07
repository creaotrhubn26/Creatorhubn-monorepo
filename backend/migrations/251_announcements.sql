-- 251_announcements.sql
--
-- Skjema for in-app meldinger / banner-varsler / nyhetsbrev-utkast som
-- drives av Admin Room → Marketing-fanen (MarketingSEODashboard +
-- AnnouncementsTab). UI-en kalte /api/admin/announcements uten at noen
-- backend var implementert; denne migrasjonen + admin-announcements-routes.ts
-- fyller hullet.
--
-- announcement_type: 'banner' | 'modal' | 'toast' | 'email'
-- target_audience  : 'all' | 'admins' | 'photographers' | 'role:<rolle>'
-- priority         : 'low' | 'medium' | 'high' | 'critical'
--
-- announcement_views logger view/dismiss/click pr. bruker slik at vi kan
-- regne ut dismiss-rate og click-rate i /:id/stats-endepunktet.

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  announcement_type TEXT NOT NULL DEFAULT 'banner', -- 'banner' | 'modal' | 'toast' | 'email'
  target_audience TEXT NOT NULL DEFAULT 'all', -- 'all' | 'admins' | 'photographers' | 'role:X'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  dismissed_count INTEGER NOT NULL DEFAULT 0,
  cta_label TEXT,
  cta_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_published_idx
  ON announcements (is_published, published_at DESC)
  WHERE is_published = TRUE;

CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID,
  was_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  was_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcement_views_announcement_idx
  ON announcement_views (announcement_id);

-- Seed 2 demo
INSERT INTO announcements (title, content, announcement_type, priority, is_published, published_at) VALUES
  ('Velkommen til CreatorHub Norge!', 'Vi har lansert en ny versjon av dashboardet.', 'banner', 'medium', TRUE, now()),
  ('Vedlikehold planlagt', 'Vi vedlikeholder systemet søndag 10:00-12:00.', 'banner', 'high', FALSE, NULL)
ON CONFLICT DO NOTHING;
