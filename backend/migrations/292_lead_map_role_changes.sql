-- 292_lead_map_role_changes.sql
--
-- Audit-log for rolle-endringer (forfremmelser, degradering, lateral
-- movement). Komplementer permission_audit_log (mig 286).
--
-- Hva som beholdes ved rolle-endring (UTEN action — automatisk):
--   - user_id er anker for alt: assigned leads, won/lost-historikk,
--     quota_targets, profiler, audit-log
--   - user_permission_overrides beholdes (extends/restricts new role)
--   - lead_assignment_log beholdes (historikk)
--   - notification_preferences beholdes
--
-- Hva som KAN endres (i wizard):
--   - title (forslag fra mal)
--   - sales_team_id (keep/leave/reassign)
--   - quota_monthly_nok (forslag fra mal)
--
-- "Promotion vs lateral":
--   ROLE_RANK = { admin: 7, salgssjef: 6, teamleder: 5, salgskonsulent: 4,
--                 promotor: 3, member: 2, viewer: 1 }
--   from_rank < to_rank → 'promotion'
--   from_rank > to_rank → 'demotion'
--   from_rank == to_rank → 'lateral'

BEGIN;

CREATE TABLE IF NOT EXISTS member_role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  from_role VARCHAR(30),
  to_role VARCHAR(30) NOT NULL,
  -- 'promotion' | 'demotion' | 'lateral'
  change_type VARCHAR(20) NOT NULL,
  -- Tittel før/etter (kan være null hvis bruker ikke hadde profil)
  from_title VARCHAR(150),
  to_title VARCHAR(150),
  -- Sales-team før/etter
  from_sales_team_id UUID REFERENCES sales_teams(id) ON DELETE SET NULL,
  to_sales_team_id UUID REFERENCES sales_teams(id) ON DELETE SET NULL,
  -- Kvote før/etter
  from_quota_nok NUMERIC(14,2),
  to_quota_nok NUMERIC(14,2),
  -- Forfremmer + grunn
  performed_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  /* Hva som ble håndtert i team-overgangen — 'kept' (samme team),
     'left' (forlot, blir uten team), 'reassigned' (flyttet til annet team) */
  team_transition VARCHAR(20),
  -- Sammendrag av permission-diff (cached for rask UI-render)
  permissions_gained INT NOT NULL DEFAULT 0,
  permissions_lost INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_role_changes_user_time
  ON member_role_changes (organization_id, user_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_role_changes_org_recent
  ON member_role_changes (organization_id, performed_at DESC);

COMMIT;
