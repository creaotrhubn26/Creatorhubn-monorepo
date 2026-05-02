-- Add Instagram profile metadata columns to role_room_instagram_connections.
-- Required for Meta App Review of instagram_business_basic permission:
--   - account_type lets us reject Personal IG accounts (only BUSINESS / CREATOR allowed).
--   - profile_picture_url, followers_count, media_count are displayed in the
--     Feed Planner UI to confirm the correct account is connected and to give
--     the producer audience-size context while drafting posts.

ALTER TABLE role_room_instagram_connections
  ADD COLUMN IF NOT EXISTS account_type        text,
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS followers_count     integer,
  ADD COLUMN IF NOT EXISTS media_count         integer,
  ADD COLUMN IF NOT EXISTS profile_refreshed_at timestamptz;
