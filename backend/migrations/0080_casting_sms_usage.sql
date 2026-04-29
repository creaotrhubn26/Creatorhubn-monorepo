-- 0080_casting_sms_usage.sql
-- Per-SMS billing-rader for audition-reminders.
--
-- Hver vellykket Twilio-send legger inn én rad. Pris og mva-sats stemples
-- per rad så historiske fakturaer ikke endrer seg når vi justerer pris.
-- stripe_invoice_item_id fylles ut når månedsfakturaen syncs til Stripe.

CREATE TABLE IF NOT EXISTS casting_sms_usage (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  schedule_id            VARCHAR(255) REFERENCES casting_schedules(id) ON DELETE SET NULL,
  candidate_id           VARCHAR(255) REFERENCES casting_candidates(id) ON DELETE SET NULL,
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  threshold              VARCHAR(8) NOT NULL,
  brand                  VARCHAR(32) NOT NULL,
  twilio_message_sid     TEXT,
  unit_price_nok_ex_vat  NUMERIC(10, 4) NOT NULL,
  vat_rate               NUMERIC(5, 4) NOT NULL DEFAULT 0.25,
  total_nok_ex_vat       NUMERIC(10, 4) NOT NULL,
  total_nok_incl_vat     NUMERIC(10, 4) NOT NULL,
  stripe_invoice_item_id TEXT,
  billing_period         VARCHAR(7) GENERATED ALWAYS AS (to_char(sent_at, 'YYYY-MM')) STORED
);

CREATE INDEX IF NOT EXISTS casting_sms_usage_project_period_idx
  ON casting_sms_usage (project_id, billing_period);

CREATE INDEX IF NOT EXISTS casting_sms_usage_period_idx
  ON casting_sms_usage (billing_period)
  WHERE stripe_invoice_item_id IS NULL;

COMMENT ON TABLE casting_sms_usage IS
  'Audit-trail for fakturerbar SMS-bruk i audition-reminders. Pris per rad er stemplet ved send-tidspunkt slik at retail-pris-endringer ikke endrer historikk.';

COMMENT ON COLUMN casting_sms_usage.unit_price_nok_ex_vat IS
  'Retail-pris per SMS i NOK eks. mva, slik den var ved send. Konfigureres via CASTING_SMS_RETAIL_PRICE_NOK_EX_VAT (default 2.00).';

COMMENT ON COLUMN casting_sms_usage.vat_rate IS
  'Norsk MVA-sats ved send (default 0.25). Stemplet for audit.';

COMMENT ON COLUMN casting_sms_usage.billing_period IS
  'YYYY-MM, automatisk beregnet fra sent_at. Brukes for månedlig faktura-aggregering.';

COMMENT ON COLUMN casting_sms_usage.stripe_invoice_item_id IS
  'Fyllt inn av månedlig Stripe-sync-job. NULL = ikke fakturert ennå.';
