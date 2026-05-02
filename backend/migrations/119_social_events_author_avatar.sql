-- Add author avatar URL to social_events for richer Inbox-rendering.
-- LinkedIn /v2/people og /v2/organizations gir oss profile-bilde-URL via
-- displayImage~ / logoV2; vi lagrer den her sammen med navn slik at
-- Inbox kan vise ekte avatar isteden for fallback-initial.
--
-- IG-events har allerede avatar i raw payload men har historisk ikke
-- blitt persistert separat — ny kolonne lar fremtidige IG-flatten-helpers
-- også populere den hvis ønsket (lavprioritets-utvidelse senere).

ALTER TABLE social_events
  ADD COLUMN IF NOT EXISTS author_avatar_url text;
