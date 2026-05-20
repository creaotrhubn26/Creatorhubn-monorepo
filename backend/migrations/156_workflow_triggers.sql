-- Slice 9X.79 — Event-baserte SmartFlyt-triggere
--
-- Stine kan si "kjør 'Klient onboarding' når ny submission mottas" og
-- workflow starter automatisk uten manuell knapp. Pluss valgfri
-- conditions (f.eks. project_type = 'wedding').

CREATE TABLE IF NOT EXISTS workflow_triggers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  profession      TEXT,
  event_type      TEXT NOT NULL,
  conditions      JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  last_run_id     UUID,
  trigger_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workflow_id, user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_event
  ON workflow_triggers (event_type, enabled)
  WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_user
  ON workflow_triggers (user_id);
