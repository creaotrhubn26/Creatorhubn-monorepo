-- 0621_game_billing.sql
-- Betalings-stack for spillstudio-vertikalen (Story Graph).
-- Speiler dans (0070) med game_*-tabeller i stedet for å generalisere
-- dance_* (PK-endring + regresjonsrisiko i en betalende vertikal).
-- Ingen persona-kolonne: spillstudio har én persona.
--
--   game_plan            — produkt-katalog (admin-redigerbar)
--   game_subscription    — bruker → plan-binding + Stripe-state
--   game_tester_invite   — invite-token til beta-testere
--   game_admin_settings  — konfig-flagg
--
-- Prisene i seeden er PLASSHOLDERE; admin redigerer dem i UI (Admin · Planer).

CREATE TABLE IF NOT EXISTS game_plan (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_kr INTEGER,
  yearly_price_kr INTEGER,
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  -- Features: ["play","export_json","export_md","share_links","export_html",
  --            "ai_assist","translations","import_twine_ink","runtime_packages"]
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Limits: { maxProjects, maxElements, seats } — NULL/0 = ubegrenset
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  trial_days INTEGER NOT NULL DEFAULT 14,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_plan_active_idx
  ON game_plan (is_active, display_order);

CREATE TABLE IF NOT EXISTS game_subscription (
  user_id TEXT PRIMARY KEY,
  plan_slug TEXT NOT NULL REFERENCES game_plan(slug) ON DELETE RESTRICT,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  tester_invite_token TEXT,
  comp_granted_by_user_id TEXT,
  comp_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_subscription_billing_period_values
    CHECK (billing_period IN ('monthly','yearly','tester','comp')),
  CONSTRAINT game_subscription_status_values
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','comp'))
);

CREATE INDEX IF NOT EXISTS game_subscription_status_idx
  ON game_subscription (status, current_period_end);

CREATE INDEX IF NOT EXISTS game_subscription_stripe_idx
  ON game_subscription (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_tester_invite (
  token TEXT PRIMARY KEY,
  invited_by_user_id TEXT NOT NULL,
  invited_email TEXT,
  invited_name TEXT,
  plan_slug TEXT NOT NULL REFERENCES game_plan(slug) ON DELETE RESTRICT,
  trial_days INTEGER NOT NULL DEFAULT 90,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_until TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_tester_invite_inviter_idx
  ON game_tester_invite (invited_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by_user_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO game_admin_settings (key, value, description) VALUES
  ('trial_defaults', '{"days": 14}'::jsonb, 'Default trial-varighet for betalte planer'),
  ('tester_invite_defaults', '{"trial_days": 90, "max_uses": 1}'::jsonb, 'Defaults for nye tester-invites'),
  ('beta_mode', '{"enabled": true, "label": "BETA"}'::jsonb, 'Beta-merke på Spillstudio-flaten')
ON CONFLICT (key) DO NOTHING;

-- Standardplaner. `solo` er planen alle uten abonnement får (server-side fallback).
INSERT INTO game_plan (slug, name, description, monthly_price_kr, yearly_price_kr, features, limits, display_order, is_featured, trial_days)
VALUES
  ('solo', 'Solo', 'Gratis. Story Graph med Play Mode og JSON/Markdown-eksport for inntil 3 prosjekter.',
    0, 0,
    '["play","export_json","export_md"]'::jsonb,
    '{"maxProjects":3,"maxElements":200}'::jsonb,
    10, false, 0),
  ('pro', 'Pro', 'For narrative designere. Delbare spill-lenker, standalone HTML, KI-forslag, oversettelser og Twine/Ink-import.',
    149, 1490,
    '["play","export_json","export_md","share_links","export_html","ai_assist","translations","import_twine_ink"]'::jsonb,
    '{}'::jsonb,
    20, true, 14),
  ('studio', 'Studio', 'For team. Alt i Pro + runtime-pakker for Unity/Godot og 5 seter.',
    490, 4900,
    '["play","export_json","export_md","share_links","export_html","ai_assist","translations","import_twine_ink","runtime_packages"]'::jsonb,
    '{"seats":5}'::jsonb,
    30, false, 14)
ON CONFLICT (slug) DO NOTHING;
