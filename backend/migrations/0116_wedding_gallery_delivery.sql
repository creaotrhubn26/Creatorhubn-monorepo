-- 0116_wedding_gallery_delivery.sql
-- Galleri-leverings-tracking (Slice 9X.42). Bryllup-kontrakter har typisk
-- "leveres innen 4-6 uker" — vi lagrer absolute deadline + leverings-
-- status. Auto-purring sendes når Stine nærmer seg frist uten å ha
-- markert som levert.

CREATE TABLE IF NOT EXISTS wedding_gallery_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  photographer_id TEXT NOT NULL,
  gallery_id TEXT,
  -- FK til client_galleries hvis Stine har koblet en
  deadline_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'proof_sent', 'awaiting_selection', 'delivered', 'overdue')),
  proof_sent_at TIMESTAMPTZ,
  selection_completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_gallery_delivery_unique
  ON wedding_gallery_deliveries (wedding_id, photographer_id);
CREATE INDEX IF NOT EXISTS idx_wedding_gallery_delivery_deadline
  ON wedding_gallery_deliveries (deadline_at, status)
  WHERE status NOT IN ('delivered');

COMMENT ON COLUMN wedding_gallery_deliveries.status IS
  'pending → proof_sent → awaiting_selection → delivered. overdue settes av runner når deadline_at < NOW() og status != delivered.';
