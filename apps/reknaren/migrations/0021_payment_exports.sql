-- 0021_payment_exports.sql
--
-- Utbetalingsfil (ISO 20022 pain.001): sporer hvilke leverandørfakturaer som er
-- tatt med i en betalingsfil, så de faller ut av «til betaling»-lista og ikke
-- betales to ganger. Selve betalingen skjer i nettbanken (vi lager kun fila).

CREATE TABLE payment_exports (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  document_id UUID NOT NULL REFERENCES source_documents(id),
  amount_minor BIGINT NOT NULL,
  creditor_account TEXT,
  message_ref TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_by UUID NOT NULL,
  UNIQUE (organization_id, document_id)
);

CREATE INDEX payment_exports_org_idx ON payment_exports (organization_id);
