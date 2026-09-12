-- 0370: Per-org feature-entitlements for Leadgrid SuperAdmin (2026-07-05)
--
-- EntitlementMatrisen på iPad («gi organisasjoner tilgang») lagret før
-- kun i et lokalt @State-array — ingen persistering. Denne tabellen er
-- fasiten: én rad per (organisasjon, feature). Ingen rader for en org
-- = ingen overrides = alt følger planen (bakoverkompatibelt).
--
-- feature_key = Swift-casenavnet i LeadgridFeature (stabil ASCII-nøkkel,
-- f.eks. 'leadbookMaler'), IKKE den norske display-teksten.

CREATE TABLE IF NOT EXISTS leadgrid_org_entitlements (
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature_key         VARCHAR(80) NOT NULL,
  state               VARCHAR(16) NOT NULL
                      CHECK (state IN ('included','trial','add_on','locked')),
  monthly_limit       INTEGER,
  trial_ends_at       TIMESTAMPTZ,
  addon_price_monthly INTEGER,
  updated_by          VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, feature_key)
);
