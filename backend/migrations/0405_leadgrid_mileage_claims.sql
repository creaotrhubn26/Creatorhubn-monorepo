-- Migration 0405: Leadgrid kjøregodtgjørelse-krav (mileage claims)
--
-- Egen Leadgrid-tabell (speiler bryllups-/software-utgiftsmønsteret, men
-- Leadgrid-scoped). Selgeren sender inn et krav (fra kjørebok/manuelt),
-- salgssjefen godkjenner i Salgssjef-cockpit → «Kjøregodtgjørelse»-arket.
-- Erstatter MileageMockData (som var demo-only) med ekte, persistert data.

CREATE TABLE IF NOT EXISTS leadgrid_mileage_claims (
    id               SERIAL PRIMARY KEY,
    organization_id  VARCHAR(255) NOT NULL,
    seller_user_id   VARCHAR(255) NOT NULL,
    seller_name      VARCHAR(255),
    trip_date        DATE NOT NULL,
    route_text       VARCHAR(500),
    km               NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount_nok       NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- pending → approved → paid   (eller rejected)
    status           VARCHAR(16) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','paid','rejected')),
    approved_by      VARCHAR(255),
    approved_at      TIMESTAMPTZ,
    note             TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leadgrid_mileage_claims_org_idx
    ON leadgrid_mileage_claims (organization_id, status);
CREATE INDEX IF NOT EXISTS leadgrid_mileage_claims_seller_idx
    ON leadgrid_mileage_claims (seller_user_id);
