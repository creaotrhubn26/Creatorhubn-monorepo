-- Samtykke-logg med hash-kjede.
--
-- Hvorfor dette finnes ved siden av talent_consent_registry (mig 210):
-- registeret sier hva som er delt NÅ — det er en tilstand som endres. Denne
-- loggen sier hva en person sa ja til, når, og med hvilken autentisering.
-- Den endres aldri.
--
-- Formålet er bevis. Norsk avtalerett har formfrihet: en avtale er bindende
-- uten signatur, og det som teller i en tvist er bevis for at DENNE personen
-- sa ja til DETTE innholdet på DETTE tidspunktet. Derfor tre bindinger:
--
--   1. Innholdet — document_hash + versjon, og selve teksten bevart i
--      consent_documents. «Aksepterte vilkår» uten å vite hvilke vilkår er
--      nesten verdiløst.
--   2. Personen — auth_event_id peker på en BankID-autentisering, ikke bare
--      på en innlogget økt.
--   3. Rekkefølgen — prev_hash/row_hash danner en kjede. Endres en gammel
--      rad, brytes kjeden i alle radene etter.
--
-- 🔑 Kjeden er vår egen, og kan i prinsippet regnes om i sin helhet. Det som
-- lukker det hullet er consent_chain_anchors: kjedens hode skrives jevnlig
-- til et sted utenfor vår kontroll (tidsstempeltjeneste, e-post til revisor).
-- Tabellen ligger her nå så ankringen kan slås på uten skjemaendring.
--
-- Dette er «BankID-autentisert samtykke», IKKE «BankID-signert». Forskjellen
-- er at et signaturbevis utstedes av en tredjepart. Å kalle det signert er
-- den ene tingen som kan slå tilbake.

-- Teksten brukeren faktisk så, én rad per versjon.
CREATE TABLE IF NOT EXISTS consent_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- terms | privacy | agency_share | guardian | contract
  kind VARCHAR(40) NOT NULL,
  version VARCHAR(40) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'nb-NO',
  body TEXT NOT NULL,
  -- sha256 av body. Loggen peker på denne, ikke på teksten.
  body_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_documents_version_idx
  ON consent_documents (kind, version, locale);

CREATE TABLE IF NOT EXISTS consent_ledger (
  -- Rekkefølgen i kjeden. BIGSERIAL, ikke tidsstempel: to rader kan dele
  -- millisekund, men aldri sekvensnummer.
  seq BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Hva samtykket gjelder
  subject_type VARCHAR(40) NOT NULL,
  subject_ref VARCHAR(255),
  document_id UUID REFERENCES consent_documents(id),
  document_hash CHAR(64) NOT NULL,

  -- granted | withdrawn
  action VARCHAR(20) NOT NULL,

  -- Hvordan personen ble identifisert i dette øyeblikket
  -- bankid | buypass | session
  auth_method VARCHAR(30) NOT NULL,
  auth_event_id UUID REFERENCES eid_auth_events(id),

  -- (3) = millisekunder, med vilje. Postgres lagrer mikrosekunder, mens
  -- tidspunktet som hashes er en ISO-streng med millisekunder. Uten
  -- presisjonsgrensen ville en rad skrevet med DEFAULT now() fått et
  -- tidspunkt som ikke kan gjenskapes fra JavaScript-siden, og verifyChain
  -- ville meldt kjeden brutt uten at noen hadde rørt den.
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  -- Kjeden
  prev_hash CHAR(64) NOT NULL,
  row_hash CHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS consent_ledger_user_idx ON consent_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consent_ledger_subject_idx ON consent_ledger (subject_type, subject_ref);
CREATE UNIQUE INDEX IF NOT EXISTS consent_ledger_row_hash_idx ON consent_ledger (row_hash);

-- Loggen skal ikke kunne endres i etterkant. Databasen håndhever det, ikke
-- bare disiplinen til den som skriver koden.
CREATE OR REPLACE FUNCTION consent_ledger_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_ledger er append-only (forsøk: %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS consent_ledger_no_update ON consent_ledger;
CREATE TRIGGER consent_ledger_no_update
  BEFORE UPDATE OR DELETE ON consent_ledger
  FOR EACH ROW EXECUTE FUNCTION consent_ledger_is_append_only();

-- Kjedens hode, skrevet til et sted utenfor vår kontroll.
CREATE TABLE IF NOT EXISTS consent_chain_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq BIGINT NOT NULL,
  row_hash CHAR(64) NOT NULL,
  -- rfc3161 | email | manual — hvor hodet ble forankret
  anchor_kind VARCHAR(30) NOT NULL,
  -- Kvittering fra tjenesten: tidsstempel-token, meldings-id, referanse
  anchor_ref TEXT,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_chain_anchors_seq_idx ON consent_chain_anchors (seq DESC);
