-- Bedriften er den varige relasjonen. Hvert mulige kjøp er sin egen salgsprosess.
--
-- Slik var det før denne migrasjonen:
--   crm_customers-raden VAR både bedriften og salget. Den bærer ÉN
--   pipeline_stage, ÉTT deal_amount, ÉN deal_probability og ÉN
--   expected_close_date (mig 0313 og 0349).
--
-- Konsekvensen: en bedrift som både har kjøpt før, forhandler om én avtale
-- og har et tilbud ute på en annen, må registreres flere ganger. Da er det
-- ikke lenger samme kunde, og historikken splittes.
--
-- Etter denne migrasjonen:
--   crm_customers   = bedriften (den varige relasjonen)
--   leadgrid_deals  = salgene, null eller flere per bedrift
--   leadgrid_customer_contacts = personene, med kontaktinfo
--   hvert salg peker på personen som avgjør NETTOPP det salget
--
-- Overgang uten stopp: én av salgene er markert is_primary, og en trigger
-- speiler crm_customers sine deal-felt ned på den. De 34 backend-filene som
-- leser deal-feltene på crm_customers fortsetter derfor å virke uendret,
-- mens nye flater leser leadgrid_deals. Speilingen går ÉN vei
-- (bedrift → primærsalg), så det finnes aldri to skrivere på samme verdi.

-- ── Kontaktpersoner trenger kontaktinfo ──────────────────────────────────
-- Tabellen kom fra klinikk-gruppering (mig 0564) og hadde bare navn og
-- rolle. En kontaktperson uten e-post eller telefon er en halv kontakt.
ALTER TABLE leadgrid_customer_contacts
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;

-- Én hovedkontakt per bedrift.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_customer_contacts_primary
  ON leadgrid_customer_contacts (organization_id, project_id, customer_id)
  WHERE is_primary;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_customer_contacts_hubspot
  ON leadgrid_customer_contacts (organization_id, hubspot_contact_id)
  WHERE hubspot_contact_id IS NOT NULL;

-- ── Salgene ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  customer_id       UUID NOT NULL,

  -- Det som skiller to samtidige salg fra hverandre for selgeren:
  -- «Månedlig innholdsavtale» mot «Kampanjeproduksjon».
  title             TEXT NOT NULL,
  description       TEXT,

  -- Personen som avgjør NETTOPP dette salget. Markedsansvarlig kan eie den
  -- løpende avtalen mens daglig leder avgjør kampanjen.
  primary_contact_id UUID REFERENCES leadgrid_customer_contacts(id) ON DELETE SET NULL,

  pipeline_stage    VARCHAR(24) NOT NULL DEFAULT 'new'
    CHECK (pipeline_stage IN (
      'new','first_contact','qualified','meeting','proposal','negotiation','won','lost'
    )),
  deal_probability  INTEGER CHECK (deal_probability IS NULL OR deal_probability BETWEEN 0 AND 100),
  deal_probability_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  deal_amount       NUMERIC(12, 2),
  currency          VARCHAR(3) NOT NULL DEFAULT 'NOK',
  expected_close_date DATE,

  -- Post-salg (mig 0649) hører til det enkelte salget, ikke til bedriften.
  renewal_date      DATE,
  renewal_reminded_at TIMESTAMPTZ,

  owner_user_id     VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  stage_changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  won_at            TIMESTAMPTZ,
  lost_at           TIMESTAMPTZ,
  lost_reason       TEXT,

  -- Salget som crm_customers sine deal-felt speiler. Nøyaktig ett per
  -- bedrift så lenge de gamle flatene leser derfra.
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,

  source            VARCHAR(32) NOT NULL DEFAULT 'manual',
  hubspot_deal_id   TEXT,

  archived_at       TIMESTAMPTZ,
  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_deals_customer_fk
    FOREIGN KEY (customer_id, organization_id, project_id)
    REFERENCES crm_customers (id, organization_id, project_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  -- Produktlinjene peker hit med (id, organization_id, project_id).
  CONSTRAINT leadgrid_deals_id_org_project_key
    UNIQUE (id, organization_id, project_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_deals_primary
  ON leadgrid_deals (customer_id)
  WHERE is_primary AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_deals_hubspot
  ON leadgrid_deals (organization_id, hubspot_deal_id)
  WHERE hubspot_deal_id IS NOT NULL;

-- Pipeline-visning og forecast går på (org, prosjekt, fase).
CREATE INDEX IF NOT EXISTS idx_leadgrid_deals_pipeline
  ON leadgrid_deals (organization_id, project_id, pipeline_stage)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_deals_customer
  ON leadgrid_deals (customer_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_deals_renewal_due
  ON leadgrid_deals (renewal_date)
  WHERE archived_at IS NULL AND renewal_date IS NOT NULL;

-- ── Backfill: ett salg per eksisterende bedrift ──────────────────────────
-- Uten dette ville hver eksisterende kunde stått uten salg, og
-- primærspeilingen hadde ingenting å skrive til. Tittelen blir bedriftens
-- navn fordi det er alt vi vet om salget i dag; selgeren kan døpe det om.
-- Idempotent: hopper over bedrifter som allerede har et primærsalg.
INSERT INTO leadgrid_deals (
  organization_id, project_id, customer_id, title,
  pipeline_stage, deal_probability, deal_probability_overridden,
  deal_amount, expected_close_date, renewal_date, renewal_reminded_at,
  owner_user_id, stage_changed_at, is_primary, source, created_at, updated_at
)
SELECT c.organization_id,
       c.project_id,
       c.id,
       COALESCE(NULLIF(TRIM(c.name), ''), 'Salg'),
       COALESCE(c.pipeline_stage, 'new'),
       c.deal_probability,
       COALESCE(c.deal_probability_overridden, FALSE),
       c.deal_amount,
       c.expected_close_date,
       c.renewal_date,
       c.renewal_reminded_at,
       -- Produksjon har crm_customers-rader som peker på brukere som ikke
       -- finnes i users lenger. crm_customers.owner_user_id har ingen
       -- fremmednøkkel og tåler det; leadgrid_deals.owner_user_id har en og
       -- gjør ikke. Å importere en peker som ikke fører noe sted er verre
       -- enn å la feltet stå tomt — eieren er uansett borte.
       CASE WHEN EXISTS (SELECT 1 FROM users u WHERE u.id = c.owner_user_id)
            THEN c.owner_user_id END,
       COALESCE(c.deal_stage_changed_at, c.updated_at, NOW()),
       TRUE,
       'backfill',
       COALESCE(c.created_at, NOW()),
       NOW()
  FROM crm_customers c
 WHERE c.organization_id IS NOT NULL
   AND c.project_id IS NOT NULL
   AND c.archived_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM leadgrid_deals d
      WHERE d.customer_id = c.id AND d.is_primary AND d.archived_at IS NULL
   );

-- ── Speiling: bedrift → primærsalg ───────────────────────────────────────
-- Går bare én vei. De gamle flatene skriver fortsatt på crm_customers, og
-- primærsalget følger etter. Et sekundært salg redigeres gjennom sine egne
-- endepunkter og rører aldri bedriftsraden.
CREATE OR REPLACE FUNCTION leadgrid_deals_mirror_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE leadgrid_deals d
     SET pipeline_stage = COALESCE(NEW.pipeline_stage, d.pipeline_stage),
         deal_probability = NEW.deal_probability,
         deal_probability_overridden = COALESCE(NEW.deal_probability_overridden, FALSE),
         deal_amount = NEW.deal_amount,
         expected_close_date = NEW.expected_close_date,
         renewal_date = NEW.renewal_date,
         renewal_reminded_at = NEW.renewal_reminded_at,
         owner_user_id = (SELECT u.id FROM users u WHERE u.id = NEW.owner_user_id),
         stage_changed_at = CASE
           WHEN NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN NOW()
           ELSE d.stage_changed_at
         END,
         won_at = CASE
           WHEN NEW.pipeline_stage = 'won' AND COALESCE(OLD.pipeline_stage, '') <> 'won'
             THEN NOW() ELSE d.won_at
         END,
         lost_at = CASE
           WHEN NEW.pipeline_stage = 'lost' AND COALESCE(OLD.pipeline_stage, '') <> 'lost'
             THEN NOW() ELSE d.lost_at
         END,
         updated_at = NOW()
   WHERE d.customer_id = NEW.id
     AND d.is_primary
     AND d.archived_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_deals_mirror_primary ON crm_customers;
CREATE TRIGGER trg_leadgrid_deals_mirror_primary
  AFTER UPDATE ON crm_customers
  FOR EACH ROW
  WHEN (NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage
        OR NEW.deal_probability IS DISTINCT FROM OLD.deal_probability
        OR NEW.deal_amount IS DISTINCT FROM OLD.deal_amount
        OR NEW.expected_close_date IS DISTINCT FROM OLD.expected_close_date
        OR NEW.renewal_date IS DISTINCT FROM OLD.renewal_date
        OR NEW.renewal_reminded_at IS DISTINCT FROM OLD.renewal_reminded_at
        OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id)
  EXECUTE FUNCTION leadgrid_deals_mirror_primary();

-- Ny bedrift får sitt primærsalg med én gang, ellers har speilingen
-- ingenting å skrive til før noen redigerer avtalen.
CREATE OR REPLACE FUNCTION leadgrid_deals_create_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO leadgrid_deals (
    organization_id, project_id, customer_id, title,
    pipeline_stage, deal_probability, deal_amount, expected_close_date,
    owner_user_id, is_primary, source
  )
  VALUES (
    NEW.organization_id, NEW.project_id, NEW.id,
    COALESCE(NULLIF(TRIM(NEW.name), ''), 'Salg'),
    COALESCE(NEW.pipeline_stage, 'new'),
    NEW.deal_probability, NEW.deal_amount, NEW.expected_close_date,
    -- Samme vern som i backfill-en: en ny bedrift med en eier som ikke
    -- finnes, skal opprette salget sitt uten eier, ikke feile.
    (SELECT u.id FROM users u WHERE u.id = NEW.owner_user_id),
    TRUE, 'auto'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_deals_create_primary ON crm_customers;
CREATE TRIGGER trg_leadgrid_deals_create_primary
  AFTER INSERT ON crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION leadgrid_deals_create_primary();

-- ── Produktlinjene hører til salget, ikke til bedriften ──────────────────
-- Mig 0633 hang linjene på crm_customers fordi avtalen bodde der. Nå som
-- salget er sin egen rad, må linjene følge salget: to samtidige salg på
-- samme bedrift har hver sine linjer.
ALTER TABLE leadgrid_deal_line_items
  ADD COLUMN IF NOT EXISTS deal_id UUID;

UPDATE leadgrid_deal_line_items li
   SET deal_id = d.id
  FROM leadgrid_deals d
 WHERE li.deal_id IS NULL
   AND d.customer_id = li.customer_id
   AND d.is_primary
   AND d.archived_at IS NULL;

-- Linjer uten salg kan ikke finnes; bedriften har alltid et primærsalg.
DELETE FROM leadgrid_deal_line_items WHERE deal_id IS NULL;

ALTER TABLE leadgrid_deal_line_items
  ALTER COLUMN deal_id SET NOT NULL;

ALTER TABLE leadgrid_deal_line_items
  DROP CONSTRAINT IF EXISTS leadgrid_deal_line_items_customer_fk;

ALTER TABLE leadgrid_deal_line_items
  DROP COLUMN IF EXISTS customer_id;

ALTER TABLE leadgrid_deal_line_items
  ADD CONSTRAINT leadgrid_deal_line_items_deal_fk
    FOREIGN KEY (deal_id, organization_id, project_id)
    REFERENCES leadgrid_deals (id, organization_id, project_id)
    ON UPDATE CASCADE ON DELETE CASCADE;

DROP INDEX IF EXISTS idx_leadgrid_deal_line_items_customer;
CREATE INDEX IF NOT EXISTS idx_leadgrid_deal_line_items_deal
  ON leadgrid_deal_line_items (deal_id, sort_order);

-- Fornyelsestriggeren fra mig 0649 leste linjene via customer_id. Den
-- kolonnen finnes ikke lenger, så funksjonen må gå veien om primærsalget.
CREATE OR REPLACE FUNCTION crm_customers_apply_won()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  derived DATE;
BEGIN
  IF (NEW.pipeline_stage = 'won' AND COALESCE(OLD.pipeline_stage, '') <> 'won')
     OR (NEW.lead_status = 'won' AND COALESCE(OLD.lead_status, '') <> 'won')
  THEN
    IF NEW.lifecycle_stage IS DISTINCT FROM 'customer'
       AND NEW.lifecycle_stage IS DISTINCT FROM 'evangelist'
    THEN
      NEW.lifecycle_stage := 'customer';
      NEW.lifecycle_stage_changed_at := NOW();
    END IF;

    IF NEW.renewal_date IS NULL THEN
      SELECT MAX(
               COALESCE(li.recurring_start_date, CURRENT_DATE)
               + (li.term_months * INTERVAL '1 month')
             )::date
        INTO derived
        FROM leadgrid_deal_line_items li
        JOIN leadgrid_deals d ON d.id = li.deal_id
       WHERE d.customer_id = NEW.id
         AND d.is_primary
         AND d.archived_at IS NULL
         AND li.billing_frequency <> 'one_time'
         AND li.term_months IS NOT NULL;
      NEW.renewal_date := derived;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
