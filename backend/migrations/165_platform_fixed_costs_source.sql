-- Utvid platform_fixed_costs med felter for live-synk fra eksterne leverandører
--
-- source         : 'manual' | 'render' | 'neon' | 'vercel' | 'stripe'
-- external_id    : leverandørens ID (service-ID, project-ID, etc)
-- last_synced_at : når raden sist ble oppdatert fra leverandør-API
-- auto_managed   : TRUE = beløp/plan styres av synk, FALSE = manuelt redigerbar
--
-- Auto-managed-rader ER fortsatt redigerbare i UI (for share-% og notes),
-- men beløp/plan overskrives ved neste synk.

ALTER TABLE platform_fixed_costs
  ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_managed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE platform_fixed_costs
  DROP CONSTRAINT IF EXISTS platform_fixed_costs_source_check;

ALTER TABLE platform_fixed_costs
  ADD CONSTRAINT platform_fixed_costs_source_check
  CHECK (source IN ('manual', 'render', 'neon', 'vercel', 'stripe', 'anthropic', 'google'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_fixed_costs_external
  ON platform_fixed_costs (user_id, source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_fixed_costs_source
  ON platform_fixed_costs (user_id, source);
