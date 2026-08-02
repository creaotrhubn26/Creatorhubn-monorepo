-- Migration 0406: Leadgrid cockpit-persistering (godkjenningskø + coaching)
--
-- Egne Leadgrid-tabeller for Salgssjef-cockpit-arkene som var demo-only:
--   1. leadgrid_approvals        — deals/rabatter til godkjenning
--   2. leadgrid_coaching_sessions — 1-til-1 coaching-planer
-- Speiler kjøregodtgjørelse-mønsteret (mig 0405), Leadgrid-scoped.

-- ── 1. Godkjenningskø ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_approvals (
    id               SERIAL PRIMARY KEY,
    organization_id  VARCHAR(255) NOT NULL,
    kind             VARCHAR(16) NOT NULL DEFAULT 'deal'
                       CHECK (kind IN ('deal','discount','special')),
    title            VARCHAR(255) NOT NULL,
    seller_user_id   VARCHAR(255),
    seller_name      VARCHAR(255),
    customer_name    VARCHAR(255),
    amount_nok       NUMERIC(12,2) NOT NULL DEFAULT 0,
    rationale        TEXT,
    status           VARCHAR(16) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
    decided_by       VARCHAR(255),
    decided_at       TIMESTAMPTZ,
    comment          TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leadgrid_approvals_org_idx
    ON leadgrid_approvals (organization_id, status);

-- ── 2. Coaching 1-til-1 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_coaching_sessions (
    id               SERIAL PRIMARY KEY,
    organization_id  VARCHAR(255) NOT NULL,
    member_user_id   VARCHAR(255),
    member_name      VARCHAR(255) NOT NULL,
    scheduled_at     TIMESTAMPTZ NOT NULL,
    focus            VARCHAR(500),
    status           VARCHAR(16) NOT NULL DEFAULT 'scheduled'
                       CHECK (status IN ('scheduled','done','cancelled')),
    created_by       VARCHAR(255),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS leadgrid_coaching_org_idx
    ON leadgrid_coaching_sessions (organization_id, status, scheduled_at);
