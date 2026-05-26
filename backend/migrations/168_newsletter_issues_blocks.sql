-- Block-based newsletter-content
--
-- body_blocks lagrer JSON-array av blokker:
--   [{ id, type: 'header'|'text'|'image'|'cta'|'divider'|'quote', ... }]
-- body_html (eksisterende) holdes fortsatt — backend rendrer fra blocks
-- ved hver patch. Markdown beholdes som fallback for eldre issues.

ALTER TABLE role_room_newsletter_issues
  ADD COLUMN IF NOT EXISTS body_blocks JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_issues_body_blocks
  ON role_room_newsletter_issues USING gin (body_blocks);
