-- Migration 231: feature_user_overrides
--
-- Per-user feature overrides for AdminDashboard "Lab" → feature-
-- customizations-tab. Lar admin slå features på/av for spesifikke
-- brukere, og overstyrer dermed platform-wide defaults i
-- admin_features-tabellen.
--
-- NB: Vi kalte først tabellen `feature_customizations`, men dev-DB-en
-- har allerede en tabell med det navnet (logo/label-customization fra
-- Drizzle-schema). For å unngå kollisjon ligger per-user-overrides nå
-- i en egen tabell: `feature_user_overrides`. Det reflekterer også
-- intensjonen bedre — én rad pr. (user, feature)-par som overstyrer
-- default-on/off-status.
--
-- En rad pr. (user_id, feature_id) — UNIQUE-constraint sikrer at
-- POST kan brukes som upsert (ON CONFLICT DO UPDATE).
--
-- override_value:  TRUE = aktivert, FALSE = deaktivert.
-- override_reason: audit-tekst (hvorfor satte admin denne overriden?).
-- created_by:      admin-epost (session.email), bevart selv etter UPDATE.

CREATE TABLE IF NOT EXISTS feature_user_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
    -- Hvilken bruker overriden gjelder for
  feature_id TEXT NOT NULL,
    -- Feature-key fra admin-features-routes.ts
  override_value BOOLEAN NOT NULL,
    -- TRUE = aktivert, FALSE = deaktivert (overstyrer default)
  override_reason TEXT,
    -- Hvorfor admin overstyret (audit-formål)
  created_by TEXT NOT NULL,
    -- Hvem (admin) som satte denne
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_id)
);

CREATE INDEX IF NOT EXISTS feature_user_overrides_user_idx
  ON feature_user_overrides (user_id);

CREATE INDEX IF NOT EXISTS feature_user_overrides_feature_idx
  ON feature_user_overrides (feature_id);
