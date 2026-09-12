-- =====================================================================
-- mig 0365 — Leadgrid org-modus-override
--
-- Super_admins (Daniel) skal kunne velge hvilken «modus» de ser appen i:
-- solo-modus ('self'), Creatorhub AS, eller en hvilken som helst org.
-- Alle Leadgrid-org-resolverne (nå samlet i leadgrid-org-resolver.ts)
-- sjekker denne tabellen først. Skrive-endepunktet håndhever super_admin.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_org_overrides (
  user_id          VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- 'self' = solo-modus (orgId = userId); ellers org-id-streng.
  override_org_id  VARCHAR(255) NOT NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
