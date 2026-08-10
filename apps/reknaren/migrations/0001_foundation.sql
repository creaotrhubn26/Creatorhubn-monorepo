-- Fundament: organisasjoner, brukere, roller, perioder, kontoplan,
-- bilag (journal), audit-logg, dokumenter, leverandører/kunder, bank.
--
-- Prinsipper:
--  * Alle beløp er BIGINT i valutaens minste enhet (øre). Aldri flyttall.
--  * Alle økonomiske tabeller har organisasjonstilhørighet + revisjonsfelter.
--  * Bokførte posteringer er append-only: ingen UPDATE/DELETE i applikasjonen,
--    og triggere håndhever det i databasen som forsvar i dybden.

CREATE TABLE organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  org_number TEXT UNIQUE, -- 9-sifret organisasjonsnummer, NULL før registrering
  org_form TEXT NOT NULL CHECK (org_form IN ('ENK','AS','ANS','DA','SA','NUF')),
  vat_status TEXT NOT NULL DEFAULT 'not_registered'
    CHECK (vat_status IN ('registered','not_registered','pending')),
  vat_registered_from DATE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed'))
);

CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))
);

CREATE TABLE memberships (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN (
    'owner','admin','general_manager','accounting_manager','accountant',
    'auditor_readonly','attestant','approver','employee','external_advisor'
  )),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE accounting_periods (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked')),
  locked_by UUID,
  locked_at TIMESTAMPTZ,
  lock_reason TEXT,
  UNIQUE (organization_id, year, month)
);

CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_number TEXT NOT NULL, -- firesifret NS4102-basert nummer
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, account_number)
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  org_number TEXT,
  country TEXT NOT NULL DEFAULT 'NO',
  default_account_number TEXT,
  default_vat_code TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);
CREATE INDEX vendors_org_name_idx ON vendors (organization_id, lower(name));

CREATE TABLE customers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  org_number TEXT,
  email TEXT,
  country TEXT NOT NULL DEFAULT 'NO',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived'))
);

-- Kildedokumenter (bilag): e-postvedlegg, opplastinger, mobilbilder.
CREATE TABLE source_documents (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  source TEXT NOT NULL CHECK (source IN ('gmail','upload','mobile','forward','integration')),
  gmail_message_id TEXT,
  gmail_attachment_id TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL,
  sha256 TEXT NOT NULL, -- integritetssjekk av innholdet
  storage_key TEXT NOT NULL, -- nøkkel i objektlager
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN (
    'received','scanning','extracted','needs_review','approved','posted','rejected','duplicate','quarantined'
  )),
  duplicate_of UUID REFERENCES source_documents(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1
);
CREATE INDEX source_documents_org_idx ON source_documents (organization_id, status);
CREATE INDEX source_documents_sha_idx ON source_documents (organization_id, sha256);
CREATE UNIQUE INDEX source_documents_gmail_unique
  ON source_documents (organization_id, gmail_message_id, gmail_attachment_id)
  WHERE gmail_message_id IS NOT NULL;

-- Strukturert uttrekk fra dokument (OCR/tolkning). Én rad per uttrekksversjon.
CREATE TABLE extracted_document_data (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES source_documents(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  extraction_version INT NOT NULL DEFAULT 1,
  document_type TEXT CHECK (document_type IN (
    'receipt','supplier_invoice','credit_note','order_confirmation','payment_confirmation','customs','unknown'
  )),
  vendor_name TEXT,
  vendor_org_number TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  kid TEXT,
  bank_account TEXT,
  currency TEXT,
  net_minor BIGINT,
  vat_minor BIGINT,
  gross_minor BIGINT,
  vat_breakdown JSONB, -- [{ratePct, baseMinor, vatMinor}]
  line_items JSONB,
  purchase_country TEXT,
  foreign_service BOOLEAN,
  extraction_engine TEXT NOT NULL DEFAULT 'deterministic-mvp',
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending','valid','discrepancy')),
  validation_issues JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, extraction_version)
);

-- Journal: bokførte bilag. Append-only.
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  entry_number BIGINT NOT NULL, -- løpende bilagsnummer per organisasjon
  entry_date DATE NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  description TEXT NOT NULL,
  source_document_id UUID REFERENCES source_documents(id),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  reversal_of UUID REFERENCES journal_entries(id),
  posted_by UUID NOT NULL,
  posted_by_role TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entry_number),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX journal_entries_org_date_idx ON journal_entries (organization_id, entry_date);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES journal_entries(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  line_number INT NOT NULL,
  account_number TEXT NOT NULL,
  vat_code TEXT,
  debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  -- originalvaluta når transaksjonen ikke er i NOK:
  original_currency TEXT,
  original_amount_minor BIGINT,
  exchange_rate TEXT,          -- desimalstreng, aldri flyttall
  exchange_rate_source TEXT,   -- f.eks. 'norges-bank'
  description TEXT,
  vendor_id UUID REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  project TEXT,
  department TEXT,
  CHECK (NOT (debit_minor > 0 AND credit_minor > 0)),
  CHECK (debit_minor > 0 OR credit_minor > 0),
  UNIQUE (entry_id, line_number)
);
CREATE INDEX journal_lines_org_account_idx ON journal_lines (organization_id, account_number);

-- Bank
CREATE TABLE bank_accounts (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  ledger_account_number TEXT NOT NULL DEFAULT '1920',
  iban_or_account TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disconnected'))
);

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id),
  external_id TEXT NOT NULL, -- id fra bank/leverandør, idempotent import
  booked_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL, -- negativt = ut, positivt = inn
  currency TEXT NOT NULL DEFAULT 'NOK',
  description TEXT NOT NULL,
  counterparty TEXT,
  kid TEXT,
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','reconciled','ignored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, external_id)
);

CREATE TABLE reconciliation_matches (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bank_transaction_id UUID NOT NULL REFERENCES bank_transactions(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  source_document_id UUID REFERENCES source_documents(id),
  match_type TEXT NOT NULL CHECK (match_type IN ('exact','rule','manual','ai_suggested')),
  matched_amount_minor BIGINT NOT NULL,
  explanation TEXT NOT NULL, -- hvorfor treffet ble foreslått
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-/systemforslag på dokumenter, med forklaring. Skjema valideres i appen (zod).
CREATE TABLE posting_suggestions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL REFERENCES source_documents(id),
  suggestion JSONB NOT NULL,
  engine TEXT NOT NULL, -- 'deterministic' | 'ai:<modell>'
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','superseded')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revisjonslogg: append-only, alle vesentlige hendelser.
CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  actor_user_id UUID,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason TEXT,
  previous_value JSONB,
  new_value JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_idx ON audit_events (organization_id, occurred_at);
CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id);

-- Gmail-integrasjonstilkoblinger. Tokens lagres KRYPTERT (appen krypterer før insert).
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL CHECK (provider IN ('gmail','bank')),
  account_identifier TEXT NOT NULL, -- f.eks. gmail-adresse
  scopes TEXT[] NOT NULL,
  encrypted_credentials TEXT, -- kryptert blob; NULL i sandbox
  filter_config JSONB, -- etiketter, avsendere, datoperiode brukeren har valgt
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired','disconnected')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, account_identifier)
);

-- ── Forsvar i dybden: bokførte data er uforanderlige ─────────────────────────
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabellen % er append-only. Rett feil med reversering/korrigering, ikke endring.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- journal_entries: kun statusovergang posted->reversed er lov (settes av reverseringsflyt).
CREATE OR REPLACE FUNCTION journal_entries_guard() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.organization_id, NEW.entry_number, NEW.entry_date, NEW.period_id,
      NEW.description, NEW.idempotency_key, NEW.posted_by, NEW.posted_at)
     IS DISTINCT FROM
     (OLD.id, OLD.organization_id, OLD.entry_number, OLD.entry_date, OLD.period_id,
      OLD.description, OLD.idempotency_key, OLD.posted_by, OLD.posted_at) THEN
    RAISE EXCEPTION 'Bokførte posteringer kan ikke endres. Bruk reversering.';
  END IF;
  IF OLD.status = 'reversed' THEN
    RAISE EXCEPTION 'Posteringen er allerede reversert.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_no_delete
  BEFORE DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER journal_entries_update_guard
  BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION journal_entries_guard();
CREATE TRIGGER journal_lines_no_update
  BEFORE UPDATE ON journal_lines FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER journal_lines_no_delete
  BEFORE DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Bilagsnummer-sekvens per organisasjon.
CREATE TABLE organization_counters (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  next_entry_number BIGINT NOT NULL DEFAULT 1
);
