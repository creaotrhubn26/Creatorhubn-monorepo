BEGIN;

-- The physical table retains its historic name until all Role Room writers
-- have moved. New CreatorHub integrations read through this product-neutral
-- compatibility view, avoiding a breaking table rename or writable-view trap.
CREATE OR REPLACE VIEW creatorhub_google_connections AS
SELECT *
  FROM role_room_google_connections;

COMMENT ON VIEW creatorhub_google_connections IS
  'Product-neutral read contract for CreatorHub Google Workspace connections. The legacy physical table remains writable during migration.';

COMMIT;
