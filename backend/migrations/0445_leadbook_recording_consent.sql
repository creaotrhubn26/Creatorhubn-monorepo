-- 0445: Leadbook lydopptak fase 2 — samtykke-sporing (2026-08-16)
--
-- IKKE en opptak/lyd-tabell — ingen rå lyd persisteres noe sted (se
-- docs/leadgrid-gdpr-lydopptak.md). Transkripsjon skjer on-device
-- (SFSpeechRecognizer/Apple Intelligence, LiveTranscription.swift) og kun
-- den ferdige TEKSTEN lagres, som et vanlig leadbook_examples-utkast.
--
-- Denne tabellen logger KUN samtykke-hendelsen (§4 i GDPR-pakken): at en
-- selger bekreftet at kunden muntlig samtykket til opptak/transkripsjon,
-- FØR mikrofonen faktisk startes. leadbook_examples.source_consent_id
-- peker bakover til hvilket samtykke som autoriserte et gitt eksempel —
-- samme mønster som source_verification_id (mig 0379).

CREATE TABLE IF NOT EXISTS leadbook_recording_consents (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,               -- selgeren som bekreftet samtykket
  consent_version TEXT NOT NULL,       -- ordlyd-versjon, jf. §4.2
  customer_label TEXT NOT NULL DEFAULT '',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_lb_rec_consent_org
  ON leadbook_recording_consents (organization_id, consented_at DESC);

ALTER TABLE leadbook_examples
  ADD COLUMN IF NOT EXISTS source_consent_id UUID,
  ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_source_consent
  ON leadbook_examples (source_consent_id)
  WHERE source_consent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lb_examples_delete_requested
  ON leadbook_examples (delete_requested_at)
  WHERE delete_requested_at IS NOT NULL AND anonymized_at IS NULL;

-- §7/§8: org-admin bekrefter compliance-sjekklisten (ansatt-drøfting,
-- skriftlig rutine, informasjonsskriv) FØR leadbookLydopptak-entitlementet
-- kan skrus på for org-en. Én rad per org — bekreftelsen ER det som åpner
-- nøkkelen (se leadbook-recording-consent-routes.ts).
CREATE TABLE IF NOT EXISTS leadbook_recording_compliance_ack (
  organization_id TEXT PRIMARY KEY,
  acknowledged_by TEXT NOT NULL,
  acknowledged_by_name TEXT NOT NULL DEFAULT '',
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checklist JSONB NOT NULL DEFAULT '{}'  -- {drofting: true, rutine: true, infoskriv: true}
);
