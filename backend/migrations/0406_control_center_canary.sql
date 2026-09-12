-- Control Center · syntetiske canary-journeys (proaktiv drift, «i forkant»).
--
-- Hver rad = ett canary-sjekk-utfall fra en kjøring. Runner-en (control-center-
-- canary.ts) skriver én rad per sjekk hvert 10. min (GitHub Actions cron), og
-- bygger i TILLEGG en error_log-incident ved feil (via logError) slik at feil
-- automatisk dukker opp i Control Center «Hendelser». Denne tabellen driver
-- status-per-journey + oppetid30d + p95 i «Canary»-fanen.
CREATE TABLE IF NOT EXISTS control_center_canary_runs (
  id           BIGSERIAL PRIMARY KEY,
  journey_key  TEXT NOT NULL,
  label        TEXT NOT NULL,
  vertical     TEXT NOT NULL,
  ok           BOOLEAN NOT NULL,
  http_status  INTEGER,
  latency_ms   INTEGER,
  expected     TEXT,          -- akseptable status(er), f.eks. "401" el. "200,401"
  message      TEXT,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot path: siste utfall per journey + tidsserie for oppetid/p95.
CREATE INDEX IF NOT EXISTS idx_canary_runs_journey_time
  ON control_center_canary_runs (journey_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_canary_runs_time
  ON control_center_canary_runs (checked_at DESC);
