-- 0052_role_room_instagram_job_image.sql
-- Persist the R2 location of each job's image so the scheduled-publish
-- worker can re-sign a fresh 1h URL when the job fires — the original
-- pre-signed URL would have expired if the schedule is more than an
-- hour out. Without this the worker has no way to hand Meta a fetchable
-- URL at publish time.
--
-- image_bucket + image_key are filled at queue time in queueAndPublish.
-- image_public_url continues to be the most recent signed URL we handed
-- Meta; the worker re-signs and overwrites it each time a job fires.

ALTER TABLE role_room_instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS image_bucket TEXT,
  ADD COLUMN IF NOT EXISTS image_key TEXT;

-- Worker query driver: scheduled_for IS NULL means "publish immediately"
-- and scheduled_for <= now() means "due". Both land in the queued status.
CREATE INDEX IF NOT EXISTS role_room_instagram_publish_jobs_due_idx
  ON role_room_instagram_publish_jobs (status, scheduled_for)
  WHERE status = 'queued';

COMMENT ON COLUMN role_room_instagram_publish_jobs.image_bucket IS
  'R2 bucket holding the image to publish. Combined with image_key to re-sign a 1h URL at execute time.';
COMMENT ON COLUMN role_room_instagram_publish_jobs.image_key IS
  'R2 object key (under role-room/instagram-publish/) for the image to publish.';
