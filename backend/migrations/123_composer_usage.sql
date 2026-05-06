-- 123_composer_usage.sql
-- Per-event billing-rader for plakat-/menu-composeren.
-- Speiler casting_sms_usage-mønsteret: én rad per fakturerbart event,
-- pris stemplet inn ved innsetting så historiske fakturaer aldri endrer
-- seg når retail-pris justeres. stripe_invoice_item_id fylles av
-- composer-invoice-runner (månedlig cron).
--
-- Pris-policy (default — overstyrbar via env-vars):
--   Claude-kall:    5,00 NOK eks. mva.  (cost ≈ 0,07-0,10 NOK; markup 49×)
--   Render:         0,50 NOK eks. mva.  (cost ≈ 0,001-0,006 NOK; markup 80-500×)
--   R2 storage:     1,00 NOK/GB/mnd     (cost ≈ 0,16 NOK; markup 6×)

BEGIN;

CREATE TABLE IF NOT EXISTS composer_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  business_profile_id VARCHAR REFERENCES business_profiles(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN (
    'claude_campaign', 'render_poster', 'render_menu_pdf', 'r2_storage'
  )),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quantity NUMERIC(10, 4) NOT NULL DEFAULT 1,
  unit_price_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  vat_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.25,
  total_nok_ex_vat NUMERIC(10, 4) NOT NULL,
  total_nok_incl_vat NUMERIC(10, 4) NOT NULL,
  stripe_invoice_item_id TEXT,
  -- Billing-period populeres av composer-billing-service ved INSERT.
  -- Kunne vært GENERATED, men PG 16+ avviser to_char på TIMESTAMPTZ som ikke-immutable.
  billing_period VARCHAR(7) NOT NULL,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS composer_usage_user_period_idx
  ON composer_usage (user_id, billing_period);
CREATE INDEX IF NOT EXISTS composer_usage_period_unbilled_idx
  ON composer_usage (billing_period)
  WHERE stripe_invoice_item_id IS NULL;
CREATE INDEX IF NOT EXISTS composer_usage_event_type_idx
  ON composer_usage (event_type);
CREATE INDEX IF NOT EXISTS composer_usage_business_profile_idx
  ON composer_usage (business_profile_id)
  WHERE business_profile_id IS NOT NULL;

COMMENT ON TABLE composer_usage IS
  'Audit-trail for fakturerbar plakat-/menu-composer-bruk. Pris stemplet ved innsetting; matcher casting_sms_usage-mønsteret.';

CREATE TABLE IF NOT EXISTS composer_subscription (
  user_id VARCHAR PRIMARY KEY,
  tier VARCHAR(40) NOT NULL DEFAULT 'pilot' CHECK (tier IN ('pilot', 'standard', 'pro', 'custom')),
  included_claude_calls INTEGER NOT NULL DEFAULT 10,
  included_renders INTEGER NOT NULL DEFAULT 50,
  included_r2_gb NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
  included_brands INTEGER NOT NULL DEFAULT 1,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'paused')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS composer_subscription_stripe_idx
  ON composer_subscription (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE composer_subscription IS
  'Per-bruker abonnements-state for plakat-/menu-composeren. Tier styrer inkluderte kvoter; bruk over kvote logges i composer_usage.';

COMMIT;
