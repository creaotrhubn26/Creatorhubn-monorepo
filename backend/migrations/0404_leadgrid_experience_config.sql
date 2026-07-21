-- =====================================================================
-- mig 0404 — Leadgrid experience-media config (mockup-innhold)
-- Singleton som holder per-scene media-overstyringer for landing-scrollfilmen
-- (LeadgridExperience). Super-admin skriver via media-editor; landing leser
-- offentlig. Idempotent — IF NOT EXISTS.
-- =====================================================================
BEGIN;
CREATE TABLE IF NOT EXISTS leadgrid_experience_config (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config      JSONB NOT NULL,
  updated_by  VARCHAR(255),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
