-- =====================================================================
-- mig 0354 — Salgsledelse: provisjons-modeller, konkurranse-maler,
--            premie-katalog, fulfillment
--
-- Bygger backend-skjemaet for det nye Salgsledelse-systemet vi nettopp
-- bygde i iPad-UI. Lar org-admin/salgssjef:
--
--   • velge en provisjons-PRESET (custom / balanced / classic_b2b / saas
--     / agency / foto_video / enterprise_hybrid) og aktivere én eller
--     flere modeller (base_percentage, tiered, accelerator, recurring,
--     spiff, split, gross_margin, per_activity, team_pool, hybrid) med
--     per-modell konfig i JSONB
--   • aktivere konkurranse-MALER (weekly_revenue, monthly_deals,
--     discovery_calls, demo_count, pipeline_built, sprint, monthly_leader,
--     geographic, industry, team_vs_team, individual, volume, quality,
--     comeback, onboarding) med per-mal-overstyringer
--   • vedlikeholde org-spesifikk PREMIE-KATALOG (PrizeProduct) med
--     kategori (tech/travel/food/voucher/experience/cash/physical),
--     estimert verdi, leverandør, bilde (URL eller B2-opplastet) og
--     fulfillment-type
--   • opprette KONKURRANSER (sales_contests) med KPI + filter, koble
--     premier per plass (1.plass=iPad, 2.plass=AirPods ...) som
--     snapshot av PrizeProduct (pris kan endre seg senere uten å
--     påvirke historikk), registrere deltakere og score
--   • lukke konkurranser → markere vinnere via rank på
--     sales_contest_participants → tildele premie-fulfillment
--     (sales_prize_awards) m/ status-tidslinje
--     (awaiting_address → pending → ordered → shipped → received) +
--     tracking + shipping address (kun for physical_shipping)
--
-- Tabeller som lages (7):
--   1. sales_commission_configs    — én rad per org, preset + modeller + JSONB-config
--   2. sales_contest_templates     — aktiverte konkurranse-maler per org
--   3. sales_prize_catalog         — org-spesifikk premiekatalog (PrizeProduct)
--   4. sales_contests              — konkurranse-instanser
--   5. sales_contest_prizes        — premier per plass (rank) i konkurranse
--   6. sales_contest_participants  — deltakere + score + rank ved close
--   7. sales_prize_awards          — fulfillment-tildeling m/ status-tidslinje
--
-- NB: sales_contest_winners er IKKE en egen tabell — backend
-- (sales-leadership-routes.ts) leser vinnere ut av
-- sales_contest_participants WHERE rank IS NOT NULL.
--
-- Konvensjoner (matcher 0349/0353):
--   • organizations(id) = UUID, ON DELETE CASCADE
--   • users(id)         = VARCHAR(255) (IKKE UUID)
--   • PK               = UUID DEFAULT gen_random_uuid()
--   • Timestamps        = TIMESTAMPTZ NOT NULL DEFAULT now()
--   • Idempotent        = IF NOT EXISTS overalt
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. sales_commission_configs — én rad per org
-- ─────────────────────────────────────────────────────────────────────
-- preset = hvilken ferdig-mal salgssjefen valgte som utgangspunkt
-- active_models = JSONB-array (backend lagrer via JSON.stringify(...))
--                 med model-keys som er aktive (kan kombineres).
-- config JSONB-form (alle felt optional, leses kun for aktive modeller):
--   {
--     "base_percentage": {"rate": 0.10},
--     "tiers": [{"thresholdK": 100, "pct": 5}, ...],
--     "tieredBands": [{"fromK": 0, "toK": 100, "pct": 3}, ...],
--     "acceleratorMult": 1.5,
--     "recurringPct": 10,
--     "spiffs": [{"name": "Q4 push", "amountNok": 5000, "kpi": "new_logos"}],
--     "splitDefaultPrimary": 70,
--     "marginPct": 25,
--     "perActivityNok": {"call": 50, "meeting": 200, "demo": 500},
--     "teamPoolPct": 5,
--     "hybridBaseK": 400,
--     "hybridDealThresholdK": 1000,
--     "monthlyTargetK": 250
--   }
--
-- PK på organization_id direkte → enkel ON CONFLICT (organization_id)
-- DO UPDATE (matcher backend PUT /commission-config).
CREATE TABLE IF NOT EXISTS sales_commission_configs (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  preset          TEXT NOT NULL DEFAULT 'custom',
  active_models   JSONB NOT NULL DEFAULT '[]'::jsonb,
  config          JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by      VARCHAR(255) REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_commission_configs_updated_by
  ON sales_commission_configs(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_commission_configs_created_at
  ON sales_commission_configs(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 2. sales_contest_templates — aktiverte konkurranse-maler per org
-- ─────────────────────────────────────────────────────────────────────
-- defaults JSONB kan overstyre default_days / default_kpi /
-- default_prize per mal-type.
-- Tar ikke CHECK på template_type — backend (DEFAULT_CONTEST_TEMPLATES)
-- definerer kanoniske typer (weekly_revenue, monthly_deals,
-- discovery_calls, demo_count, pipeline_built m.fl.) som klienten kan
-- utvide uten å kjøre ny migrasjon.
CREATE TABLE IF NOT EXISTS sales_contest_templates (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type   TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  defaults        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by      VARCHAR(255) REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_sales_contest_templates_enabled
  ON sales_contest_templates(organization_id, enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_sales_contest_templates_updated_by
  ON sales_contest_templates(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_contest_templates_created_at
  ON sales_contest_templates(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. sales_prize_catalog — org-spesifikke premier (PrizeProduct)
-- ─────────────────────────────────────────────────────────────────────
-- image_b2_key settes når brukeren laster opp eget bilde via
-- PhotosPicker → B2 (vi lagrer kun objekt-nøkkelen; URL signeres ved
-- behov). image_url brukes for ekstern URL (f.eks. produkt-bilde fra
-- elkjop.no). fulfillment_type NULL = bruk default-mapping per kategori
-- (tech/physical→physical_shipping, travel→travel_booking,
-- food/voucher→digital_voucher/digital_code, experience→experience_voucher,
-- cash→cash_on_payroll).
CREATE TABLE IF NOT EXISTS sales_prize_catalog (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  icon                  TEXT NOT NULL DEFAULT 'gift.fill',
  category              TEXT NOT NULL DEFAULT 'physical'
                        CHECK (category IN ('tech','travel','food','voucher','experience','cash','physical','digital')),
  estimated_value_nok   INTEGER NOT NULL DEFAULT 0 CHECK (estimated_value_nok >= 0),
  fulfillment_type      TEXT NOT NULL DEFAULT 'physical_shipping'
                        CHECK (fulfillment_type IN (
                          'physical_shipping','digital_code','digital_voucher',
                          'experience_voucher','experience_ticket',
                          'travel_booking','cash_on_payroll','internal_grant'
                        )),
  vendor                TEXT,
  image_url             TEXT,
  image_b2_key          TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_by            VARCHAR(255) REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_prize_catalog_org
  ON sales_prize_catalog(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_prize_catalog_org_active
  ON sales_prize_catalog(organization_id, archived) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_sales_prize_catalog_category
  ON sales_prize_catalog(organization_id, category) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_sales_prize_catalog_created_by
  ON sales_prize_catalog(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_prize_catalog_created_at
  ON sales_prize_catalog(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 4. sales_contests — selve konkurransene
-- ─────────────────────────────────────────────────────────────────────
-- kpi_config JSONB-form (eksempler):
--   {"cityFilter": ["Oslo", "Bergen"], "minDealAmountNok": 50000}
--   {"industryFilter": ["tannlege", "lege"]}
--   {"teams": [{"name": "Team A", "userIds": [...]}, ...]}
--
-- closed_at settes når status går active → ended (backend POST
-- /contests/:id/close).
-- starts_at og ends_at er NULLABLE — backend tillater null
-- (åpen start/slutt) via body.starts_at/ends_at.
-- template_type uten CHECK — backend definerer kanoniske typer.
CREATE TABLE IF NOT EXISTS sales_contests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  template_type   TEXT NOT NULL,
  kpi             TEXT NOT NULL,
  kpi_config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','ended','archived')),
  created_by      VARCHAR(255) REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_contests_org
  ON sales_contests(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_contests_org_status
  ON sales_contests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_contests_active
  ON sales_contests(organization_id, ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sales_contests_ends_at
  ON sales_contests(ends_at);
CREATE INDEX IF NOT EXISTS idx_sales_contests_template
  ON sales_contests(organization_id, template_type);
CREATE INDEX IF NOT EXISTS idx_sales_contests_created_by
  ON sales_contests(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_contests_created_at
  ON sales_contests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_contests_closed_at
  ON sales_contests(closed_at) WHERE closed_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 5. sales_contest_prizes — premier per plass (rank) i konkurranse
-- ─────────────────────────────────────────────────────────────────────
-- product_id (nullable) peker valgfritt til en rad i sales_prize_catalog
-- (samme org) hvis premien kommer fra katalogen. Hvis admin la inn en
-- ad-hoc premie er product_id NULL.
-- product_title / product_category / fulfillment_type / estimated_value_nok
-- er DENORMALISERT for rapport- og fulfillment-historikk — pris/navn kan
-- endre seg i katalogen uten å påvirke en konkurranse som allerede
-- annonserte "1.plass = iPad til 12 990 NOK".
-- product_snapshot er full JSONB-kopi av PrizeProduct ved opprettelse.
CREATE TABLE IF NOT EXISTS sales_contest_prizes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id            UUID NOT NULL REFERENCES sales_contests(id) ON DELETE CASCADE,
  rank                  INTEGER NOT NULL CHECK (rank > 0),
  product_id            UUID REFERENCES sales_prize_catalog(id) ON DELETE SET NULL,
  product_title         TEXT NOT NULL,
  product_category      TEXT NOT NULL DEFAULT 'physical',
  fulfillment_type      TEXT NOT NULL DEFAULT 'physical_shipping',
  estimated_value_nok   INTEGER NOT NULL DEFAULT 0 CHECK (estimated_value_nok >= 0),
  product_snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_sales_contest_prizes_contest
  ON sales_contest_prizes(contest_id, rank);
CREATE INDEX IF NOT EXISTS idx_sales_contest_prizes_product
  ON sales_contest_prizes(product_id) WHERE product_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 6. sales_contest_participants — deltakere + løpende score + rank
-- ─────────────────────────────────────────────────────────────────────
-- rank settes når konkurransen lukkes (backend POST /contests/:id/close
-- markerer topp N deltakere). NULL = ikke vinner.
-- snapshot_at / user_name / user_email settes også ved close — vi
-- denormaliserer brukerdata her slik at vinner-rapporten holder selv om
-- brukeren senere endrer navn/epost eller blir slettet.
CREATE TABLE IF NOT EXISTS sales_contest_participants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id       UUID NOT NULL REFERENCES sales_contests(id) ON DELETE CASCADE,
  user_id          VARCHAR(255) NOT NULL REFERENCES users(id),
  score            NUMERIC DEFAULT 0,
  rank             INTEGER,
  snapshot_at      TIMESTAMPTZ,
  user_name        TEXT,
  user_email       TEXT,
  last_updated_at  TIMESTAMPTZ,
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_contest_participants_contest
  ON sales_contest_participants(contest_id);
CREATE INDEX IF NOT EXISTS idx_sales_contest_participants_user
  ON sales_contest_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_contest_participants_leaderboard
  ON sales_contest_participants(contest_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_sales_contest_participants_winners
  ON sales_contest_participants(contest_id, rank) WHERE rank IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 7. sales_prize_awards — fulfillment per vinner m/ status-tidslinje
-- ─────────────────────────────────────────────────────────────────────
-- prize_id viser til den spesifikke (contest, rank)-premien i
-- sales_contest_prizes. winner_user_id er vinneren (VARCHAR(255) for å
-- matche users(id)).
-- product_title / product_category / fulfillment_type er DENORMALISERT
-- fra sales_contest_prizes ved tildeling, så fulfillment-postene er
-- audit-stabile.
-- shipping_address er JSONB ({name, street, postal, city, country}) og
-- kun relevant for physical_shipping. Status-tidslinjen reflekteres i
-- ordered_at / shipped_at / received_at-feltene + status-enum-overgang
-- (awaiting_address → pending → ordered → shipped → received, eller
-- cancelled).
CREATE TABLE IF NOT EXISTS sales_prize_awards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id          UUID NOT NULL REFERENCES sales_contests(id) ON DELETE CASCADE,
  prize_id            UUID NOT NULL REFERENCES sales_contest_prizes(id) ON DELETE CASCADE,
  winner_user_id      VARCHAR(255) NOT NULL REFERENCES users(id),
  rank                INTEGER NOT NULL CHECK (rank > 0),
  product_title       TEXT NOT NULL,
  product_category    TEXT NOT NULL DEFAULT 'physical',
  fulfillment_type    TEXT NOT NULL DEFAULT 'physical_shipping',
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','awaiting_address','ordered','shipped','received','cancelled')),
  shipping_address    JSONB,
  tracking_number     TEXT,
  notes               TEXT,
  ordered_at          TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  received_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_contest
  ON sales_prize_awards(contest_id);
CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_prize
  ON sales_prize_awards(prize_id);
CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_winner
  ON sales_prize_awards(winner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_status
  ON sales_prize_awards(status) WHERE status IN ('pending','awaiting_address','ordered','shipped');
CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_fulfillment_type
  ON sales_prize_awards(fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_sales_prize_awards_created_at
  ON sales_prize_awards(created_at DESC);

COMMIT;
