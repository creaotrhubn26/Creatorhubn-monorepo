-- Hvem var til stede da samtykket ble gitt?
--
-- DPIA-utkastet §5 punkt 1: «Samtykket innhentes fra kunden. Sitter det to
-- personer der, har bare den ene sagt ja.»
--
-- Et opptak fanger alle i rommet. Samtykke fra én av dem dekker ikke de
-- andre, og uten å vite hvor mange som var der kan vi ikke i ettertid
-- avgjøre om behandlingen hadde grunnlag.
--
-- Vi lagrer ANTALL, ikke navn. Navn på en tredjeperson ville vært en ny
-- personopplysning vi ikke trenger for å svare på spørsmålet.

ALTER TABLE leadbook_recording_consents
  ADD COLUMN IF NOT EXISTS tilstede_antall INT,
  ADD COLUMN IF NOT EXISTS alle_tilstede_samtykket BOOLEAN;

COMMENT ON COLUMN leadbook_recording_consents.tilstede_antall IS
  'Antall personer fra kundesiden til stede. Antall, ikke navn — identiteten trengs ikke for å vurdere grunnlaget.';
