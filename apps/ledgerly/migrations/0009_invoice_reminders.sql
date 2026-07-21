-- 0009_invoice_reminders.sql
--
-- Betalingspåminnelser (purring) på UTSTEDTE, forfalte fakturaer Ledgerly selv
-- sender (ikke Stripe-abonnement — der duner Stripe selv). Logg per sendt
-- påminnelse, både for sporbarhet og for å unngå å mase (min. intervall mellom
-- purringer styres av tjenesten).

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id               UUID PRIMARY KEY,
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  invoice_id       UUID NOT NULL REFERENCES invoices(id),
  channel          TEXT NOT NULL DEFAULT 'email',
  recipient        TEXT,
  status           TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  detail           TEXT,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice
  ON invoice_reminders (invoice_id, sent_at DESC);
