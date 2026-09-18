-- Kommer statisten?
--
-- Etter 0630 vet produksjonen at kortet er ÅPNET. Det er ikke det samme som at
-- personen kommer, og forskjellen er den innspillingslederen faktisk ringer
-- rundt for å finne ut. Ett trykk på kortet er billigere enn tjue telefoner.
--
-- Svaret hører til LENKEN (person + dag), ikke til det enkelte kortet: du
-- kommer til dagen, ikke til scene 3. Derfor skrives alle radene bak samme
-- token samtidig, på samme måte som opened_at.
--
--   response       'kommer' eller 'kan_ikke'. NULL = ikke svart, som er noe
--                  annet enn «kan ikke» og skal kunne skilles fra det.
--   responded_at   når svaret sist ble gitt — et svar kan endres, og da er det
--                  tidspunktet som avgjør hva som gjelder.
--   response_note  valgfri melding, kun fra personen selv. Uten den blir
--                  «kan ikke» et svar produksjonen må ringe for å forstå.

ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS response VARCHAR(16);
ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS response_note TEXT;

-- Bare de to verdiene flaten kan produsere. En skrivefeil i et API-kall skal
-- ikke kunne lage en tredje tilstand ingen skjerm vet hvordan den skal vise.
ALTER TABLE scene_role_cards DROP CONSTRAINT IF EXISTS scene_role_cards_response_check;
ALTER TABLE scene_role_cards ADD CONSTRAINT scene_role_cards_response_check
  CHECK (response IS NULL OR response IN ('kommer', 'kan_ikke'));

-- «Hvem har ikke svart?» er spørsmålet dagen før opptak.
CREATE INDEX IF NOT EXISTS scene_role_cards_uten_svar_idx
  ON scene_role_cards (project_id, production_day_id)
  WHERE response IS NULL AND revoked_at IS NULL;
