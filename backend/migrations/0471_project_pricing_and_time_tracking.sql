-- Project-scoped pricing model for Workspace agreements.
-- `hourly_rate` is the customer rate. `internal_cost_rate` is deliberately
-- separate and is used only for margin/cost calculations.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pricing_model VARCHAR(20) NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS internal_cost_rate NUMERIC(10, 2) NOT NULL DEFAULT 0;

UPDATE projects
   SET pricing_model = 'fixed'
 WHERE pricing_model IS NULL
    OR pricing_model NOT IN ('fixed', 'hourly', 'hybrid');

UPDATE projects
   SET internal_cost_rate = 0
 WHERE internal_cost_rate IS NULL;

ALTER TABLE projects
  ALTER COLUMN pricing_model SET DEFAULT 'fixed',
  ALTER COLUMN pricing_model SET NOT NULL,
  ALTER COLUMN internal_cost_rate SET DEFAULT 0,
  ALTER COLUMN internal_cost_rate SET NOT NULL;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2);

ALTER TABLE projects
  ALTER COLUMN estimated_hours TYPE NUMERIC(10, 2)
    USING estimated_hours::NUMERIC(10, 2),
  ALTER COLUMN actual_hours TYPE NUMERIC(10, 2)
    USING actual_hours::NUMERIC(10, 2);

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_pricing_model_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_pricing_model_check
  CHECK (pricing_model IN ('fixed', 'hourly', 'hybrid'));

-- Compatibility economy for Team Workspace projects that still live in
-- legacy.projects. The public projects table remains the canonical store for
-- current projects; this narrow profile avoids destructive legacy migration.
CREATE TABLE IF NOT EXISTS project_pricing_profiles (
  project_id VARCHAR(128) PRIMARY KEY,
  project_namespace VARCHAR(16) NOT NULL DEFAULT 'legacy',
  owner_user_id VARCHAR(128) NOT NULL,
  pricing_model VARCHAR(20) NOT NULL DEFAULT 'fixed',
  service_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  internal_cost_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost_overhead NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_hours NUMERIC(10, 2),
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_pricing_profiles_namespace_check
    CHECK (project_namespace IN ('public', 'legacy')),
  CONSTRAINT project_pricing_profiles_model_check
    CHECK (pricing_model IN ('fixed', 'hourly', 'hybrid')),
  CONSTRAINT project_pricing_profiles_nonnegative_check
    CHECK (
      service_price >= 0 AND hourly_rate >= 0 AND internal_cost_rate >= 0
      AND cost_overhead >= 0 AND (estimated_hours IS NULL OR estimated_hours >= 0)
    )
);

CREATE INDEX IF NOT EXISTS project_pricing_profiles_owner_idx
  ON project_pricing_profiles (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_time_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(128) NOT NULL,
  task_description TEXT NOT NULL,
  hours_spent NUMERIC(10, 2) NOT NULL,
  date_worked DATE NOT NULL DEFAULT CURRENT_DATE,
  timeline_event_id VARCHAR(128),
  billable_hours NUMERIC(10, 2) NOT NULL,
  rate NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_time_tracking
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE project_time_tracking
  ALTER COLUMN project_id TYPE VARCHAR(128)
    USING project_id::text,
  ALTER COLUMN hours_spent TYPE NUMERIC(10, 2)
    USING hours_spent::NUMERIC(10, 2),
  ALTER COLUMN billable_hours TYPE NUMERIC(10, 2)
    USING billable_hours::NUMERIC(10, 2),
  ALTER COLUMN rate TYPE NUMERIC(10, 2)
    USING rate::NUMERIC(10, 2);

ALTER TABLE project_time_tracking
  DROP CONSTRAINT IF EXISTS project_time_tracking_project_id_integrated_projects_id_fk;

CREATE INDEX IF NOT EXISTS project_time_tracking_project_date_idx
  ON project_time_tracking (project_id, date_worked DESC, created_at DESC);

ALTER TABLE pricing_structures
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS travel_included BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS travel_radius_km INTEGER,
  ADD COLUMN IF NOT EXISTS travel_rate_per_km NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS overtime_hourly_rate NUMERIC(10, 2);

UPDATE pricing_structures
   SET travel_included = COALESCE(travel_included, FALSE);

ALTER TABLE pricing_structures
  ALTER COLUMN travel_included SET DEFAULT FALSE,
  ALTER COLUMN travel_included SET NOT NULL;

ALTER TABLE pricing_structures
  DROP CONSTRAINT IF EXISTS pricing_structures_travel_radius_nonnegative,
  DROP CONSTRAINT IF EXISTS pricing_structures_travel_rate_nonnegative,
  DROP CONSTRAINT IF EXISTS pricing_structures_overtime_rate_nonnegative;
ALTER TABLE pricing_structures
  ADD CONSTRAINT pricing_structures_travel_radius_nonnegative
    CHECK (travel_radius_km IS NULL OR travel_radius_km >= 0) NOT VALID,
  ADD CONSTRAINT pricing_structures_travel_rate_nonnegative
    CHECK (travel_rate_per_km IS NULL OR travel_rate_per_km >= 0) NOT VALID,
  ADD CONSTRAINT pricing_structures_overtime_rate_nonnegative
    CHECK (overtime_hourly_rate IS NULL OR overtime_hourly_rate >= 0) NOT VALID;

ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128);

-- Reconcile the legacy price-administration tables with the canonical API
-- contract. The consolidated schema predates the project-scoped UI and only
-- contains name/type JSON fields for costs and a smaller discount model.
ALTER TABLE additional_costs
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS cost_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS is_billable BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receipt_url VARCHAR,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS cost_date DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE additional_costs
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text),
  ALTER COLUMN name SET DEFAULT 'Tilleggskostnad',
  ALTER COLUMN type SET DEFAULT 'fixed',
  ALTER COLUMN cost_structure SET DEFAULT '{}'::jsonb;

UPDATE additional_costs
   SET cost_type = COALESCE(NULLIF(cost_type, ''), NULLIF(type, ''), 'fixed'),
       amount = COALESCE(
         amount,
         CASE
           WHEN cost_structure ->> 'amount' ~ '^-?[0-9]+([.][0-9]+)?$'
             THEN (cost_structure ->> 'amount')::NUMERIC(10, 2)
           ELSE 0
         END
       ),
       currency = COALESCE(NULLIF(currency, ''), NULLIF(cost_structure ->> 'currency', ''), 'NOK'),
       is_billable = COALESCE(is_billable, TRUE),
       is_reimbursable = COALESCE(is_reimbursable, FALSE),
       cost_date = COALESCE(cost_date, created_at::DATE, CURRENT_DATE),
       updated_at = COALESCE(updated_at, created_at, NOW());

ALTER TABLE additional_costs
  ALTER COLUMN cost_type SET DEFAULT 'fixed',
  ALTER COLUMN cost_type SET NOT NULL,
  ALTER COLUMN amount SET DEFAULT 0,
  ALTER COLUMN amount SET NOT NULL,
  ALTER COLUMN currency SET DEFAULT 'NOK',
  ALTER COLUMN currency SET NOT NULL,
  ALTER COLUMN is_billable SET DEFAULT TRUE,
  ALTER COLUMN is_billable SET NOT NULL,
  ALTER COLUMN is_reimbursable SET DEFAULT FALSE,
  ALTER COLUMN is_reimbursable SET NOT NULL,
  ALTER COLUMN cost_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN cost_date SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE additional_costs
  DROP CONSTRAINT IF EXISTS additional_costs_amount_nonnegative;
ALTER TABLE additional_costs
  ADD CONSTRAINT additional_costs_amount_nonnegative
    CHECK (amount >= 0) NOT VALID;

ALTER TABLE discounts
  ADD COLUMN IF NOT EXISTS code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS usage_limit INTEGER,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

ALTER TABLE discounts
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text),
  ALTER COLUMN type SET DEFAULT 'percentage';

UPDATE discounts
   SET code = COALESCE(NULLIF(code, ''), NULLIF(discount_code, '')),
       discount_type = COALESCE(
         NULLIF(discount_type, ''),
         CASE WHEN COALESCE(is_percentage, TRUE) THEN 'percentage' ELSE 'fixed' END
       ),
       min_order_amount = COALESCE(min_order_amount, 0),
       usage_count = COALESCE(usage_count, 0),
       is_active = COALESCE(is_active, TRUE);

ALTER TABLE discounts
  ALTER COLUMN discount_type SET DEFAULT 'percentage',
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN min_order_amount SET DEFAULT 0,
  ALTER COLUMN min_order_amount SET NOT NULL;

ALTER TABLE discounts
  DROP CONSTRAINT IF EXISTS discounts_canonical_type_check,
  DROP CONSTRAINT IF EXISTS discounts_canonical_value_nonnegative,
  DROP CONSTRAINT IF EXISTS discounts_percentage_max,
  DROP CONSTRAINT IF EXISTS discounts_min_order_nonnegative,
  DROP CONSTRAINT IF EXISTS discounts_usage_limit_positive;
ALTER TABLE discounts
  ADD CONSTRAINT discounts_canonical_type_check
    CHECK (discount_type IN ('percentage', 'fixed')) NOT VALID,
  ADD CONSTRAINT discounts_canonical_value_nonnegative
    CHECK (discount_value >= 0) NOT VALID,
  ADD CONSTRAINT discounts_percentage_max
    CHECK (discount_type <> 'percentage' OR discount_value <= 100) NOT VALID,
  ADD CONSTRAINT discounts_min_order_nonnegative
    CHECK (min_order_amount >= 0) NOT VALID,
  ADD CONSTRAINT discounts_usage_limit_positive
    CHECK (usage_limit IS NULL OR usage_limit > 0) NOT VALID;

-- The historical schema contains `travel_log`; Price Administration has long
-- used a richer `travel_logs` API shape. Persist that shape explicitly and
-- import each legacy row once, instead of relying on an undeclared table.
CREATE TABLE IF NOT EXISTS travel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_travel_log_id BIGINT,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(128),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  contact VARCHAR(255),
  vehicle VARCHAR(255),
  vehicle_registration VARCHAR(64),
  from_address TEXT NOT NULL DEFAULT '',
  to_address TEXT NOT NULL DEFAULT '',
  extra_destinations JSONB NOT NULL DEFAULT '[]'::jsonb,
  return_trip BOOLEAN NOT NULL DEFAULT FALSE,
  kilometers NUMERIC(10, 2) NOT NULL DEFAULT 0,
  toll_fees NUMERIC(10, 2) NOT NULL DEFAULT 0,
  additional_fees NUMERIC(10, 2) NOT NULL DEFAULT 0,
  additional_fees_description TEXT,
  calculated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selected_vehicle_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE travel_logs
  ADD COLUMN IF NOT EXISTS legacy_travel_log_id BIGINT,
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vehicle VARCHAR(255),
  ADD COLUMN IF NOT EXISTS vehicle_registration VARCHAR(64),
  ADD COLUMN IF NOT EXISTS from_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS to_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS extra_destinations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS return_trip BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kilometers NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toll_fees NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fees NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_fees_description TEXT,
  ADD COLUMN IF NOT EXISTS calculated_cost NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_vehicle_data JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS travel_logs_legacy_id_unique_idx
  ON travel_logs (legacy_travel_log_id)
  WHERE legacy_travel_log_id IS NOT NULL;

INSERT INTO travel_logs (
  legacy_travel_log_id, user_id, project_id, date, description, vehicle,
  from_address, to_address, kilometers, toll_fees, additional_fees,
  additional_fees_description, calculated_cost, selected_vehicle_data,
  created_at, updated_at
)
SELECT tl.id,
       tl.user_id,
       tl.project_id,
       tl.date,
       COALESCE(tl.purpose, ''),
       tl.vehicle,
       tl.from_location,
       tl.to_location,
       COALESCE(tl.distance, 0),
       COALESCE(tl.toll_cost, 0),
       COALESCE(tl.fuel_cost, 0) + COALESCE(tl.parking_cost, 0) + COALESCE(tl.other_costs, 0),
       tl.notes,
       COALESCE(tl.total_cost, 0),
       jsonb_build_object(
         'vehicleType', tl.vehicle_type,
         'ratePerKm', tl.rate_per_km,
         'isDeductible', tl.is_deductible
       ),
       COALESCE(tl.created_at, NOW()),
       COALESCE(tl.updated_at, tl.created_at, NOW())
  FROM travel_log tl
ON CONFLICT (legacy_travel_log_id) WHERE legacy_travel_log_id IS NOT NULL DO NOTHING;

CREATE INDEX IF NOT EXISTS additional_costs_user_project_idx
  ON additional_costs (user_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS additional_costs_project_idx
  ON additional_costs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS discounts_creator_project_idx
  ON discounts (created_by, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS travel_logs_user_date_idx
  ON travel_logs (user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS travel_logs_project_date_idx
  ON travel_logs (project_id, date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS pricing_structures_project_idx
  ON pricing_structures (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS discounts_project_idx
  ON discounts (project_id, created_at DESC);


-- Project-scoped Price Administration data is shared by the project owner and team.
ALTER TABLE pricing_categories
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE pricing_services ADD COLUMN IF NOT EXISTS project_id VARCHAR(128);
ALTER TABLE pricing_packages ADD COLUMN IF NOT EXISTS project_id VARCHAR(128);
ALTER TABLE customer_pricing
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS service_item_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50) DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) DEFAULT 0;

-- Older production databases created service_item_id as INTEGER. The
-- canonical pricing APIs also accept package/service identifiers that are
-- strings, so normalize the legacy column before coalescing it with item_id.
ALTER TABLE customer_pricing
  ALTER COLUMN service_item_id TYPE VARCHAR(255)
    USING service_item_id::text;

-- Keep the legacy pricing contract readable while making the canonical columns
-- used by pricing-routes available on both upgraded and fresh databases.
UPDATE pricing_categories
   SET name = COALESCE(NULLIF(name, ''), NULLIF(category_name, ''), 'Kategori'),
       category_name = COALESCE(NULLIF(category_name, ''), NULLIF(name, ''), 'Kategori'),
       color = COALESCE(NULLIF(color, ''), '#3B82F6'),
       sort_order = COALESCE(sort_order, 0);

ALTER TABLE pricing_categories
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN color SET DEFAULT '#3B82F6',
  ALTER COLUMN sort_order SET DEFAULT 0;

UPDATE customer_pricing
   SET customer_id = COALESCE(customer_id, client_id),
       service_item_id = COALESCE(service_item_id, item_id),
       pricing_type = COALESCE(NULLIF(pricing_type, ''), 'service'),
       custom_price = COALESCE(custom_price, fixed_price, 0),
       discount_type = CASE
         WHEN discount_percentage IS NOT NULL THEN 'percentage'
         ELSE COALESCE(NULLIF(discount_type, ''), 'fixed')
       END,
       discount_value = CASE
         WHEN discount_percentage IS NOT NULL THEN discount_percentage
         ELSE COALESCE(discount_value, 0)
       END;

ALTER TABLE customer_pricing
  ALTER COLUMN custom_price SET DEFAULT 0,
  ALTER COLUMN custom_price SET NOT NULL,
  ALTER COLUMN pricing_type SET DEFAULT 'service',
  ALTER COLUMN pricing_type SET NOT NULL,
  ALTER COLUMN discount_type SET DEFAULT 'fixed',
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_value SET NOT NULL;

ALTER TABLE customer_pricing
  DROP CONSTRAINT IF EXISTS customer_pricing_custom_price_nonnegative,
  DROP CONSTRAINT IF EXISTS customer_pricing_discount_value_nonnegative;

ALTER TABLE customer_pricing
  ADD CONSTRAINT customer_pricing_custom_price_nonnegative
    CHECK (custom_price >= 0) NOT VALID,
  ADD CONSTRAINT customer_pricing_discount_value_nonnegative
    CHECK (discount_value >= 0) NOT VALID;

CREATE INDEX IF NOT EXISTS pricing_categories_project_idx ON pricing_categories (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_services_project_idx ON pricing_services (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_packages_project_idx ON pricing_packages (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_pricing_project_idx ON customer_pricing (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_categories_owner_project_idx
  ON pricing_categories (user_id, project_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS customer_pricing_owner_project_idx
  ON customer_pricing (user_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_pricing_customer_idx
  ON customer_pricing (customer_id, service_item_id);

-- A quote may create at most one contract. This also makes retries idempotent.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS source_quote_id VARCHAR;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve every historical contract, but choose one canonical contract for a
-- source quote before enforcing uniqueness. Prefer the contract already linked
-- from quotes.contract_id, otherwise the oldest contract wins. Duplicates are
-- detached and retain an audit marker in metadata instead of being deleted.
WITH ranked_contracts AS (
  SELECT c.id,
         c.source_quote_id,
         ROW_NUMBER() OVER (
           PARTITION BY c.source_quote_id
           ORDER BY CASE WHEN q.contract_id::text = c.id::text THEN 0 ELSE 1 END,
                    c.created_at ASC NULLS LAST,
                    c.id::text ASC
         ) AS rank_no
    FROM contracts c
    LEFT JOIN quotes q ON q.id::text = c.source_quote_id::text
   WHERE c.source_quote_id IS NOT NULL
)
UPDATE quotes q
   SET contract_id = ranked.id,
       updated_at = NOW()
  FROM ranked_contracts ranked
 WHERE ranked.rank_no = 1
   AND q.id::text = ranked.source_quote_id::text
   AND q.contract_id IS DISTINCT FROM ranked.id;

WITH ranked_contracts AS (
  SELECT c.id,
         c.source_quote_id,
         ROW_NUMBER() OVER (
           PARTITION BY c.source_quote_id
           ORDER BY CASE WHEN q.contract_id::text = c.id::text THEN 0 ELSE 1 END,
                    c.created_at ASC NULLS LAST,
                    c.id::text ASC
         ) AS rank_no
    FROM contracts c
    LEFT JOIN quotes q ON q.id::text = c.source_quote_id::text
   WHERE c.source_quote_id IS NOT NULL
)
UPDATE contracts c
   SET metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
         'deduplicatedSourceQuoteId', c.source_quote_id,
         'deduplicatedSourceQuoteAt', NOW()
       ),
       source_quote_id = NULL,
       updated_at = NOW()
  FROM ranked_contracts ranked
 WHERE c.id = ranked.id
   AND ranked.rank_no > 1;

CREATE UNIQUE INDEX IF NOT EXISTS contracts_source_quote_unique_idx
  ON contracts (source_quote_id)
  WHERE source_quote_id IS NOT NULL;
