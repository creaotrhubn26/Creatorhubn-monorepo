-- Production can contain the original runtime-created Photo Room table. Keep
-- the forward repair safe for both that legacy shape and clean installations,
-- then make the least-privilege application role's write contract explicit.

ALTER TABLE project_photo_review
  ADD COLUMN IF NOT EXISTS updated_by varchar,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE project_photo_review
   SET updated_at = now()
 WHERE updated_at IS NULL;

ALTER TABLE project_photo_review
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'creatorhub_runtime_login') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE project_photo_review
      TO creatorhub_runtime_login;
    GRANT SELECT, UPDATE
      ON TABLE capture_assets
      TO creatorhub_runtime_login;
  END IF;
END
$$;
