-- 0357_software_expenses.sql
-- Programvare- og abonnement-kostnader per bruker. Kilder: manuell registrering
-- ELLER auto-uttrekk fra Gmail-kvitteringer (status='forslag' → bruker godkjenner
-- → 'bekreftet'). Idempotent re-skann via unik (user_id, source_email_id).

CREATE TABLE IF NOT EXISTS software_expenses (
  id               SERIAL PRIMARY KEY,
  user_id          VARCHAR NOT NULL,
  vendor           VARCHAR,
  product          VARCHAR,
  category         VARCHAR,
  amount_nok       NUMERIC(12,2),
  amount_original  NUMERIC(12,2),
  currency         VARCHAR(8),
  billing_cycle    VARCHAR(16),               -- 'engang' | 'monthly' | 'yearly' | 'unknown'
  is_subscription  BOOLEAN DEFAULT false,
  purchase_date    DATE,
  renewal_date     DATE,
  source           VARCHAR(16) NOT NULL DEFAULT 'manual',  -- 'manual' | 'email'
  source_email_id  VARCHAR,                   -- Gmail Message-ID header (dedup-nøkkel)
  confidence       VARCHAR(8),                -- 'low' | 'medium' | 'high'
  status           VARCHAR(16) NOT NULL DEFAULT 'bekreftet', -- 'forslag' | 'bekreftet' | 'avvist'
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS software_expenses_user_idx ON software_expenses (user_id);
CREATE INDEX IF NOT EXISTS software_expenses_user_status_idx ON software_expenses (user_id, status);

-- Dedup: samme e-post-kvittering skal aldri gi to rader for samme bruker.
CREATE UNIQUE INDEX IF NOT EXISTS software_expenses_user_email_uidx
  ON software_expenses (user_id, source_email_id)
  WHERE source_email_id IS NOT NULL;
