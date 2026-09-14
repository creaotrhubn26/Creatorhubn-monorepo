-- 0607 — flytt runtime-opprettede tabeller inn i skjemaet.
--
-- Bakgrunn: sju tabeller ble bare opprettet av `CREATE TABLE IF NOT EXISTS`
-- i request-stier. De finnes derfor ikke i produksjon før koden tilfeldigvis
-- treffer riktig rute, og skjemaet kan ikke revideres fra migrasjonene.
-- Kontroll mot produksjon 14. september 2026 bekreftet at ingen av dem
-- eksisterte der.
--
-- Migrasjonen er idempotent og bruker samme kolonnenavn/typer som
-- runtime-DDL-en, slik at eksisterende `CREATE TABLE IF NOT EXISTS`-kall
-- blir no-ops og ingen tabell blir opprettet to ganger.
--
-- Print Store (Slice 10.4) er unntaket: `print_orders` finnes allerede fra
-- migrasjon 0001/134 med en eldre modell. Den får de manglende kolonnene i
-- stedet for en ny tabell, og de gamle NOT NULL-kravene løsnes fordi koden
-- ikke fyller dem. Tabellen er tom i produksjon, så det er trygt.

BEGIN;

-- ─────────────────────────── Print Store ───────────────────────────
-- Kolonnene under er de client-gallery-checkout, Stripe-webhooken og
-- fotograf-oversiktene faktisk skriver/leser. Uten dem feiler
-- INSERT INTO print_orders i produksjon.
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS photographer_id varchar(64);
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar(128);
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS stripe_session_id varchar(128);
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS currency varchar(8) NOT NULL DEFAULT 'NOK';
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS payment_status varchar(32) NOT NULL DEFAULT 'pending';
ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS fulfillment_status varchar(32) DEFAULT 'pending';

-- Den eldre modellen krevde felt checkout-en ikke har (ordrenummer,
-- vendor, linjer som JSON). Linjene ligger nå i print_order_items.
ALTER TABLE print_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN order_number DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN client_name DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN shipping_address DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN items DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN order_total DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN grand_total DROP NOT NULL;
ALTER TABLE print_orders ALTER COLUMN print_vendor DROP NOT NULL;

-- gallery_id pekte på den gamle client_galleries-tabellen. Print Store leser
-- og skriver mot photographer_client_galleries, så enhver ekte bestilling ble
-- avvist av fremmednøkkelen. Tabellen er tom, så kolonnen konverteres til uuid
-- og fremmednøkkelen flyttes til riktig galleritabell.
ALTER TABLE print_orders DROP CONSTRAINT IF EXISTS print_orders_gallery_id_client_galleries_id_fk;
DO $$ BEGIN
  IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='print_orders' AND column_name='gallery_id') <> 'uuid' THEN
    EXECUTE 'ALTER TABLE print_orders ALTER COLUMN gallery_id TYPE uuid USING NULLIF(gallery_id, '''')::uuid';
  END IF;
END $$;
DO $$ BEGIN
  ALTER TABLE print_orders
    ADD CONSTRAINT print_orders_gallery_fk
    FOREIGN KEY (gallery_id) REFERENCES photographer_client_galleries(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS print_orders_photographer_idx
  ON print_orders (photographer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS print_orders_gallery_idx
  ON print_orders (gallery_id);
CREATE INDEX IF NOT EXISTS print_orders_stripe_intent_idx
  ON print_orders (stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS print_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id varchar(64) NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  size_label varchar(64),
  material varchar(64),
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  currency varchar(8) NOT NULL DEFAULT 'NOK',
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS print_products_photographer_idx
  ON print_products (photographer_id, is_active);

-- order_id er varchar fordi print_orders.id er varchar i produksjon
-- (runtime-DDL-en antok uuid og ville ha laget en utype-lik FK).
CREATE TABLE IF NOT EXISTS print_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL,
  product_id uuid NOT NULL,
  image_id varchar(64),
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS print_order_items_order_idx
  ON print_order_items (order_id);

DO $$ BEGIN
  ALTER TABLE print_order_items
    ADD CONSTRAINT print_order_items_order_fk
    FOREIGN KEY (order_id) REFERENCES print_orders(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE print_order_items
    ADD CONSTRAINT print_order_items_product_fk
    FOREIGN KEY (product_id) REFERENCES print_products(id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────── Admin Room konkurrentrapport ─────────────────────
-- Per-konkurrent Claude-rapport med 7 dagers cache. Ikke det samme som
-- marketing_competitor_reports, som er én aggregert rapport per brand_key.
CREATE TABLE IF NOT EXISTS competitor_reports (
  competitor_id text PRIMARY KEY,
  report_md text NOT NULL,
  swot_strengths text[],
  swot_weaknesses text[],
  swot_opportunities text[],
  swot_threats text[],
  recommended_actions text[],
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_used text NOT NULL DEFAULT 'claude-opus-4-7'
);
CREATE INDEX IF NOT EXISTS competitor_reports_generated_idx
  ON competitor_reports (generated_at DESC);

-- ──────────────────────── Ergonomi-telemetri ────────────────────────
CREATE TABLE IF NOT EXISTS ergonomics_events (
  id bigserial PRIMARY KEY,
  user_id varchar NOT NULL,
  session_id varchar NOT NULL,
  kind varchar NOT NULL,
  asset_id varchar,
  action varchar,
  previous_action varchar,
  new_action varchar,
  first_view boolean,
  ms bigint NOT NULL,
  sequence integer NOT NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ergonomics_events_user_session_idx
  ON ergonomics_events (user_id, session_id, ms);

CREATE TABLE IF NOT EXISTS ergonomics_reflect (
  id bigserial PRIMARY KEY,
  user_id varchar NOT NULL,
  session_id varchar NOT NULL,
  hardest text,
  regretted text,
  would_save text,
  submitted_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ergonomics_reflect_user_idx
  ON ergonomics_reflect (user_id, submitted_at DESC);

-- ──────────────────────── Prosjekt-endringslogg ────────────────────────
CREATE TABLE IF NOT EXISTS project_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(255) NOT NULL,
  kind varchar(50) NOT NULL,
  actor_kind varchar(20) NOT NULL,
  actor_label varchar(255),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_change_log_project_created_idx
  ON project_change_log (project_id, created_at DESC);

-- ─────────────────── Live koordinering — aktivitetsfeed ───────────────────
CREATE TABLE IF NOT EXISTS project_coordination_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar(64) NOT NULL,
  type varchar(24) NOT NULL,
  message varchar(500) NOT NULL,
  actor_id varchar(64),
  actor_name varchar(255),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_coordination_activity_project_created_idx
  ON project_coordination_activity (project_id, created_at DESC);

COMMIT;
