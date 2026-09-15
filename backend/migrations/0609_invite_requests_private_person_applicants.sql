-- Prototype-testere som er privatpersoner.
--
-- invite_requests.company_name og .organization_number var NOT NULL, så en
-- tester uten firma — skuespiller, frilanser, student — kunne ikke sende
-- søknad i det hele tatt. Søknadsruten krevde i tillegg et org.nr som slår
-- opp i Brønnøysundregistrene.
--
-- Etter denne migrasjonen kan begge være NULL. Bedriftssøknader er uendret:
-- ruten krever fortsatt firmanavn + gyldig org.nr for alle andre enn
-- prototype-tester-søknader merket applicantType='private'.
--
-- Idempotent: DROP NOT NULL på en kolonne som allerede tillater NULL er en
-- no-op i Postgres.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invite_requests' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE invite_requests ALTER COLUMN company_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invite_requests' AND column_name = 'organization_number'
  ) THEN
    ALTER TABLE invite_requests ALTER COLUMN organization_number DROP NOT NULL;
  END IF;
END $$;
