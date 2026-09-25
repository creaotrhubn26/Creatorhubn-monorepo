-- Hvilke koblinger blir faktisk brukt?
--
-- Styrkene i leadgrid-nexus-koblinger.ts (samme kunde 100, samme møte 80,
-- samme sted 60, samme selskap 50) er valgt av en utvikler ut fra hva som
-- HØRTES riktig ut. Ingen av dem er målt.
--
-- Denne tabellen teller to ting per kilde: hvor ofte en kobling ble vist,
-- og hvor ofte noen faktisk åpnet den. Da kan rekkefølgen læres i stedet
-- for å gjettes.
--
-- Vi lagrer ikke hvilket notat eller hvilken bruker — bare kilden og
-- prosjektet. Det er nok til å rangere, og lite nok til at ingen kan lese
-- ut hvem som så på hva.

CREATE TABLE IF NOT EXISTS leadgrid_nexus_kobling_bruk (
  organization_id TEXT NOT NULL,
  project_id      TEXT NOT NULL,
  kilde           TEXT NOT NULL
                  CHECK (kilde IN ('lead','sted','mote','selskap','manuell',
                                   'person','referert','samtidig')),
  visninger       BIGINT NOT NULL DEFAULT 0,
  aapninger       BIGINT NOT NULL DEFAULT 0,
  oppdatert_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, project_id, kilde)
);

COMMENT ON TABLE leadgrid_nexus_kobling_bruk IS
  'Visninger og åpninger per koblingskilde. Grunnlag for å lære rekkefølgen i Nexus-koblingspanelet i stedet for å gjette den.';
