-- Justerer uforanderlighetsvernet for fakturaer: koblingen til bilaget
-- (journal_entry_id) settes lovlig ÉN gang etter utstedelse (NULL -> verdi),
-- siden bokføringen skjer i egen transaksjon etter nummertildelingen.
-- Alt annet innhold er fortsatt låst etter utstedelse.

CREATE OR REPLACE FUNCTION invoices_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF (NEW.id, NEW.organization_id, NEW.customer_id, NEW.invoice_number, NEW.kind,
        NEW.credits_invoice_id, NEW.invoice_date, NEW.due_date, NEW.kid, NEW.currency,
        NEW.net_minor, NEW.vat_minor, NEW.gross_minor, NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.organization_id, OLD.customer_id, OLD.invoice_number, OLD.kind,
        OLD.credits_invoice_id, OLD.invoice_date, OLD.due_date, OLD.kid, OLD.currency,
        OLD.net_minor, OLD.vat_minor, OLD.gross_minor, OLD.created_by, OLD.created_at) THEN
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
