-- 259_post_agent_module_entitlements.sql
-- À la carte-monetisering for The Role Room Post Agent.
--
-- I motsetning til 0046_role_room_agent_entitlements (én bundle-grant per
-- bruker som styrer AI-proxy-tilgang) sporer DENNE tabellen hvilke
-- ENKELT-MODULER en bruker har kjøpt:
--
--   demo_studio  (199 kr/mnd)  — interaktive produktdemoer + Product Brain
--   marketing    (199 kr/mnd)  — persona×funnel×kanal markedsmotor
--   capture      (399 kr/mnd)  — Canon-tethering + AI-culling + iPad on-set
--   resolve      (149 kr/mnd)  — DaVinci Resolve + Photoshop/Firefly-bro
--
-- 'bundle' = den eksisterende "The Role Room Post Agent" 299 kr/mnd-planen,
-- som låser opp ALLE moduler samtidig (oppgraderingsvei fra à la carte).
--
-- Hver bruker har høyst ÉN aktiv rad per modul (partial unique index på
-- revoked_at IS NULL). Tauri-appen leser entitlements ved oppstart og låser
-- opp moduler runtime; backend serverer kun selve nedlastingen til brukere
-- med minst én aktiv modul.

CREATE TABLE IF NOT EXISTS post_agent_module_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,

  -- Hvilken modul denne raden gir tilgang til. 'bundle' = alle moduler.
  module TEXT NOT NULL CHECK (module IN (
    'demo_studio',
    'marketing',
    'capture',
    'resolve',
    'bundle'
  )),

  -- 'active'  : betalt / inkludert
  -- 'revoked' : kansellert / past_due / admin-trukket
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),

  -- Hvordan modulen ble gitt — driver UI-merking + audit.
  source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN (
    'stripe',
    'bundle',
    'admin_grant'
  )),

  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  notes TEXT,

  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Én aktiv rad per (bruker, modul). Revoked rader beholdes for audit.
CREATE UNIQUE INDEX IF NOT EXISTS post_agent_module_entitlements_active_idx
  ON post_agent_module_entitlements (user_id, module)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS post_agent_module_entitlements_user_idx
  ON post_agent_module_entitlements (user_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS post_agent_module_entitlements_sub_idx
  ON post_agent_module_entitlements (stripe_subscription_id);

COMMENT ON TABLE post_agent_module_entitlements IS
  'À la carte per-modul-tilgang for Post Agent. Fylles av Stripe-webhooken; '
  'leses av Tauri-appen (runtime feature-gating) + gated download-ruten.';
