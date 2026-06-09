-- 240_poweroffice_customer_type_and_product.sql
--
-- Forberedelse for korrekt PowerOffice Go v2-integrasjon. Migrasjonen
-- gir oss to ting som PO sin OutgoingInvoice/SalesOrder-flow krever:
--
-- 1. customer_type på clients: skiller person (FirstName+LastName) fra
--    company (Name + OrganizationNumber). PO sin CustomerPostDto har
--    forskjellige required fields per type.
-- 2. default_product_id på photographer_integrations: alle SalesOrder-
--    linjer i PO Go v2 må referere et Product (som bærer konto +
--    MVA-info). Vi auto-oppretter ett "Creatorhubn fotograf-tjeneste"-
--    produkt per tenant ved første faktura og cacher dets PO-id her.
--
-- Idempotent. Trygg å kjøre flere ganger.

-- =====================================================
-- DEL 1 — customer_type + organization_number på clients
-- =====================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS customer_type VARCHAR(16) DEFAULT 'person';

-- Sjekkstilskudd for valgt verdi. CHECK legges til separat for å være
-- idempotent (eksisterende rader får default 'person' fra ADD COLUMN).
DO $$ BEGIN
  ALTER TABLE clients ADD CONSTRAINT clients_customer_type_chk
    CHECK (customer_type IN ('person', 'company'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS organization_number VARCHAR(32);

COMMENT ON COLUMN clients.customer_type IS
  'person | company. Bestemmer hvordan klienten registreres i PowerOffice Go (CustomerPostDto.IsPerson) og om FirstName+LastName eller Name+OrganizationNumber sendes.';
COMMENT ON COLUMN clients.organization_number IS
  'Bare relevant når customer_type = company. Sendes som OrganizationNumber til PowerOffice.';

-- =====================================================
-- DEL 2 — default_product_id på photographer_integrations
-- =====================================================
-- Per-tenant cache av et "Creatorhubn fotograf-tjeneste"-produkt vi
-- auto-oppretter i kundens PO-tenant. PO Go v2 krever Product-referanse
-- på SalesOrderLine.

ALTER TABLE photographer_integrations
  ADD COLUMN IF NOT EXISTS default_product_id BIGINT;

ALTER TABLE photographer_integrations
  ADD COLUMN IF NOT EXISTS default_product_synced_at TIMESTAMPTZ;

COMMENT ON COLUMN photographer_integrations.default_product_id IS
  'PowerOffice Product.Id (int64) for "Creatorhubn fotograf-tjeneste" auto-opprettet i tenantet. Brukes som ProductId på alle SalesOrder-linjer.';
