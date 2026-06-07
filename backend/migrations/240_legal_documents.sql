-- 240_legal_documents.sql
-- Task #118: Persistens + versjons-historikk for juridiske dokumenter
-- (privacy-policy, terms-conditions, cookie-policy, dpa)
--
-- NB: Task-spek refererte til "230_legal_documents.sql", men 230_ er allerede
-- tatt av 230_desktop_device_tokens.sql. Brukte derfor neste ledige nummer (240).

-- Det fantes en tidligere `legal_documents`-tabell med kun (id, created_at,
-- updated_at) — orphan fra abortert tidligere forsøk. Verifisert at ingen
-- annen kode refererer til dette skjemaet (kun admin-gdpr-legal-routes.ts).
-- Trygt å drope og opprette på nytt med riktig skjema.
DROP TABLE IF EXISTS legal_document_revisions CASCADE;
DROP TABLE IF EXISTS legal_documents CASCADE;

CREATE TABLE IF NOT EXISTS legal_documents (
  document_key TEXT PRIMARY KEY,
    -- 'privacy-policy', 'terms-conditions', 'cookie-policy', 'dpa'
  display_name TEXT NOT NULL,
  current_version TEXT NOT NULL DEFAULT '1.0',
  current_content TEXT NOT NULL DEFAULT '',
  current_published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_key TEXT NOT NULL REFERENCES legal_documents(document_key) ON DELETE CASCADE,
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_by TEXT,
  notes TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_key, version)
);

CREATE INDEX IF NOT EXISTS legal_document_revisions_doc_idx
  ON legal_document_revisions (document_key, published_at DESC);

-- Seed defaults
INSERT INTO legal_documents (document_key, display_name, current_content)
VALUES
  ('privacy-policy', 'Personvernerklæring',
    'Dette er en placeholder personvernerklæring. Rediger via Admin → GDPR.'),
  ('terms-conditions', 'Vilkår og betingelser',
    'Dette er en placeholder for vilkår og betingelser. Rediger via Admin → GDPR.'),
  ('cookie-policy', 'Cookie-policy',
    'Dette er en placeholder cookie-policy.'),
  ('dpa', 'Data Processing Agreement',
    'Dette er en placeholder DPA.')
ON CONFLICT (document_key) DO NOTHING;
