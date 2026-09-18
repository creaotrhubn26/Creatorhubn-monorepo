-- Livssyklus-akse på crm_customers.
--
-- Vi hadde to statusakser fra før, og begge beskriver SALGSPROSESSEN:
--   lead_status    (mig 271) — feltsalg: unvisited, visited, interested,
--                  meeting_booked, proposal_sent, won, lost, do_not_contact
--   pipeline_stage (mig 313) — salgsfase: new -> qualified -> ... -> won/lost
--
-- Begge stopper på won/lost. Det som manglet er RELASJONEN: er dette en
-- abonnent som bare leser nyhetsbrevet, en kvalifisert lead, en betalende
-- kunde, eller en som anbefaler oss videre? Den aksen fortsetter etter
-- salget og starter før første kontakt, og den er det kunder rapporterer på.
--
-- Verdisettet følger HubSpots livssyklus bevisst (snake_case hos oss).
-- Det er en de-facto standard selgere kjenner, og det gjør en migrering fra
-- HubSpot tapsfri. Se docs/evidence/2026-09-hubspot-migration-import.yaml.

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30) NOT NULL DEFAULT 'lead'
    CHECK (lifecycle_stage IN (
      'subscriber',
      'lead',
      'marketing_qualified',
      'sales_qualified',
      'opportunity',
      'customer',
      'evangelist',
      'other'
    )),
  ADD COLUMN IF NOT EXISTS lifecycle_stage_changed_at TIMESTAMPTZ;

-- Backfill: en vunnet avtale ER en kunde. Uten dette ville alle eksisterende
-- rader stått som 'lead' selv om de har betalt, og feltet ville vært
-- misvisende fra dag én. Idempotent: rører bare rader som fortsatt har
-- default-verdien.
UPDATE crm_customers
   SET lifecycle_stage = 'customer',
       lifecycle_stage_changed_at = COALESCE(deal_stage_changed_at, updated_at, NOW())
 WHERE lifecycle_stage = 'lead'
   AND (pipeline_stage = 'won' OR lead_status = 'won');

-- Rapportering går på (org, prosjekt, livssyklus) — samme form som de andre
-- Leadgrid-indeksene, og arkiverte rader holdes utenfor.
CREATE INDEX IF NOT EXISTS idx_crm_customers_lifecycle_stage
  ON crm_customers (organization_id, project_id, lifecycle_stage)
  WHERE archived_at IS NULL;
