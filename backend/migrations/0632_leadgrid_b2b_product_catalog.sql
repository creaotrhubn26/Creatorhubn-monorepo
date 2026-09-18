-- B2B-produktkatalog og produktlinjer på avtale.
--
-- Hva vi hadde, og hvorfor det ikke holdt:
--   leadgrid_dorsalg_products (mig 0399) — navn, farge og provisjon per
--     vunnet dør. Dørsalg-spesifikk, uten pris, SKU, mva eller
--     prosjekt-scope. Å utvide den ville forvrengt formålet.
--   leadgrid_proposals.lines — fritekstlinjer i JSONB på et TILBUD.
--     Ingen katalog bak, ingen gjenbruk, ingen kobling til avtalen.
--   crm_customers.deal_amount (mig 0349) — ett tall per avtale. Sier hva
--     avtalen er verdt, men ikke hva den består av.
--
-- B2B trenger begge deler: en katalog man selger FRA, og linjer som sier
-- hva den enkelte avtalen inneholder. Feltene følger HubSpots line items
-- der det er fornuftig, slik at en migrering blir tapsfri, men med mva og
-- NOK som standard fordi kundene er norske.

-- ── Katalogen ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL = tilgjengelig i hele organisasjonen. Satt = kun dette prosjektet,
  -- for kunder som holder produktutvalg adskilt per kundeprosjekt.
  project_id        TEXT,

  sku               VARCHAR(64),
  name              TEXT NOT NULL,
  description       TEXT,

  unit_price        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'NOK',
  -- Enheten prisen gjelder for: stk, time, dag, måned, lisens, ...
  unit              VARCHAR(24) NOT NULL DEFAULT 'stk',
  -- Merverdiavgift i prosent. 25 er normalsats i Norge, 0 for
  -- avgiftsfritt/utenfor avgiftsområdet.
  vat_rate          NUMERIC(5, 2) NOT NULL DEFAULT 25.00
    CHECK (vat_rate >= 0 AND vat_rate <= 100),

  -- Abonnement og rammeavtaler er kjernen i B2B. one_time = engangssalg.
  billing_frequency VARCHAR(20) NOT NULL DEFAULT 'one_time'
    CHECK (billing_frequency IN (
      'one_time','weekly','biweekly','monthly','quarterly',
      'per_six_months','annually','per_two_years','per_three_years'
    )),

  active            BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,

  -- Migrering: HubSpots product-id, så en ny kjøring gjenkjenner det samme
  -- produktet i stedet for å lage duplikater.
  hubspot_product_id TEXT,

  created_by_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SKU er kundens egen produktkode og må være unik der den er satt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_products_sku
  ON leadgrid_products (organization_id, sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_products_hubspot
  ON leadgrid_products (organization_id, hubspot_product_id)
  WHERE hubspot_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_products_pick
  ON leadgrid_products (organization_id, project_id, sort_order)
  WHERE active;

-- ── Linjene på avtalen ───────────────────────────────────────────────────
-- Avtalen bor på crm_customers (mig 0349), så linjene henger der.
CREATE TABLE IF NOT EXISTS leadgrid_deal_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id        TEXT NOT NULL,
  customer_id       UUID NOT NULL,

  -- NULL = fritekstlinje uten katalogprodukt. HubSpot tillater det samme,
  -- og uten det ville en migrering måtte finne opp katalogprodukter.
  product_id        UUID REFERENCES leadgrid_products(id) ON DELETE SET NULL,

  -- Snapshot. Endrer noen prisen i katalogen, skal ikke gamle avtaler
  -- endre verdi. Dette er den klassiske fellen med produktlinjer.
  name              TEXT NOT NULL,
  description       TEXT,
  unit_price        NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'NOK',
  unit              VARCHAR(24) NOT NULL DEFAULT 'stk',
  vat_rate          NUMERIC(5, 2) NOT NULL DEFAULT 25.00
    CHECK (vat_rate >= 0 AND vat_rate <= 100),

  quantity          NUMERIC(14, 3) NOT NULL DEFAULT 1
    CHECK (quantity >= 0),
  discount_percent  NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount   NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0),

  -- Gjentakende fakturering. term_months NULL på en gjentakende linje =
  -- løper til den sies opp, samme som HubSpot.
  billing_frequency VARCHAR(20) NOT NULL DEFAULT 'one_time'
    CHECK (billing_frequency IN (
      'one_time','weekly','biweekly','monthly','quarterly',
      'per_six_months','annually','per_two_years','per_three_years'
    )),
  term_months       INTEGER CHECK (term_months IS NULL OR term_months > 0),
  recurring_start_date DATE,

  -- Beregnet i databasen, så ingen kan lagre en sum som ikke stemmer med
  -- linjen. Eks. mva; mva ligger i vat_rate for den som skal fakturere.
  net_total         NUMERIC(14, 2) GENERATED ALWAYS AS (
    ROUND(
      GREATEST(quantity * unit_price * (1 - discount_percent / 100) - discount_amount, 0),
      2
    )
  ) STORED,

  hubspot_line_item_id TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT leadgrid_deal_line_items_customer_fk
    FOREIGN KEY (customer_id, organization_id, project_id)
    REFERENCES crm_customers (id, organization_id, project_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_deal_line_items_customer
  ON leadgrid_deal_line_items (customer_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_deal_line_items_hubspot
  ON leadgrid_deal_line_items (organization_id, hubspot_line_item_id)
  WHERE hubspot_line_item_id IS NOT NULL;
