-- 0380_workspace_design_tokens.sql
-- Design-tokens som DATA per workspace (CreatorHub Design). Merkevaren (farge/type/
-- spacing) lever i DB, ikke kode → justerings-knottene i editoren skrur på disse, og
-- render/konnektorer blir on-brand per produkt uten deploy.
--
-- 'global' = delt basis alle workspaces arver; produkt-rader overstyrer kun det de vil.
BEGIN;

CREATE TABLE IF NOT EXISTS workspace_design_tokens (
  workspace_id VARCHAR(40) PRIMARY KEY,
  tokens       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Basis (arves av alle). Nøytral blå + Inter.
INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES
  ('global', '{"accent":"#2f6df0","accentDark":"#2456c9","bgSoft":"#eef2fb","text":"#1f2d4a","fontFamily":"Inter, \"Helvetica Neue\", Helvetica, Arial, \"Liberation Sans\", sans-serif"}'::jsonb)
ON CONFLICT (workspace_id) DO NOTHING;

-- CreatorHub-merkevare (dokumentert: oransje #ff8c00 / navy).
INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES
  ('creatorhub', '{"accent":"#ff8c00","accentDark":"#e07b00","bgSoft":"#fff4e6"}'::jsonb)
ON CONFLICT (workspace_id) DO NOTHING;

-- Leadgrid (blå — samme som konnektor-default).
INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES
  ('leadgrid', '{"accent":"#2f6df0"}'::jsonb)
ON CONFLICT (workspace_id) DO NOTHING;

-- theroleroom arver 'global' inntil en admin setter egne tokens.

COMMIT;
