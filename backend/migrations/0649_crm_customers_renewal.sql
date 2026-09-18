-- Post-salg: fornyelsesdato og automatisk livssyklus-overgang ved vunnet avtale.
--
-- To hull vi hadde etter at en avtale ble vunnet:
--
--   1. lifecycle_stage (mig 0647) ble aldri satt til 'customer'. Den som
--      vinner en avtale rører pipeline_stage eller lead_status, ikke
--      livssyklusen, så feltet forble 'lead' på betalende kunder.
--      Det finnes flere skriveveier (leadgrid-deals-service,
--      leadgrid-intelligence-routes, lead-map-service, workflow-engine),
--      så dette hører hjemme i databasen, ikke i hver enkelt av dem.
--
--   2. Det fantes ingen fornyelsesdato. expected_close_date (mig 0349)
--      handler om NÅR SALGET LUKKES, ikke når kunden skal fornye. Uten en
--      fornyelsesdato er det ingenting å følge opp på etter salget, og
--      abonnementslinjene fra mig 0648 blir bare tall på en avtale.

ALTER TABLE crm_customers
  -- Når avtalen skal fornyes. Utledes fra gjentakende produktlinjer når
  -- avtalen vinnes, men kan settes manuelt (rammeavtale, muntlig avtale).
  ADD COLUMN IF NOT EXISTS renewal_date DATE,
  -- Siste gang vi varslet om denne fornyelsen. Hindrer at den daglige
  -- cronen sender samme varsel hver dag i varslingsvinduet.
  ADD COLUMN IF NOT EXISTS renewal_reminded_at TIMESTAMPTZ;

-- Cronen spør på «fornyelse innen X dager, ikke varslet»; arkiverte holdes
-- utenfor på samme måte som de andre Leadgrid-indeksene.
CREATE INDEX IF NOT EXISTS idx_crm_customers_renewal_due
  ON crm_customers (renewal_date)
  WHERE archived_at IS NULL AND renewal_date IS NOT NULL;

-- ── Vunnet avtale → kunde ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION crm_customers_apply_won()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  derived DATE;
BEGIN
  -- Bare ved selve overgangen til 'won'. Var raden allerede vunnet, skal et
  -- senere navnebytte hverken flytte livssyklusen eller nullstille noe.
  IF (NEW.pipeline_stage = 'won' AND COALESCE(OLD.pipeline_stage, '') <> 'won')
     OR (NEW.lead_status = 'won' AND COALESCE(OLD.lead_status, '') <> 'won')
  THEN
    -- 'evangelist' er et steg FORBI kunde. Den skal ikke degraderes.
    IF NEW.lifecycle_stage IS DISTINCT FROM 'customer'
       AND NEW.lifecycle_stage IS DISTINCT FROM 'evangelist'
    THEN
      NEW.lifecycle_stage := 'customer';
      NEW.lifecycle_stage_changed_at := NOW();
    END IF;

    -- Fornyelsesdato fra den gjentakende linjen som løper lengst. Linjer
    -- uten term_months løper til oppsigelse og har ingen fornyelsesdato.
    -- Er datoen satt manuelt fra før, rører vi den ikke.
    IF NEW.renewal_date IS NULL THEN
      SELECT MAX(
               COALESCE(li.recurring_start_date, CURRENT_DATE)
               + (li.term_months * INTERVAL '1 month')
             )::date
        INTO derived
        FROM leadgrid_deal_line_items li
       WHERE li.customer_id = NEW.id
         AND li.billing_frequency <> 'one_time'
         AND li.term_months IS NOT NULL;
      NEW.renewal_date := derived;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_customers_apply_won ON crm_customers;
CREATE TRIGGER trg_crm_customers_apply_won
  BEFORE UPDATE ON crm_customers
  FOR EACH ROW
  WHEN (NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage
        OR NEW.lead_status IS DISTINCT FROM OLD.lead_status)
  EXECUTE FUNCTION crm_customers_apply_won();
