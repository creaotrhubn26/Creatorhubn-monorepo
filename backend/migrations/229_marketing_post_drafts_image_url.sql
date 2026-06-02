-- 229_marketing_post_drafts_image_url.sql
--
-- PR 18: IG container-flow + TikTok auto-publish.
-- Drafts trenger media-kilder:
--   IG container-flow: image_url (HTTP) eller image_data_url (base64)
--   TikTok: video_url (HTTP-link til MP4) eller video_data_url (base64)
--
-- Idempotent.

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- image_data_url er separat fra image_url fordi base64 kan være MB-stort og
-- gjør GET-listing tregt. Eksplisitt kolonne så vi kan ekskludere fra SELECT
-- når det ikke trengs.
ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS image_data_url TEXT;

-- TikTok støtter kun video. video_url er typisk en HTTP-link til en
-- offentlig MP4-fil; video_data_url er base64 (data:video/mp4;base64,...).
ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE marketing_post_drafts
  ADD COLUMN IF NOT EXISTS video_data_url TEXT;
