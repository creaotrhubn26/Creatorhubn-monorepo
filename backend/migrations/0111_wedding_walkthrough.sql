-- 0111_wedding_walkthrough.sql
-- Pre-bryllup walkthrough-sjekkliste (Slice 9X.36).
--
-- Stine bør sjekke en rekke ting uken før bryllup. Noen kan systemet
-- beregne automatisk (har alle venues kontakt? er kjøregodtg. beregnet?
-- er værvarsel hentet?). Andre må Stine markere manuelt (batterier
-- ladet, minnekort formatert, backup-disk pakket).
--
-- Manuelle items lagres her — auto-items beregnes on-the-fly.

CREATE TABLE IF NOT EXISTS wedding_walkthrough_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  photographer_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  -- F.eks. 'batteries_charged' | 'memory_cards_formatted' |
  -- 'backup_storage_ready' | 'equipment_packed' |
  -- 'couple_confirmed_timeline' | 'route_drive_tested'
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'done', 'na')),
  -- 'na' = "ikke relevant for dette oppdraget"
  checked_at TIMESTAMPTZ,
  checked_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_walkthrough_unique
  ON wedding_walkthrough_items (wedding_id, photographer_id, item_key);
CREATE INDEX IF NOT EXISTS idx_walkthrough_photographer
  ON wedding_walkthrough_items (photographer_id, updated_at DESC);

COMMENT ON COLUMN wedding_walkthrough_items.item_key IS
  'Identifikator for sjekk-typen. Liste over kjente keys bor i wedding-walkthrough-routes.ts.';
COMMENT ON COLUMN wedding_walkthrough_items.status IS
  'pending = ikke gjort. done = Stine tapped "ferdig". na = "ikke relevant for dette oppdraget".';
