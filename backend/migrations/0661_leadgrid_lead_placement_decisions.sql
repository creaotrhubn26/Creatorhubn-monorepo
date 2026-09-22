-- Hvor en lead faktisk ligger — og hvem som bestemte det.
--
-- Kartlaget filtrerer bort koordinat 0,0, så en lead uten plassering er
-- usynlig på kartet. Adressen kan vi slå opp hos Kartverket, men oppslaget
-- er ikke entydig: «Storgata 1» finnes i hundre kommuner, og selv innenfor
-- ett postnummer kan fritekstsøket gi flere treff.
--
-- Å gjette er verre enn å la være. En pin i feil kommune ser like riktig ut
-- som en riktig pin, og selgeren oppdager det først når hen står der.
--
-- Derfor: når oppslaget er entydig plasserer vi selv. Når det ikke er det,
-- spør vi — og HER lagres svaret, slik at
--   1. samme lead aldri blir spurt om igjen,
--   2. samme adresse i samme organisasjon plasseres automatisk neste gang,
--   3. vi kan se hvor ofte oppslaget faktisk er tvetydig, per kilde.
--
-- Nøkkelen er `query_key`: normalisert adresse + postnummer/poststed, altså
-- akkurat det vi spurte Kartverket om. To leads med samme adresse i samme
-- organisasjon får dermed samme svar uten et nytt spørsmål til brukeren.
CREATE TABLE IF NOT EXISTS leadgrid_lead_placement_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  project_id text NOT NULL,
  lead_id uuid NOT NULL,
  query_key text NOT NULL,
  municipality_number text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  label text,
  -- brreg_municipality: kommunenummeret fra Enhetsregisteret gjorde treffet
  --   entydig uten at noen måtte spørres.
  -- unique_match: adressesøket ga nøyaktig ett punkt.
  -- user_verified: flere kandidater, og et menneske pekte.
  source text NOT NULL CHECK (
    source IN ('brreg_municipality', 'unique_match', 'user_verified')
  ),
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Én gjeldende avgjørelse per lead. Endrer adressen seg, skrives raden over.
CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_lead_placement_decisions_lead_idx
  ON leadgrid_lead_placement_decisions (lead_id);

-- Oppslaget som gjør at neste lead på samme adresse slipper spørsmålet.
CREATE INDEX IF NOT EXISTS leadgrid_lead_placement_decisions_query_idx
  ON leadgrid_lead_placement_decisions (organization_id, query_key);
