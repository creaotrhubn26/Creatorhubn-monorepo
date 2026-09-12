-- =====================================================================
-- 0377_geo_visibility.sql
--
-- GEO Visibility MVP (docs/integration-audit/08): syntetisk
-- prompt-probing av AI-motorer — «blir kunden anbefalt når noen spør
-- AI om løsninger i deres bransje?»
--
-- Additiv og reversibel (DROP de fire tabellene). Aggregater lagres i
-- normalized_signals (0376); disse tabellene er prompt-settene (produkt-
-- innhold som kunden godkjenner), kjørings-lineage og per-svar-resultater
-- som panelet trenger («hvilke temaer mangler du i»).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS geo_prompt_sets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_owner_user_id  VARCHAR(255) NOT NULL,
  project_id               TEXT,
  name                     TEXT NOT NULL,
  industry                 TEXT NOT NULL,
  region                   TEXT NOT NULL DEFAULT 'Norge',
  -- Merkevaren som måles + konkurrentene det måles mot
  target_brand             TEXT NOT NULL,
  target_domain            TEXT,
  competitor_brands        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- draft → approved (kunden har godkjent prompt-listen) → archived
  status                   VARCHAR(16) NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','approved','archived')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_prompt_sets_owner
  ON geo_prompt_sets (workspace_owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS geo_prompts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_set_id  UUID NOT NULL REFERENCES geo_prompt_sets(id) ON DELETE CASCADE,
  text           TEXT NOT NULL,
  -- Tema-gruppering ('pris', 'sammenlikning', 'hvordan-skaffe-leads', …) —
  -- blir topic i normalized_signals
  topic          TEXT NOT NULL,
  intent         VARCHAR(24) NOT NULL DEFAULT 'buying'
                 CHECK (intent IN ('buying','comparison','howto','local')),
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_geo_prompts_set
  ON geo_prompts (prompt_set_id, sort_order);

-- Sync-run-lineage (docs/integration-audit/05 §3)
CREATE TABLE IF NOT EXISTS geo_probe_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_set_id  UUID NOT NULL REFERENCES geo_prompt_sets(id) ON DELETE CASCADE,
  status         VARCHAR(16) NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running','completed','partial','failed')),
  engines        JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['anthropic','openai',…]
  prompts_total  INTEGER NOT NULL DEFAULT 0,
  answers_total  INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_geo_probe_runs_set
  ON geo_probe_runs (prompt_set_id, started_at DESC);

-- Per (prompt × motor)-resultat: hvilke merkevarer ble nevnt, ble target
-- nevnt, og i hvilken posisjon. answer_excerpt er kort utdrag for UI —
-- aldri hele svaret (plass + ingen grunn).
CREATE TABLE IF NOT EXISTS geo_probe_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES geo_probe_runs(id) ON DELETE CASCADE,
  prompt_id         UUID NOT NULL REFERENCES geo_prompts(id) ON DELETE CASCADE,
  engine            VARCHAR(32) NOT NULL,
  mentioned_brands  JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{name, rank}]
  cited_urls        JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_mentioned  BOOLEAN NOT NULL DEFAULT FALSE,
  target_rank       INTEGER,
  answer_excerpt    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, prompt_id, engine)
);

CREATE INDEX IF NOT EXISTS idx_geo_probe_results_run
  ON geo_probe_results (run_id);

COMMIT;
