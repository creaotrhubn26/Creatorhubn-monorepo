-- Hvor langt ut i påminnelsene en organisasjon har kommet.
--
-- Verdien er antall dager som var igjen da siste varsel gikk: 2, 1 eller 0
-- (0 = prøvetiden er ute). Siden tallet bare kan gå nedover, er «send hvis
-- lagret verdi er NULL eller større enn dagens» hele throttlingen — ingen
-- egen varsellogg, ingen tidsvindu-regning, og en cron som kjører to ganger
-- samme dag sender ikke to ganger.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_reminder_stage smallint;

COMMENT ON COLUMN organizations.trial_reminder_stage IS
  'Dager igjen ved siste sendte prøvetidsvarsel (2, 1 eller 0). NULL = ingen sendt.';
