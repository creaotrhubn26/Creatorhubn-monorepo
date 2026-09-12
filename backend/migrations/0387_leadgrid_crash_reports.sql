-- 0387: Krasjrapportering (2026-07-18) — launch-blocker fra readiness-listen.
-- iPad-appen fanger krasj/heng via MetricKit (MXDiagnosticPayload leveres av
-- iOS ved neste oppstart) og poster dem hit. Ingen ekstern avhengighet;
-- Sentry-iOS kan legges oppå senere. Payload = rå diagnostikk-JSON
-- (call-stacks, terminerings-årsak) for atos-symbolisering m/ dSYM.

CREATE TABLE IF NOT EXISTS leadgrid_crash_reports (
  id UUID PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  user_email TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  build_number TEXT NOT NULL DEFAULT '',
  os_version TEXT NOT NULL DEFAULT '',
  device_model TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'crash',        -- crash|hang|cpu|disk
  termination_reason TEXT NOT NULL DEFAULT '',
  signal TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',       -- rå MetricKit-diagnostikk
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lg_crash_created
  ON leadgrid_crash_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lg_crash_build
  ON leadgrid_crash_reports (build_number, kind, created_at DESC);
