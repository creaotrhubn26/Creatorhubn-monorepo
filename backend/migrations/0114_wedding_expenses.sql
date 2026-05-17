-- 0114_wedding_expenses.sql
-- Utlegg-flyt for bryllupsdagen (Slice 9X.40). Bygger på eksisterende
-- additional_costs-tabell — legger til wedding_id (utover project_id),
-- kvitterings-foto-URL, og en utleggs-kategori med vanlige norske
-- bryllupsdag-utlegg.

ALTER TABLE additional_costs
  ADD COLUMN IF NOT EXISTS wedding_id VARCHAR(64);
ALTER TABLE additional_costs
  ADD COLUMN IF NOT EXISTS receipt_photo_url TEXT;
ALTER TABLE additional_costs
  ADD COLUMN IF NOT EXISTS expense_category TEXT;
-- 'parking' | 'meal' | 'gift' | 'supplies' | 'fuel' | 'toll' | 'other'

CREATE INDEX IF NOT EXISTS idx_additional_costs_wedding
  ON additional_costs (wedding_id) WHERE wedding_id IS NOT NULL;

COMMENT ON COLUMN additional_costs.wedding_id IS
  'Direkte FK til wedding_timelines.id. Brukes for hurtigregistrering på bryllupsdag og faktura-sammenstilling.';
COMMENT ON COLUMN additional_costs.expense_category IS
  'Norsk bryllupsdag-kategori: parking, meal, gift, supplies, fuel, toll, other.';
