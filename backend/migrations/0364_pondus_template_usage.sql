-- =====================================================================
-- mig 0364 — Pondus mal-bruk (usage-tracking)
--
-- Leadbook-fanens KPI-er («Bruk i dag», «Booket møte-rate»,
-- «Team-adopsjon») og mal-kortenes used/conversion-tall hadde ingen
-- datakilde — Pondus-backenden (mig 0355/0356) manglet bruks-sporing.
-- Hver gang en selger bruker en mal logges en rad her; utfall kan
-- oppdateres i etterkant (meeting_booked/won osv.) og gir ekte
-- konverteringsrater per mal.
--
-- Konvensjoner: organization_id VARCHAR uten FK (jf. 0361/0363),
-- users(id) VARCHAR, idempotent.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pondus_template_usage (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES pondus_templates(id) ON DELETE CASCADE,
  organization_id  VARCHAR(255),
  user_id          VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id          UUID,
  outcome          VARCHAR(30) NOT NULL DEFAULT 'used'
                   CHECK (outcome IN ('used','meeting_booked','proposal_sent','won','lost','no_answer')),
  used_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pondus_usage_template
  ON pondus_template_usage(template_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_pondus_usage_org
  ON pondus_template_usage(organization_id, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_pondus_usage_user
  ON pondus_template_usage(user_id, used_at DESC);

COMMIT;
