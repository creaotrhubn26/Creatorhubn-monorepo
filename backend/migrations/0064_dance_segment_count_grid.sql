-- 0064_dance_segment_count_grid.sql
-- Legg til count_grid JSONB på dance_choreography_segment.
--
-- Modell: { includeLeadup: boolean, entries: CountEntry[] }
-- CountEntry: { count, movement?, position?, formation?, direction?, energy?, note?, videoRefUrl? }
--
-- Brukes av CountGrid-komponenten — koreograf bygger 8-counts pr. segment
-- med movement/position/formation/direction/energy/note pr. count.
-- Eksisterende rader får default '{}'::jsonb (ingen counts ennå).
--
-- replaceSegments er atomisk så denne kolonnen blir alltid skrevet på nytt
-- sammen med resten av segmentet.

ALTER TABLE dance_choreography_segment
  ADD COLUMN IF NOT EXISTS count_grid JSONB NOT NULL DEFAULT '{}'::jsonb;
