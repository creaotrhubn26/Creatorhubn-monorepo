-- Migration 149: casting_ai_suggestions
--
-- AI Suggestion System — substratet som alle AI-funksjoner i The Role Room
-- bygges på. Hver agent (breakdown, casting-stub, idea-structure, shot-list,
-- coverage, editor) produserer forslag i denne tabellen, aldri direkte
-- mutasjon av hoveddata.
--
-- Se frontend/client/src/components/role-room/ai-suggestion-architecture.md
-- for arkitekturbeslutninger (AD-001 ... AD-006), state machine, og
-- testing-strategi.
--
-- Designprinsipper som er materialisert i schemaet:
--   AD-001  Unified tabell, polymorf via suggestion_type + source_type
--   AD-002  Forslag er immutable bortsett fra status/review/apply-felter
--   AD-003  generate → accept → apply som tre separate operasjoner
--   AD-004  Confidence drives UI, ikke filtrering — alle nivåer lagres
--   AD-006  source_type/source_id uten FK (polymorf)

CREATE TABLE IF NOT EXISTS casting_ai_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL,

  -- Klassifisering og innhold
  suggestion_type VARCHAR(64) NOT NULL,
  payload         JSONB NOT NULL,

  -- Polymorf kilde (scene | role | manuscript | project)
  source_type     VARCHAR(32) NOT NULL,
  source_id       UUID NOT NULL,

  -- Lineage — hvilken agent + modell genererte forslaget
  agent_name      VARCHAR(64) NOT NULL,
  model_version   VARCHAR(64) NOT NULL,
  parent_suggestion_id UUID,

  -- Sikkerhet/confidence
  confidence      NUMERIC(3,2) NOT NULL,

  -- Lifecycle: pending → accepted → applied (eller rejected/superseded)
  status          VARCHAR(16) NOT NULL DEFAULT 'pending',

  -- Review-audit
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,

  -- Anvendelses-audit (når applier materialiserer forslaget i hoveddata)
  applied_at      TIMESTAMPTZ,
  applied_result  JSONB,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT casting_ai_suggestions_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0),
  CONSTRAINT casting_ai_suggestions_status_valid
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded', 'applied')),
  CONSTRAINT casting_ai_suggestions_source_type_valid
    CHECK (source_type IN ('scene', 'role', 'manuscript', 'project'))
);

-- Hot path: vis pending-forslag for ett prosjekt, høyest confidence først
CREATE INDEX IF NOT EXISTS casting_ai_suggestions_project_status_idx
  ON casting_ai_suggestions (project_id, status, confidence DESC, created_at DESC);

-- Vis forslag knyttet til en spesifikk scene/rolle/manuskript
CREATE INDEX IF NOT EXISTS casting_ai_suggestions_source_idx
  ON casting_ai_suggestions (source_type, source_id, status);

-- Agent-drift over tid (accept-rate-rapporter, modellbytte-evaluering)
CREATE INDEX IF NOT EXISTS casting_ai_suggestions_agent_model_idx
  ON casting_ai_suggestions (agent_name, model_version, created_at DESC);

-- Lineage-traversering når et forslag erstatter et tidligere
CREATE INDEX IF NOT EXISTS casting_ai_suggestions_parent_idx
  ON casting_ai_suggestions (parent_suggestion_id)
  WHERE parent_suggestion_id IS NOT NULL;

-- Trigger for updated_at — matcher mønstret i andre casting_*-tabeller
CREATE OR REPLACE FUNCTION casting_ai_suggestions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS casting_ai_suggestions_updated_at_trg ON casting_ai_suggestions;
CREATE TRIGGER casting_ai_suggestions_updated_at_trg
  BEFORE UPDATE ON casting_ai_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION casting_ai_suggestions_set_updated_at();

COMMENT ON TABLE casting_ai_suggestions IS
  'AI Suggestion System — alle AI-genererte forslag persisteres her med lineage og review-audit. Se ai-suggestion-architecture.md.';
