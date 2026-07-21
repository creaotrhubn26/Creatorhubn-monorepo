-- Fakturainnholdskrav (bokføringsforskriften kap. 5):
--  - selgers og kjøpers adresse på salgsdokumentet
--  - leveringstidspunkt/-sted per faktura
--  - resultat av oppslag mot MVA-registeret (Enhetsregisteret/Brreg) på selger

ALTER TABLE organizations
  ADD COLUMN street_address TEXT,
  ADD COLUMN postal_code TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN country TEXT NOT NULL DEFAULT 'NO',
  -- Siste oppslag mot MVA-registeret (åpne data fra Brønnøysundregistrene).
  ADD COLUMN vat_register_checked_at TIMESTAMPTZ,
  ADD COLUMN vat_register_registered BOOLEAN;

ALTER TABLE customers
  ADD COLUMN street_address TEXT,
  ADD COLUMN postal_code TEXT,
  ADD COLUMN city TEXT;

ALTER TABLE invoices
  ADD COLUMN delivery_date DATE,
  ADD COLUMN delivery_place TEXT;

-- Leveringsfeltene er del av salgsdokumentet og låses ved utstedelse,
-- på lik linje med resten av fakturainnholdet. Beholder 0004-unntaket:
-- journal_entry_id kan settes lovlig ÉN gang (NULL -> verdi) etter utstedelse.
CREATE OR REPLACE FUNCTION invoices_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF (NEW.id, NEW.organization_id, NEW.customer_id, NEW.invoice_number, NEW.kind,
        NEW.credits_invoice_id, NEW.invoice_date, NEW.due_date, NEW.kid, NEW.currency,
        NEW.net_minor, NEW.vat_minor, NEW.gross_minor, NEW.created_by, NEW.created_at,
        NEW.delivery_date, NEW.delivery_place)
       IS DISTINCT FROM
       (OLD.id, OLD.organization_id, OLD.customer_id, OLD.invoice_number, OLD.kind,
        OLD.credits_invoice_id, OLD.invoice_date, OLD.due_date, OLD.kid, OLD.currency,
        OLD.net_minor, OLD.vat_minor, OLD.gross_minor, OLD.created_by, OLD.created_at,
        OLD.delivery_date, OLD.delivery_place) THEN
      RAISE EXCEPTION 'Utstedte fakturaer kan ikke endres. Bruk kreditnota.';
    END IF;
    IF NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id
       AND OLD.journal_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bilagskoblingen på en utstedt faktura kan ikke endres.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
