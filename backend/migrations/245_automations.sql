-- 245_automations.sql
--
-- Real automations-tabell + automation_runs-historikk for AdminDashboard
-- "Lab" → automations-fanen. Erstatter stub-respons fra
-- admin-automations-routes.ts med ekte data.
--
-- Tabellene er bevisst minimal-skjema (samme felter som routes-laget
-- forventer) slik at vi kan utvide trigger_config / action_config uten
-- migrasjons-runder.

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
    -- 'cron' | 'webhook' | 'event' | 'manual'
  trigger_config JSONB DEFAULT '{}'::jsonb,
    -- For cron: { schedule: '0 3 * * *' }
    -- For event: { eventType: 'user.signup' }
  action_type TEXT NOT NULL,
    -- 'send_email' | 'http_call' | 'db_update' | 'notification' | 'script'
  action_config JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
    -- 'success' | 'failed' | 'running'
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
    -- 'running' | 'success' | 'failed'
  output JSONB,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS automation_runs_automation_idx
  ON automation_runs (automation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS automations_enabled_idx
  ON automations (is_enabled);

-- Seed 2 demo-automations slik at fanen viser meningsfullt innhold
-- også før noen er konfigurert manuelt.
INSERT INTO automations (
  name, description, trigger_type, trigger_config,
  action_type, action_config, is_enabled
)
VALUES
  (
    'Daily backup sweep',
    'Sjekker B2 backups hver morgen',
    'cron',
    '{"schedule":"0 3 * * *"}'::jsonb,
    'http_call',
    '{"url":"/api/internal/b2-archive/cron/business-plan"}'::jsonb,
    FALSE
  ),
  (
    'Welcome email on signup',
    'Sender velkomst-mail når ny bruker registrerer seg',
    'event',
    '{"eventType":"user.signup"}'::jsonb,
    'send_email',
    '{"template":"welcome"}'::jsonb,
    FALSE
  )
ON CONFLICT DO NOTHING;
