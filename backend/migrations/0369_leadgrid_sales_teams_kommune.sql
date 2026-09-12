-- 0369: Kommune-basert teamområde (Kartverket)
--
-- Team kan nå tildeles en offisiell norsk kommune som område i tillegg
-- til (eller i stedet for) sirkel-sonen. iPad-appen tegner da den ekte
-- kommunegrensen fra Kartverket (kommuneinfo/omrade) på Team-kartet.

BEGIN;

ALTER TABLE leadgrid_sales_teams
  ADD COLUMN IF NOT EXISTS area_kommunenummer VARCHAR(4),
  ADD COLUMN IF NOT EXISTS area_kommune_navn TEXT;

COMMIT;
