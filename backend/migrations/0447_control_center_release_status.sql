-- 0447: Control Center release-vakt (Documentation Intelligence release-monitor)
-- Én rad per overvåket leverandør-flate; versjons-transisjon styrer varsling.

CREATE TABLE IF NOT EXISTS control_center_release_status (
  watch_key            text PRIMARY KEY,
  label                text NOT NULL,
  status               text NOT NULL,           -- ok | updated | error
  version              text,                    -- sist observerte versjon/tittel
  url                  text,                    -- lenke til release/kilde
  message              text,
  checked_at           timestamptz NOT NULL DEFAULT now(),
  last_notified_version text                    -- versjonen vi sist varslet om
);

CREATE INDEX IF NOT EXISTS idx_ccrs_checked_at
  ON control_center_release_status (checked_at DESC);
