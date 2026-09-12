-- 248_google_pay_config.sql
--
-- Skjema for Google Pay-konfigurasjon i Admin Room.
-- Driver `/api/admin/google-pay/*` (admin-google-pay-config-routes.ts) som
-- igjen backes UI-en GooglePaymentsConfiguration.tsx.
--
-- Singleton-rad: bare én Google Pay-konfigurasjon per app. CHECK(id =
-- 'singleton') forhindrer at andre rader skrives inn ved en feiltagelse.
-- Tabellen `google_pay_transactions` er kim til fremtidig betalingsspor;
-- rute-laget er defensivt (to_regclass) mot manglende tabeller slik at UI
-- ikke krasjer hvis migrasjonen ennå ikke er kjørt.

CREATE TABLE IF NOT EXISTS google_pay_config (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  merchant_id TEXT,
  merchant_name TEXT,
  environment TEXT NOT NULL DEFAULT 'TEST', -- 'TEST' | 'PRODUCTION'
  gateway TEXT NOT NULL DEFAULT 'stripe', -- 'stripe' | 'adyen' | 'braintree'
  gateway_merchant_id TEXT,
  allowed_card_networks TEXT[] NOT NULL DEFAULT ARRAY['VISA','MASTERCARD'],
  allowed_card_auth_methods TEXT[] NOT NULL DEFAULT ARRAY['PAN_ONLY','CRYPTOGRAM_3DS'],
  country_code TEXT NOT NULL DEFAULT 'NO',
  currency_code TEXT NOT NULL DEFAULT 'NOK',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 'singleton')
);

CREATE TABLE IF NOT EXISTS google_pay_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NOK',
  gateway_token TEXT,
  payment_method_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'refunded'
  stripe_charge_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS google_pay_transactions_user_idx
  ON google_pay_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS google_pay_transactions_status_idx
  ON google_pay_transactions (status, created_at DESC);

-- Seed singleton config
INSERT INTO google_pay_config (id, merchant_id, merchant_name, environment, gateway, country_code, currency_code)
VALUES ('singleton', NULL, 'CreatorHub Norge AS', 'TEST', 'stripe', 'NO', 'NOK')
ON CONFLICT (id) DO NOTHING;
