-- 0459_role_room_funding_snapshots.sql
--
-- Del A punkt 114, andre runde — etter research på NFIs faktiske krav.
--
-- Den opprinnelige antakelsen var at oppgaven er å gjengi NFIs kodeliste
-- riktig. Det er ikke kravet. NFIs veileder for prosjektregnskap sier:
--
--   «Regnskap skal føres i henhold til kontoplan i godkjent kalkyleskjema.
--    Med dette menes at regnskapet skal settes opp i samsvar med kalkyle/
--    budsjett og kontoplan som ble brukt da søknad ble sendt inn.»
--
-- Kravet er altså INTERN KONSISTENS over tid, ikke samsvar med én fasit.
-- Regnskapet skal matche det som faktisk ble sendt inn — og da er den
-- farligste feilen ikke en gal postkode, men en kartlegging som endrer seg
-- STILLE etter innsending. Produsenten oppdager det først ved revisjon, når
-- regnskapet ikke lar seg avstemme mot søknaden.
--
-- Derfor fryses kartleggingen og tallene ved innsending. Snapshotet er
-- fasiten regnskapet senere måles mot.
--
-- Revisorbekreftet regnskap kreves over gitte beløpsgrenser (250 000 for
-- tilskudd mot avregning, 500 000 for prosjekttilskudd uten avregning), så
-- avstemmingen må kunne dokumenteres.

CREATE TABLE IF NOT EXISTS role_room_funding_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scheme_key    VARCHAR(60) NOT NULL,

  -- Fritekst: «Søknad om produksjonstilskudd, 12.03.2027».
  label         VARCHAR(255) NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by_user_id VARCHAR(255),

  -- Hele eksporten slik den så ut ved innsending: poster, kartlegging og
  -- beløp. Lagres samlet fordi det er ett dokument i tid — ikke noe som skal
  -- kunne redigeres rad for rad i ettertid.
  export_payload JSONB NOT NULL,

  -- Summen som ble sendt inn. Løftes ut av payloaden for å kunne spørres på.
  total_estimate NUMERIC(14,2),
  currency       VARCHAR(10),

  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_funding_snapshots_project
  ON role_room_funding_snapshots (project_id, submitted_at DESC);

COMMENT ON TABLE role_room_funding_snapshots IS
  'Fryst budsjetteksport ved innsending (Del A punkt 114). NFI krever at senere prosjektregnskap føres etter kontoplanen i godkjent kalkyleskjema.';
COMMENT ON COLUMN role_room_funding_snapshots.export_payload IS
  'Hele eksporten som ett dokument i tid. Skal ikke redigeres — den er fasiten regnskapet avstemmes mot.';
