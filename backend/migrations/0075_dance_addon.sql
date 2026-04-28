-- 0075_dance_addon.sql
-- Add-on-system for Frilansdanser-utvidelse.
--
-- Modell:
--   • dance_addon — admin-redigerbar produkt-katalog
--   • dance_addon_subscription — per-bruker aktive add-ons
--
-- Add-ons er ekstra moduler en Frilansdanser kan aktivere à la carte
-- (video review pro, marketing-pakke, AI choreography assist osv.).
-- Aktivering låser opp feature-flags som useDancePlanGate sjekker.
-- Frilansdanser BEHOLDER sin grunnplan — add-on er additivt.
--
-- Studio-eier kan også aktivere add-ons (på team-nivå), men det er
-- en utvidelse for senere — for nå er add-ons primært for Frilansdanser.

-- ─── dance_addon — produkt-katalog ──────────────────────────────────
CREATE TABLE IF NOT EXISTS dance_addon (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Pris i NOK. NULL = "kontakt oss".
  monthly_price_kr INTEGER,
  yearly_price_kr INTEGER,
  -- Stripe-kobling — admin oppdaterer etter at price er opprettet
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  -- Feature-flags add-on låser opp i useDancePlanGate
  feature_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Hvilke personaer kan kjøpe add-on (default kun Frilansdanser Pro)
  available_for_personas JSONB NOT NULL DEFAULT '["dance_freelance"]'::jsonb,
  -- Kreves at brukeren er på en plan med 'addon_eligible'-feature
  requires_addon_eligible_plan BOOLEAN NOT NULL DEFAULT TRUE,
  trial_days INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_addon_active_idx
  ON dance_addon(is_active, display_order);

COMMENT ON TABLE dance_addon IS
  'Add-on-katalog for Frilansdanser-utvidelse. Aktivering legger feature_flags på toppen av plan.features i useDancePlanGate.';

-- ─── dance_addon_subscription — per-bruker aktive add-ons ───────────
CREATE TABLE IF NOT EXISTS dance_addon_subscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  addon_slug TEXT NOT NULL REFERENCES dance_addon(slug) ON DELETE RESTRICT,
  -- 'monthly' | 'yearly' | 'comp'
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  -- 'trialing' | 'active' | 'past_due' | 'canceled' | 'comp'
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  -- Hvilken admin som ga comp-tilgang (hvis billing_period='comp')
  comp_granted_by_user_id TEXT,
  comp_expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_addon_sub_billing_period_values
    CHECK (billing_period IN ('monthly','yearly','comp')),
  CONSTRAINT dance_addon_sub_status_values
    CHECK (status IN ('trialing','active','past_due','canceled','comp'))
);

-- Bare én aktiv (eller trialing) sub per (user, addon)
CREATE UNIQUE INDEX IF NOT EXISTS dance_addon_sub_active_unique
  ON dance_addon_subscription(user_id, addon_slug)
 WHERE status IN ('trialing','active','comp');

CREATE INDEX IF NOT EXISTS dance_addon_sub_user_idx
  ON dance_addon_subscription(user_id, status);

CREATE INDEX IF NOT EXISTS dance_addon_sub_stripe_idx
  ON dance_addon_subscription(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE dance_addon_subscription IS
  'Per-bruker aktive add-ons. Status= active|trialing|comp gir tilgang. Slettes ikke ved kansellering — historikk beholdes med status=canceled.';

-- ─── Seed default add-ons ───────────────────────────────────────────
-- Priser settes til NULL initielt så admin fyller inn via UI.

INSERT INTO dance_addon
  (slug, name, description, feature_flags, available_for_personas,
   trial_days, is_featured, display_order)
VALUES
  (
    'video_review_pro',
    'Video Review Pro',
    'Slow-motion playback, frame-by-frame stepping, sammenligning av kjøringer side-om-side, AI-genererte forbedringsforslag.',
    '["video_review_pro","video_slowmo","video_compare","video_ai_suggestions"]'::jsonb,
    '["dance_freelance"]'::jsonb,
    7, TRUE, 10
  ),
  (
    'marketing_pack',
    'Marketing-pakke',
    'Auto-generer reel-klipp fra opptak, sosial-media-post-scheduler, performance-statistikk per video.',
    '["marketing_reel_export","marketing_scheduler","marketing_analytics"]'::jsonb,
    '["dance_freelance"]'::jsonb,
    7, TRUE, 20
  ),
  (
    'ai_choreography_assist',
    'AI Choreography Assist',
    'AI-assistanse for koreografi-utvikling: musikk-analyse, formation-forslag, count-mapping fra audio.',
    '["ai_choreography","ai_music_analysis","ai_formation_suggest","ai_count_mapping"]'::jsonb,
    '["dance_freelance"]'::jsonb,
    14, FALSE, 30
  ),
  (
    'union_pro',
    'Union Pro',
    'Detaljert NoDa/Skuda-rapportering, automatisk TONO-vederlag-beregning, auto-fyll til NAV.',
    '["union_full_report","tono_calc","nav_autofill"]'::jsonb,
    '["dance_freelance"]'::jsonb,
    0, FALSE, 40
  )
ON CONFLICT (slug) DO NOTHING;
