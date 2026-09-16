-- Skuespiller-CV: krediteringer.
--
-- talents-tabellen (mig 209) har resume_url — en fil — men ingen struktur.
-- En skuespiller-CV er i praksis en liste krediteringer: rolle, produksjon,
-- produsent/teater, regissør og år. Uten struktur kan vi verken vise dem
-- sortert, filtrere på dem i byrå-søk, eller koble to skuespillere til samme
-- oppsetning.
--
-- Bevisst IKKE gjenbrukt resume_experiences (NextRole): den er bygget for
-- stilling + arbeidsgiver + ansettelsestype. «Hamlet, Nationaltheatret,
-- regi: Eirik Stubø» passer ikke i de feltene.
--
-- Synlighet: krediteringer er en del av profilen og styres av samtykke i
-- talent_consent_registry på samme måte som resten. Denne tabellen har ingen
-- egen tilgangslogikk.

CREATE TABLE IF NOT EXISTS talent_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,

  -- film_tv | theatre | commercial | voice | other
  category VARCHAR(30) NOT NULL DEFAULT 'film_tv',

  -- Produksjonen: «The Hollow Sky», «A Streetcar Named Desire»
  title VARCHAR(255) NOT NULL,
  -- Rollen skuespilleren hadde: «Anna West», «Blanche DuBois»
  role_name VARCHAR(255),
  -- lead | supporting | featured | ensemble | voice | extra
  role_type VARCHAR(40),

  -- Hvem som produserte/spilte den: «BBC», «Young Vic, London»
  production_company VARCHAR(255),
  -- Org.nr når produksjonsselskapet er slått opp i Brønnøysund, så to
  -- stavemåter av samme teater kan slås sammen senere.
  production_org_number VARCHAR(20),
  director VARCHAR(255),

  -- TV-serie, spillefilm, kortfilm, reklame … fritekst inntil vi har
  -- et kontrollert vokabular.
  format VARCHAR(120),

  year INTEGER,
  -- Rekkefølge i CV-en. Lavest først; NULL sorteres etter år.
  sort_order INTEGER,

  notes TEXT,
  -- Lenke til klipp/omtale for denne krediteringen.
  external_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_credits_talent_idx
  ON talent_credits (talent_id, category, year DESC NULLS LAST);

-- Samme produksjon på tvers av skuespillere: grunnlaget for autocomplete og
-- for «hvem andre var med i denne».
CREATE INDEX IF NOT EXISTS talent_credits_title_idx
  ON talent_credits (LOWER(title));

DROP TRIGGER IF EXISTS update_talent_credits_updated_at ON talent_credits;
CREATE TRIGGER update_talent_credits_updated_at
  BEFORE UPDATE ON talent_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
