-- Ticker for automatisk kurshenting (gratis Yahoo Finance), f.eks. «EQNR.OL» for Oslo Børs.
-- Kun for aksjer/aksjefond med børsnotert ticker; fond uten ticker oppdateres manuelt.
ALTER TABLE tax_reserve_placements ADD COLUMN ticker TEXT;
