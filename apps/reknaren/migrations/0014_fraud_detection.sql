-- Avviks- og svindeldeteksjon.
-- Deteksjonsmotoren (src/ledger/fraud-detection.ts) er REN LESING over hovedboken
-- og linkede dokumenter. Disse tabellene lagrer KUN menneskelige vurderinger og
-- kontrollpolicy oppå deteksjonen — aldri tall som kan endre regnskapet.

-- Kontrollpolicy per virksomhet: hva som regnes som en «vesentlig betaling» og
-- hvor mange godkjennere den krever, samt hva som er normal arbeidstid (for
-- flagging av betalinger på uvanlige tidspunkt). Alle med trygge standardverdier.
CREATE TABLE fraud_control_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  significant_threshold_minor BIGINT NOT NULL DEFAULT 5000000, -- 50 000 kr
  required_approvers INT NOT NULL DEFAULT 2 CHECK (required_approvers >= 1),
  business_hours_start INT NOT NULL DEFAULT 6 CHECK (business_hours_start BETWEEN 0 AND 23),
  business_hours_end INT NOT NULL DEFAULT 21 CHECK (business_hours_end BETWEEN 1 AND 24),
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Menneskets dom over et enkelt varsel. Fingeravtrykket identifiserer varselet
-- stabilt (samme funn → samme fingeravtrykk), så «falsk alarm» demper det og
-- «bekreftet svindel» både løfter det og mater mønster-minnet nedenfor.
CREATE TABLE fraud_reviews (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  signal_code TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('confirmed_fraud','false_alarm','resolved')),
  note TEXT,
  reviewed_by UUID NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, fingerprint)
);

-- Mønster-minne: kjennetegn ved BEKREFTEDE svindelforsøk (kontonummer, org.nr,
-- leverandørnavn) slik at nye fakturaer som ligner tidligere forsøk kan flagges.
CREATE TABLE fraud_patterns (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('bank_account','vendor_org','vendor_name')),
  value TEXT NOT NULL,
  note TEXT,
  source_document_id UUID REFERENCES source_documents(id),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, pattern_type, value)
);
CREATE INDEX fraud_patterns_lookup_idx ON fraud_patterns (organization_id, pattern_type, value);

-- Flergodkjenning av vesentlige betalinger. Én rad per godkjenner per bilag.
-- Append-only; hovedboken er allerede uforanderlig, dette er kontrollsporet.
CREATE TABLE payment_approvals (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  approver_user_id UUID NOT NULL,
  approver_role TEXT,
  note TEXT,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, journal_entry_id, approver_user_id)
);
CREATE INDEX payment_approvals_entry_idx ON payment_approvals (organization_id, journal_entry_id);
