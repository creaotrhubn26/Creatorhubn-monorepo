-- Tetter hull i uforanderlighetsvernet for journal_entries:
-- den opprinnelige guarden sammenlignet ikke reversal_of, source_document_id
-- og posted_by_role, så direkte SQL kunne endre dem på en bokført postering.
-- Nå er ENESTE tillatte endring statusovergangen posted -> reversed.

CREATE OR REPLACE FUNCTION journal_entries_guard() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.organization_id, NEW.entry_number, NEW.entry_date, NEW.period_id,
      NEW.description, NEW.idempotency_key, NEW.reversal_of, NEW.source_document_id,
      NEW.posted_by, NEW.posted_by_role, NEW.posted_at)
     IS DISTINCT FROM
     (OLD.id, OLD.organization_id, OLD.entry_number, OLD.entry_date, OLD.period_id,
      OLD.description, OLD.idempotency_key, OLD.reversal_of, OLD.source_document_id,
      OLD.posted_by, OLD.posted_by_role, OLD.posted_at) THEN
    RAISE EXCEPTION 'Bokførte posteringer kan ikke endres. Bruk reversering.';
  END IF;
  IF OLD.status = 'reversed' THEN
    RAISE EXCEPTION 'Posteringen er allerede reversert.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'posted' AND NEW.status = 'reversed') THEN
    RAISE EXCEPTION 'Eneste tillatte statusendring er posted -> reversed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
