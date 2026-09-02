-- 0501: isolate Leadgrid RBAC overrides from the legacy feature override table.
--
-- user_permission_overrides predates Leadgrid and stores feature_id/access_level.
-- Migration 286 used CREATE TABLE IF NOT EXISTS with the same name, so existing
-- databases never received Leadgrid's permission_key/effect contract. Keep the
-- legacy table intact and give Leadgrid a dedicated, tenant-bound namespace.

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  permission_key VARCHAR(80) NOT NULL
    REFERENCES permissions(key) ON DELETE CASCADE,
  effect VARCHAR(10) NOT NULL CHECK (effect IN ('grant', 'revoke')),
  granted_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  UNIQUE (organization_id, user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_user_perm_overrides_user
  ON leadgrid_user_permission_overrides (organization_id, user_id);

COMMIT;
