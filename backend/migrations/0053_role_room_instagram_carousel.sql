-- 0053_role_room_instagram_carousel.sql
-- Carousel support for Instagram publishing. A carousel is 2-10 images
-- posted as a single swipeable unit. Meta's Graph API requires each
-- image to be uploaded as a child container (is_carousel_item=true),
-- then a parent container with children=[id1,id2,...], then publish.
--
-- We persist the full list on the job row as a JSON array of
-- {bucket, key, publicUrl?} entries. For image/reel jobs the array has
-- one element and image_bucket/image_key mirror the first entry so
-- existing reads keep working without schema-scrutiny.

ALTER TABLE role_room_instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS image_parts JSONB;

COMMENT ON COLUMN role_room_instagram_publish_jobs.image_parts IS
  'JSON array of {bucket, key, publicUrl?} R2 references. Length 1 for image/reel, 2-10 for carousel. image_bucket/image_key mirror the first element for back-compat.';
