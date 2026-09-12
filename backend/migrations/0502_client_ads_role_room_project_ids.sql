-- Align Ads tenant keys with casting_projects.id, which is VARCHAR(255) and
-- commonly contains Role Room slug IDs rather than UUIDs.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.client_ads_configs') IS NOT NULL THEN
    ALTER TABLE client_ads_configs
      ALTER COLUMN client_project_id TYPE VARCHAR(255)
      USING client_project_id::text;
    COMMENT ON COLUMN client_ads_configs.client_project_id IS
      'Role Room casting_projects.id; text/slug tenant key, not necessarily UUID.';
  END IF;

  IF to_regclass('public.client_authorization_acceptances') IS NOT NULL THEN
    ALTER TABLE client_authorization_acceptances
      ALTER COLUMN client_project_id TYPE VARCHAR(255)
      USING client_project_id::text;
    COMMENT ON COLUMN client_authorization_acceptances.client_project_id IS
      'Snapshot of Role Room casting_projects.id for the authorization audit trail.';
  END IF;
END
$$;

COMMIT;
