-- 0070_dance_billing.sql
-- Betalings-stack for dans-vertikalen.
-- Plan-konfig er DB-drevet så admin kan endre priser, features og
-- Stripe price IDs uten code-deploy.
--
-- 4 tabeller:
--   dance_plan              — produkt-katalog (admin-redigerbar)
--   dance_subscription      — bruker → plan-binding + Stripe-state
--   dance_tester_invite     — invite-token til prototype-testere
--   dance_admin_settings    — generelle konfig-flagg (default trial-varighet osv)

-- ─── dance_plan ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dance_plan (
  slug TEXT PRIMARY KEY,                   -- 'frilanser_basic', 'studio_pro', etc
  name TEXT NOT NULL,                      -- visningsnavn
  -- 'dance_freelance' | 'dance_studio' | 'both'
  persona TEXT NOT NULL DEFAULT 'both',
  description TEXT,
  -- Pris i NOK. NULL = "kontakt oss" (custom enterprise).
  monthly_price_kr INTEGER,
  yearly_price_kr INTEGER,
  -- Stripe price IDs (admin oppdaterer disse via UI etter at de er
  -- opprettet i Stripe-dashboardet).
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  -- Features: array av FEATURE-strenger som mappes til plan-gates i UI.
  -- Eksempel: ["unlimited_pieces","video_review","ai_tagging","ehf_invoice"]
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Limits: { maxPieces, maxStudents, maxTeamSeats, storageGb, ... }
  -- NULL/0 = ubegrenset
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  trial_days INTEGER NOT NULL DEFAULT 14,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- skjul gamle planer uten å slette
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,  -- "Anbefalt"-badge
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_plan_persona_values
    CHECK (persona IN ('dance_freelance','dance_studio','both'))
);

CREATE INDEX IF NOT EXISTS dance_plan_active_persona_idx
  ON dance_plan (is_active, persona, display_order);

-- ─── dance_subscription ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dance_subscription (
  user_id TEXT PRIMARY KEY,
  plan_slug TEXT NOT NULL REFERENCES dance_plan(slug) ON DELETE RESTRICT,
  -- 'monthly' | 'yearly' | 'tester' | 'comp'
  -- (tester/comp = administrert tilgang utenom Stripe)
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'comp'
  status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- Hvilken tester-invite dette abonnementet stammer fra (for analyse).
  tester_invite_token TEXT,
  -- Hvilken admin som ga comp-tilgang (hvis billing_period='comp').
  comp_granted_by_user_id TEXT,
  comp_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_subscription_billing_period_values
    CHECK (billing_period IN ('monthly','yearly','tester','comp')),
  CONSTRAINT dance_subscription_status_values
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','comp'))
);

CREATE INDEX IF NOT EXISTS dance_subscription_status_idx
  ON dance_subscription (status, current_period_end);

CREATE INDEX IF NOT EXISTS dance_subscription_stripe_idx
  ON dance_subscription (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── dance_tester_invite ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS dance_tester_invite (
  token TEXT PRIMARY KEY,
  invited_by_user_id TEXT NOT NULL,
  invited_email TEXT,                      -- valgfritt — bare for sporing
  invited_name TEXT,
  plan_slug TEXT NOT NULL REFERENCES dance_plan(slug) ON DELETE RESTRICT,
  -- Hvor lenge tilgangen varer ETTER aksept.
  trial_days INTEGER NOT NULL DEFAULT 90,
  -- Hvor mange ganger token kan brukes (én delbar URL kan gjelde X testere).
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  -- Selve invite kan utløpe (separat fra trial_days).
  valid_until TIMESTAMPTZ,
  -- Aksept-sporing: enten første eller siste, vi tar siste her.
  accepted_at TIMESTAMPTZ,
  accepted_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_tester_invite_inviter_idx
  ON dance_tester_invite (invited_by_user_id, created_at DESC);

-- ─── dance_admin_settings ──────────────────────────────────────
-- Generelle konfig-flagg admin kan endre (default trial-varighet,
-- max-test-invites-per-måned, beta-mode-flagg, etc).
CREATE TABLE IF NOT EXISTS dance_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default-rader så admin har noe å starte med.
INSERT INTO dance_admin_settings (key, value, description) VALUES
  ('trial_defaults', '{"freelance_days": 14, "studio_days": 30}'::jsonb, 'Default trial-varighet per persona når ny bruker melder seg på'),
  ('tester_invite_defaults', '{"trial_days": 90, "max_uses": 1}'::jsonb, 'Defaults for nye tester-invites'),
  ('beta_mode', '{"enabled": true, "label": "BETA"}'::jsonb, 'Når beta_mode er PÅ vises beta-merker og betalingsskjerm kan vises i preview-modus')
ON CONFLICT (key) DO NOTHING;

-- ─── Default plans (admin kan redigere/disable senere) ─────────
INSERT INTO dance_plan (slug, name, persona, description, monthly_price_kr, yearly_price_kr, features, limits, display_order, is_featured, trial_days)
VALUES
  ('freelance_free',  'Frilanser Free',  'dance_freelance',
    'Test-tilgang. Reel-portefølje + prøvelogg. 5GB video. Watermark på offentlig delt reel.',
    0, 0,
    '["reel_basic","rehearsal_log","video_review_basic","public_reel_watermarked"]'::jsonb,
    '{"storageGb":5,"maxPieces":3,"watermark":true}'::jsonb,
    10, false, 0),
  ('freelance_basic', 'Frilanser',       'dance_freelance',
    'Aktiv jobbsøker. Ubegrenset reel + prøvelogg + NAV-rapport + casting-eksport.',
    149, 1490,
    '["reel_unlimited","rehearsal_log","video_review","nav_report","casting_export","public_reel"]'::jsonb,
    '{"storageGb":50,"maxPieces":50}'::jsonb,
    20, true, 14),
  ('freelance_pro',   'Frilanser Pro',   'dance_freelance',
    'Etablert pro. Alt i Frilanser + AI-tagging + analytics + prioritert support.',
    299, 2990,
    '["reel_unlimited","rehearsal_log","video_review","nav_report","casting_export","public_reel","ai_tagging","reel_analytics","priority_support"]'::jsonb,
    '{"storageGb":200}'::jsonb,
    30, false, 14),
  ('studio_start',    'Studio Start',    'dance_studio',
    'Mindre studio (<50 elever). 1 admin. Klasser/instruktører/saler + prøvelogg.',
    599, 5990,
    '["classes","instructors","rooms","rehearsal_log","video_review","movement_vocab","reel_basic"]'::jsonb,
    '{"adminSeats":1,"maxStudents":50,"storageGb":50,"maxPieces":10}'::jsonb,
    100, false, 30),
  ('studio',          'Studio',          'dance_studio',
    'Mellom-studio (50–200 elever). 5 admins. Multi-prosjekt + EHF-faktura.',
    1199, 11990,
    '["classes","instructors","rooms","rehearsal_log","video_review","movement_vocab","reel_basic","multi_project","ehf_invoice","performances_stripboard","grants"]'::jsonb,
    '{"adminSeats":5,"maxStudents":200,"storageGb":200}'::jsonb,
    110, true, 30),
  ('studio_pro',      'Studio Pro',      'dance_studio',
    'Stort studio/kompani (200+). 15 admins. White-label + dedikert kontakt.',
    2490, 24900,
    '["classes","instructors","rooms","rehearsal_log","video_review","movement_vocab","reel_unlimited","multi_project","ehf_invoice","performances_stripboard","grants","white_label","dedicated_support","ai_tagging"]'::jsonb,
    '{"adminSeats":15,"storageGb":1000}'::jsonb,
    120, false, 30)
ON CONFLICT (slug) DO NOTHING;
