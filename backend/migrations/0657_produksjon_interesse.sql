-- «Jeg er interessert.»
--
-- 0646 ga skuespillere beskjed når en produksjon går inn i pre-produksjon.
-- Varselet endte der: du fikk vite at det skjer, og kunne ikke gjøre noe med
-- det. Et varsel uten vei videre lærer folk å ignorere varsler.
--
-- Én rad per person per produksjon. Interessen kan trekkes tilbake — folk blir
-- opptatt, og et valg man ikke får angre på er et valg man vegrer seg for å ta.
-- Derfor withdrawn_at framfor DELETE: produsenten skal se at noen meldte seg og
-- ombestemte seg, i stedet for at raden bare forsvinner.

CREATE TABLE IF NOT EXISTS production_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  talent_id UUID NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  -- Valgfritt. Uten den er meldingen bare «jeg», og det er ofte nok.
  melding TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  CONSTRAINT production_interests_unik UNIQUE (project_id, talent_id)
);

-- «Hvem har meldt seg på denne produksjonen?» er spørsmålet produsenten stiller.
CREATE INDEX IF NOT EXISTS production_interests_prosjekt_idx
  ON production_interests (project_id, created_at DESC)
  WHERE withdrawn_at IS NULL;

-- «Har jeg meldt meg?» er spørsmålet skuespilleren stiller, på hver visning av
-- listen over produksjoner på vei.
CREATE INDEX IF NOT EXISTS production_interests_talent_idx
  ON production_interests (talent_id);
