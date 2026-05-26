-- Open- og click-tracking + audience-segmentering for newsletter

CREATE TABLE IF NOT EXISTS role_room_newsletter_issue_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES role_room_newsletter_issues(id) ON DELETE CASCADE,
  signup_id UUID NOT NULL REFERENCES role_room_newsletter_signups(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash VARCHAR(64),
  user_agent_short VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_opens_issue
  ON role_room_newsletter_issue_opens (issue_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_opens_signup
  ON role_room_newsletter_issue_opens (signup_id);

CREATE TABLE IF NOT EXISTS role_room_newsletter_issue_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES role_room_newsletter_issues(id) ON DELETE CASCADE,
  signup_id UUID NOT NULL REFERENCES role_room_newsletter_signups(id) ON DELETE CASCADE,
  destination_url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash VARCHAR(64),
  user_agent_short VARCHAR(80)
);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_clicks_issue
  ON role_room_newsletter_issue_clicks (issue_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_clicks_signup
  ON role_room_newsletter_issue_clicks (signup_id);

-- Segmentering: utgaven har en filter-spec som styrer hvem som mottar
ALTER TABLE role_room_newsletter_issues
  ADD COLUMN IF NOT EXISTS audience_filter VARCHAR(40) NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS audience_count_estimate INTEGER;

-- Aggregert send-stats slik at vi slipper å counte hver gang:
ALTER TABLE role_room_newsletter_issues
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_open_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_click_count INTEGER NOT NULL DEFAULT 0;
