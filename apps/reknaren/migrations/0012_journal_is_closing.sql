-- Årsavslutning: markerer disponerings-/avslutningsbilag. Slike bilag inngår i
-- balansen (flytter årsresultatet til egenkapital), men holdes UTENFOR det
-- datofiltrerte resultatregnskapet, så avslutningsåret fortsatt viser ekte drift.
ALTER TABLE journal_entries
  ADD COLUMN is_closing BOOLEAN NOT NULL DEFAULT FALSE;
