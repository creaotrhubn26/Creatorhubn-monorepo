-- 0383_insight_diagnosis.sql
-- Fase 2 (docs/integration-audit/10): diagnostikk-laget.
--
-- diagnosis JSONB på insights:
--   { status: 'generated', narrative, citations: [n,...], model, generatedAt }
--   { status: 'insufficient_evidence', reason, checkedAt }
-- Lagres også ved tynt grunnlag så daglig kjøring ikke re-forsøker
-- (og re-betaler) samme innsikt.

ALTER TABLE insights ADD COLUMN IF NOT EXISTS diagnosis JSONB;
