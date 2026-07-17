-- 332_control_center_health_checks.sql
--
-- CreatorHub Control Center — Fase 3 (byggeplanen): health-pings.
--
-- Cockpiten kjører aktive helsesjekker mot de indre tjenestene (API, database,
-- betaling, frontend, opplasting, realtime, workers). Hvert sample lagres her
-- slik at «Oppetid» (opp-andel siste 30d) og p95-svartid kan regnes ut fra
-- FAKTISKE observasjoner — ikke syntetisk.
--
-- MERK: samples akkumuleres mens en super_admin ser på cockpiten (45s-polling).
-- En dedikert bakgrunns-cron for 24/7-dekning er en valgfri Fase 3.1-oppfølger;
-- inntil da er oppetid/p95 ærlig merket som «basert på registrerte samples».
--
-- KUN LESE/PROBE genererer disse radene (SELECT 1, HEAD, GET balance) — ingen
-- mutasjon av tjeneste-tilstand.

CREATE TABLE IF NOT EXISTS control_center_health_checks (
  id          BIGSERIAL PRIMARY KEY,
  service     TEXT NOT NULL,                    -- 'api'|'database'|'payments'|'frontend'|'uploads'|'realtime'|'workers'
  status      TEXT NOT NULL,                    -- 'up'|'degraded'|'down'|'not_configured'|'unknown'
  latency_ms  INTEGER,                          -- null når ikke målt (not_configured)
  detail      TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uptime/p95-spørringer filtrerer pr. tjeneste over et tidsvindu, nyeste først.
CREATE INDEX IF NOT EXISTS idx_cc_health_service_time
  ON control_center_health_checks (service, checked_at DESC);
