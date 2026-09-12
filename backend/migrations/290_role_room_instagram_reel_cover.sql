-- 290_role_room_instagram_reel_cover.sql
-- Egendefinert cover/thumbnail for reels. Når produsenten laster opp et eget
-- cover på feed-planner-posten (coverImageUrl), hostes det i R2 ved kø-tid og
-- pekes til via cover_bucket/cover_key — analogt med image_bucket/image_key.
-- Ved publish re-signeres en fersk 1t-URL og sendes til Meta som `cover_url`
-- på REELS-containeren, slik at det opplastede coveret blir den faktiske
-- thumbnailen på Instagram (ikke en auto-frame fra videoen).
--
-- Kun relevant for media_type='reel'. Bilde-poster bruker selve bildet som
-- cover; carousel har ikke noe cover-konsept.

ALTER TABLE role_room_instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS cover_bucket TEXT,
  ADD COLUMN IF NOT EXISTS cover_key TEXT;

COMMENT ON COLUMN role_room_instagram_publish_jobs.cover_bucket IS
  'R2 bucket holding the reel cover/thumbnail. Combined with cover_key to re-sign a 1h cover_url at execute time. NULL = no custom cover.';
COMMENT ON COLUMN role_room_instagram_publish_jobs.cover_key IS
  'R2 object key for the reel cover image. Sent to Meta as cover_url on the REELS container.';
