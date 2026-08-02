-- Migration 0407: Leadgrid manuell faktura
--
-- For organisasjoner UTEN Stripe-kobling: super-admin sender en manuell
-- faktura (HTML-e-post + PDF-nedlasting). Erstatter den døde «Send manuell
-- faktura»-knappen i super-admin org-detaljen.

CREATE TABLE IF NOT EXISTS leadgrid_manual_invoices (
    id               SERIAL PRIMARY KEY,
    organization_id  VARCHAR(255),
    org_label        VARCHAR(255),
    invoice_number   VARCHAR(64),
    recipient_email  VARCHAR(255) NOT NULL,
    amount_nok       NUMERIC(12,2) NOT NULL DEFAULT 0,
    description      TEXT,
    status           VARCHAR(16) NOT NULL DEFAULT 'sent'
                       CHECK (status IN ('sent','draft','failed')),
    sent_at          TIMESTAMPTZ,
    created_by       VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leadgrid_manual_invoices_org_idx
    ON leadgrid_manual_invoices (organization_id, created_at DESC);
