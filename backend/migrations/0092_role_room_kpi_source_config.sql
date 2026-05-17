-- 0092_role_room_kpi_source_config.sql
-- Per-prosjekt konfigurasjon for KPI-datakilder (GA4-property-id,
-- GBP-location-id, YouTube-channel-id, etc.). Disse er IDs som er
-- ufarlige å lekke (i motsetning til access-tokens som ligger i
-- role_room_access_vault_secrets eller plattform-spesifikke
-- connection-tabeller).
--
-- Hvorfor egen tabell:
--   - Vault er for hemmeligheter (passord, tokens). Property-IDs er
--     bare pekere — feil tabell-formål.
--   - Hver KPI-fetch trenger BÅDE token (vault/connection) OG config-
--     verdi (denne tabellen) — adskillelse gir tydeligere domene.
--   - last_test_result lar UI rendre "✓ Verifisert 2 timer siden" /
--     "✗ Test feilet: invalid_property_id"
--
-- Designvalg:
--   - (project_id, platform, config_key) er UNIQUE — én row per
--     "GA4-property-id for prosjekt X" osv. Ved gjentakelse upsert.
--   - config_value er TEXT, ikke JSONB. De fleste verdier er
--     enkle strings (IDs, URLs). For multi-felt-config bruker vi
--     flere rows (config_key = 'property_id', 'view_id', etc.)
--     i stedet for en JSONB-blob — gjør validering enklere.
--   - last_test_result inneholder full struktur fra test-endpoint
--     (timestamp, success, error-message). JSONB her er greit fordi
--     formatet varierer per platform.

CREATE TABLE IF NOT EXISTS role_room_kpi_source_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'google_analytics',
    'google_business',
    'google_search_console',
    'youtube',
    'meta_business',
    'instagram',
    'facebook',
    'linkedin',
    'tiktok'
  )),
  config_key TEXT NOT NULL,
  config_value TEXT NOT NULL,
  -- Label til UI: 'Hovednettside', 'Oslo-restauranten', etc.
  display_label TEXT,
  -- Hvem la inn verdien (audit). Default null hvis system-skrevet.
  set_by_user_id TEXT,
  -- Sist vellykket validert (test-endpoint pinget API'et og fikk 200).
  validated_at TIMESTAMPTZ,
  -- Siste test-resultat: { success, timestamp, error?, sample? }
  last_test_result JSONB,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, platform, config_key)
);

CREATE INDEX IF NOT EXISTS role_room_kpi_source_config_project_idx
  ON role_room_kpi_source_config (project_id, platform);
CREATE INDEX IF NOT EXISTS role_room_kpi_source_config_validated_idx
  ON role_room_kpi_source_config (validated_at);

COMMENT ON TABLE role_room_kpi_source_config IS
  'Per-prosjekt KPI-datakilde-konfigurasjon (property/location/channel-IDs). Ikke-hemmelige verdier — for hemmeligheter bruk role_room_access_vault_secrets.';
COMMENT ON COLUMN role_room_kpi_source_config.last_test_result IS
  'Siste API-verifisering: { success: bool, timestamp: ISO, error?: string, sample?: any }. UI bruker for å vise sist-verifisert-status.';
