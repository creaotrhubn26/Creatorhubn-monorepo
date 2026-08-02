-- 0383: AI-kostnadssporing for Leadbook-strukturering (2026-07-17).
-- Daniel: «det bør være oversikt over kostnader hvis den er aktivert» —
-- én rad per Claude-kall med token-forbruk og estimert kostnad, så ledere
-- ser hva AI-funksjonen faktisk koster org-en.

CREATE TABLE IF NOT EXISTS leadbook_ai_usage (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  feature TEXT NOT NULL DEFAULT 'structure',   -- rom for flere AI-flater senere
  model TEXT NOT NULL DEFAULT '',
  input_chars INT,
  input_tokens INT,
  output_tokens INT,
  cost_usd NUMERIC(10,6),                      -- estimat fra offisiell prisliste
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lb_ai_usage_org
  ON leadbook_ai_usage (organization_id, created_at DESC);
