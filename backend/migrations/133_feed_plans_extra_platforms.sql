-- Migration 133: extend role_room_feed_plans to support all 5 carousel
-- target platforms (TikTok intentionally excluded per the carousel spec —
-- video-first plattform).

ALTER TABLE role_room_feed_plans
  DROP CONSTRAINT IF EXISTS role_room_feed_plans_platform_check;

ALTER TABLE role_room_feed_plans
  ADD CONSTRAINT role_room_feed_plans_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'linkedin', 'facebook', 'pinterest', 'youtube'));
