-- 222_competitor_auto_snapshot.sql
--
-- Adds opt-in auto-snapshot tracking per competitor row. When auto_snapshot=true,
-- the in-process worker (role-room-competitor-snapshot-worker.ts) wakes hourly
-- and refreshes any row whose last_snapshot_at is older than 24h.
--
-- Idempotent.

ALTER TABLE marketing_competitor_pages
  ADD COLUMN IF NOT EXISTS auto_snapshot BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE marketing_competitor_pages
  ADD COLUMN IF NOT EXISTS last_snapshot_at TIMESTAMPTZ;

-- Worker-query (auto-on + due) trenger denne:
CREATE INDEX IF NOT EXISTS idx_marketing_competitor_pages_auto_due
  ON marketing_competitor_pages (brand_key, last_snapshot_at)
  WHERE auto_snapshot = true AND active = true;
