-- Automatisk bank-tilkobling (PSD2): mellomlager for et påbegynt org-nivå samtykke
-- FØR bankkontoene finnes. Etter bank-redirect lagres `code` her, og finalize-steget
-- fullfører samtykket, oppdager kontoene (IBAN + navn) og oppretter dem automatisk.
-- Append-only; rører ingen eksisterende tabeller.
CREATE TABLE IF NOT EXISTS bank_feed_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requisition_id TEXT,
  institution_id TEXT NOT NULL,
  pending_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_feed_pending_org ON bank_feed_pending (organization_id);
