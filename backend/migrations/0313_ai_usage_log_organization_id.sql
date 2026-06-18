-- 0313_ai_usage_log_organization_id.sql
--
-- Gir super-admin oversikt over Claude-token-forbruk per organisasjon.
-- ai_usage_log eksisterte fra før (logger fra capture/post-agent/admin-room-
-- funding/reference-archive), men hadde bare user_id. Vi legger til
-- organization_id og backfiller fra organization_members.

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_org_time
  ON ai_usage_log (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Backfill: bruker som tilhører kun én org får org-id satt.
-- Brukere med flere orgs forblir NULL (vi setter org_id eksplisitt
-- fremover i call-sitene).
UPDATE ai_usage_log a
   SET organization_id = sub.org_id
  FROM (
    SELECT m.user_id, m.organization_id AS org_id
      FROM organization_members m
      JOIN (
        SELECT user_id, COUNT(*) AS c
          FROM organization_members
         GROUP BY user_id HAVING COUNT(*) = 1
      ) once ON once.user_id = m.user_id
  ) sub
 WHERE a.user_id = sub.user_id
   AND a.organization_id IS NULL;
