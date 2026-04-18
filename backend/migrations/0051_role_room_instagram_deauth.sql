-- 0051_role_room_instagram_deauth.sql
-- Meta Platform Terms compliance: store the Facebook user id alongside
-- each IG connection so we can match Meta's deauthorization and data-
-- deletion callbacks back to the specific rows. These callbacks arrive
-- with a `signed_request` that decodes to `{user_id: "<fb-user-id>"}`
-- — without that column on the connection we'd have no way to revoke
-- the right token when the user removes our app.
--
-- Also adds a small table to track data-deletion requests so we can
-- return the required `{url, confirmation_code}` response and answer
-- follow-up status checks from Meta's reviewer tooling.

ALTER TABLE role_room_instagram_connections
  ADD COLUMN IF NOT EXISTS fb_user_id TEXT;

CREATE INDEX IF NOT EXISTS role_room_instagram_connections_fb_user_idx
  ON role_room_instagram_connections (fb_user_id)
  WHERE fb_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_room_meta_data_deletion_requests (
  confirmation_code TEXT PRIMARY KEY,
  fb_user_id TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processing', 'completed', 'failed')),
  connections_revoked INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS role_room_meta_data_deletion_fb_user_idx
  ON role_room_meta_data_deletion_requests (fb_user_id, requested_at DESC);

COMMENT ON COLUMN role_room_instagram_connections.fb_user_id IS
  'Facebook user id from GET /me on the long-lived token. Used to match Meta deauth + data-deletion callbacks back to the right connection rows.';

COMMENT ON TABLE role_room_meta_data_deletion_requests IS
  'Log of Meta data-deletion callbacks. Each row is the confirmation_code we returned to Meta, what user the deletion targeted, and whether we have completed the revocation/removal.';
