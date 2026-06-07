-- 232_admin_system_events.sql
-- Task #116: Bytt admin-monitoring/protocol stubs med ekte system-events.
--
-- `system_events`-tabellen finnes allerede fra 0001_loose_kulan_gath.sql:
--   id, timestamp, severity, category, source, message, details,
--   resolved, alerts_sent, metadata, created_at, updated_at
--
-- Denne migrasjonen er idempotent og:
--   1) sørger for hjelpe-indekser slik at admin-listene blir raske
--   2) seeder noen demo-events (kun hvis tabellen er helt tom) så
--      MonitoringTab har noe å rendre på et nytt miljø.
--
-- Vi lager IKKE alert_rules / alert_channels / monitoring_protocols her;
-- de håndteres som default-katalog i admin-protocol-routes / admin-monitoring-routes
-- inntil reell konfigurasjons-persistens trengs.

CREATE INDEX IF NOT EXISTS system_events_timestamp_idx
  ON system_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS system_events_severity_idx
  ON system_events (severity, timestamp DESC);

CREATE INDEX IF NOT EXISTS system_events_category_idx
  ON system_events (category, timestamp DESC);

-- Seed kun hvis tabellen er tom — på den måten ødelegger ikke migrasjonen
-- ekte produksjonsdata når den kjøres på et eldre miljø.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM system_events LIMIT 1) THEN
    INSERT INTO system_events
      (severity, category, source, message, details, resolved)
    VALUES
      ('info', 'lifecycle', 'backend',
       'Backend started', '{"phase":"boot"}'::jsonb, true),
      ('info', 'lifecycle', 'migrator',
       'Migration 232_admin_system_events applied',
       '{"migration":"232_admin_system_events.sql"}'::jsonb, true),
      ('info', 'auth', 'auth-service',
       'Admin login successful', '{"role":"admin"}'::jsonb, true),
      ('warning', 'api', 'api/role-room',
       'Latency spike observed (p95 > 800ms)',
       '{"endpoint":"/api/role-room/projects","p95_ms":842}'::jsonb, false),
      ('info', 'queue', 'worker',
       'Job queue drained', '{"jobs":12}'::jsonb, true);
  END IF;
END $$;
