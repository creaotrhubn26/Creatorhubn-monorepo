-- Web-arkiv for sendte utgaver — gjør hver utgave til en permalink-side
-- på theroleroom.com/brief/<slug> for GEO + sosial deling.

ALTER TABLE role_room_newsletter_issues
  ADD COLUMN IF NOT EXISTS published_to_web BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS web_view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seo_description VARCHAR(300);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_issues_published
  ON role_room_newsletter_issues (published_to_web, published_at DESC)
  WHERE published_to_web = TRUE;
