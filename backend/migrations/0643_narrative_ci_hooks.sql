-- 0643_narrative_ci_hooks.sql
-- Story Graph Fase 8c — CI-bevis-webhook: spillbygget (Xcode/CI) setter leveransegater
-- med bevis via en HMAC-signert webhook, i stedet for at «bestått» settes for hånd.
--
-- Modell:
--   • narrative_ci_hooks: én hemmelighet per hook (klartekst — HMAC trenger råhemmeligheten,
--     samme valg som leadgrid-workflow-webhooks). Vises én gang i UI ved opprettelse.
--   • narrative_ci_deliveries: leveringslogg (siste N per prosjekt vises i Integrasjoner-fanen),
--     både anvendte og avviste (ukjent scene, gate uten bevis, ugyldig payload).
--   • Gate-skriving går gjennom setSceneGate(...) med checked_by = 'ci:<hookId>' — CHECK-en
--     «bestått krever bevis» (0624) gjelder også for CI.
--   • Bevis-artefakter (xcresult-zip, skjermbilder) lastes opp til S3 via narrative_assets
--     med storage_key (første reelle bruk av kolonnen fra 0618).
-- Konvensjoner som 0618/0624: TEXT-id med prefiks, project_id FK CASCADE, navngitte CHECKs.

CREATE TABLE IF NOT EXISTS narrative_ci_hooks (
  id TEXT PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  secret TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_delivery_at TIMESTAMPTZ,
  delivery_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT chk_narrative_ci_hooks_secret_len CHECK (length(secret) >= 32)
);
CREATE INDEX IF NOT EXISTS idx_narrative_ci_hooks_project ON narrative_ci_hooks (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS narrative_ci_deliveries (
  id TEXT PRIMARY KEY,
  hook_id TEXT NOT NULL REFERENCES narrative_ci_hooks(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  scene_code TEXT,
  gate_key TEXT,
  gate_status TEXT,
  error TEXT,
  commit_sha TEXT,
  run_url TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_narrative_ci_deliveries_status CHECK (status IN ('applied', 'rejected'))
);
CREATE INDEX IF NOT EXISTS idx_narrative_ci_deliveries_project ON narrative_ci_deliveries (project_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_narrative_ci_deliveries_hook ON narrative_ci_deliveries (hook_id, received_at DESC);

-- Bevis-artefakter er ikke bilde/lyd/video (xcresult-zip, logg, rapport) → ny kind 'file'.
-- Utvides som drop/recreate av den navngitte CHECK-en fra 0618 (samme mønster som 0623).
ALTER TABLE narrative_assets DROP CONSTRAINT IF EXISTS chk_narrative_assets_kind;
ALTER TABLE narrative_assets ADD CONSTRAINT chk_narrative_assets_kind
  CHECK (kind IN ('image', 'audio', 'video', 'file'));
