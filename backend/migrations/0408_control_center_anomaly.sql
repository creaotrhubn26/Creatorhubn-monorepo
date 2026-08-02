-- Control Center · anomali-deteksjon (proaktiv drift, «i forkant»).
--
-- error_log aggregerer per fingerprint (ingen per-event-rader), så vi utleder
-- event-rate via SNAPSHOTS: hver skann lagrer SUM(occurrence_count) + differansen
-- mot forrige snapshot = antall nye events i vinduet. Baseline = median av de
-- siste 24t deltaene → spike-deteksjon. anomaly_state debouncer varsler.
CREATE TABLE IF NOT EXISTS control_center_error_snapshots (
  id                  BIGSERIAL PRIMARY KEY,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_occurrences   BIGINT NOT NULL DEFAULT 0,   -- SUM(occurrence_count) hele error_log
  delta_occurrences   BIGINT NOT NULL DEFAULT 0,   -- nye events siden forrige snapshot
  unresolved_total    INTEGER NOT NULL DEFAULT 0,
  active_fingerprints INTEGER NOT NULL DEFAULT 0    -- distinkte feiltyper aktive i vinduet
);
CREATE INDEX IF NOT EXISTS idx_error_snapshots_time
  ON control_center_error_snapshots (captured_at DESC);

-- Debounce for varsler (én rad per anomali-nøkkel; «new:<fingerprint>» / «rate_spike»).
CREATE TABLE IF NOT EXISTS control_center_anomaly_state (
  anomaly_key      TEXT PRIMARY KEY,
  last_alerted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
