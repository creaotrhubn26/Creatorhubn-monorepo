-- Har statisten åpnet kortet sitt?
--
-- Etter 0629 vet avsenderen at lenken ble SENDT. Det er ikke det samme som at
-- noen har lest den, og forskjellen er hele poenget: en statist som ikke har
-- åpnet kortet vet ikke hvor hen skal stå, og det oppdages først på settet.
--
-- Én kolonne, og bare den: tidspunktet kortet ble åpnet FØRSTE gang.
-- Ikke antall åpninger, ikke IP, ikke nettleser. Spørsmålet flaten stiller er
-- «har hen sett det?», og da er det første ja-et som teller. Alt annet ville
-- vært sporing av folk som ikke har bedt om det.

ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
