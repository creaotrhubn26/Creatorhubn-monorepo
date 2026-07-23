-- Control Center · secret-/utløpsvakt (proaktiv drift, «i forkant»).
--
-- Én rad per overvåket nøkkel (upsert på secret_key). Runner-en (control-center-
-- secret-watch.ts) prober gyldighet + (der API-et avslører det, f.eks. GitHub-
-- PAT via `github-authentication-token-expiration`-header) utløpsdato daglig,
-- og varsler super_admin FØR en nøkkel utløper/blir rotert-vekk. `last_alert_
-- status` styrer at vi kun varsler ved forverring/gjenoppretting (ikke spam).
CREATE TABLE IF NOT EXISTS control_center_secret_status (
  secret_key         TEXT PRIMARY KEY,
  label              TEXT NOT NULL,
  status             TEXT NOT NULL,          -- ok | expiring | invalid | error | not_configured
  http_status        INTEGER,
  expires_at         TIMESTAMPTZ,            -- null når API-et ikke avslører utløp
  days_left          INTEGER,                -- null når ukjent
  message            TEXT,
  checked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_alert_status  TEXT                    -- siste status vi varslet på (transisjons-styring)
);

CREATE INDEX IF NOT EXISTS idx_secret_status_checked
  ON control_center_secret_status (checked_at DESC);
