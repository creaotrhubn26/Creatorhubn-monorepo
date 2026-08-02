-- 0382_score_models.sql
-- Fase 3 (docs/integration-audit/11): konfigurerbare score-modeller.
--
-- Faktorene bor i kode (versjonert, testet); vektene og kommersiell verdi
-- er produktbeslutninger og bor her — redigerbare i UI uten deploy.
-- approved=false betyr at org-en fortsatt kjører på FORSLAGS-vektene og
-- UI-et skal merke scoren som utkast.

CREATE TABLE IF NOT EXISTS score_model_config (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_key       VARCHAR(60) NOT NULL,
  config          JSONB NOT NULL,
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, model_key)
);
