-- 0644_narrative_playtest.sql
-- Story Graph Fase 8e — spilltest-telemetri: spillet (iPad/Swift, standalone-spiller, JS-pakke)
-- sender hendelser per scene (enter/exit/choice/checkpoint/death/complete/custom) til et
-- alltid-204-inntak, autentisert med et prosjekt-token som lagres hashet (sha256), som
-- capture-client-tokens. Aggregatet (økter, drop-off, median tid, dødsfall, valgfordeling)
-- vises på scenekortets Spilltest-fane og som hjem-KPI.
--
-- Personvern: ingen PII. Kun scenekode, hendelse, tid, build, device-klasse og en
-- klientvalgt sesjons-id (tilfeldig, ikke bruker-id). Retensjon 90 dager (slettes av
-- narrative-maintenance / manuelt: DELETE ... WHERE received_at < now() - interval '90 days').
-- Konvensjoner som 0618/0643: TEXT-id med prefiks, project_id FK CASCADE, navngitte CHECKs.

CREATE TABLE IF NOT EXISTS narrative_playtest_tokens (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  event_count BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT chk_narrative_playtest_tokens_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS idx_narrative_playtest_tokens_project ON narrative_playtest_tokens (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS narrative_playtest_events (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL REFERENCES narrative_playtest_tokens(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id TEXT NOT NULL,
  build TEXT NOT NULL DEFAULT '',
  device_class TEXT NOT NULL DEFAULT '',
  scene_code TEXT NOT NULL,
  event TEXT NOT NULL,
  t_ms INTEGER,
  connection_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_narrative_playtest_events_event
    CHECK (event IN ('enter', 'exit', 'choice', 'checkpoint', 'death', 'complete', 'custom')),
  CONSTRAINT chk_narrative_playtest_events_t_ms CHECK (t_ms IS NULL OR t_ms >= 0)
);
CREATE INDEX IF NOT EXISTS idx_narrative_playtest_events_scene ON narrative_playtest_events (project_id, scene_code, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_playtest_events_session ON narrative_playtest_events (project_id, session_id, received_at);
CREATE INDEX IF NOT EXISTS idx_narrative_playtest_events_received ON narrative_playtest_events (received_at);
