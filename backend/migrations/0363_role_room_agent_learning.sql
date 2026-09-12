-- =====================================================================
-- mig 0363 — The Role Room Agent: kontinuerlig-lærings-loop (Lag 0 + 2a)
--
-- Bakgrunn (2026-07-03): agentens bootstrap-utkast lagres i
-- role_room_research_versions, men produsentens RETTEDE fasit (draft→final-
-- diff) fanges aldri server-side — den lever kun i frontendens state.
-- Uten den diffen er det ingenting å lære av.
--
-- To tabeller:
--   1. role_room_agent_field_feedback — gull-signalet: per felt produsenten
--      godtar/redigerer/fjerner, med DETERMINISTISK, ikke-personlig kontekst
--      (NACE, forretningsmodell, geo-scope, provenance) så aggregering kan
--      nøkle på det. Fritekst-verdier pseudonymiseres FØR insert (samme
--      pipeline som AI-kallene) og er samtykke-gated.
--   2. role_room_agent_learned_overrides — human-in-the-loop: nattlig
--      aggregering FORESLÅR overrides (status='proposed'); et menneske
--      godkjenner (status='approved') før runtime bruker dem. classifyByNace/
--      grounding leser KUN status='approved'.
--
-- Idempotent (IF NOT EXISTS).
-- =====================================================================

BEGIN;

-- --- Lag 0: gull-signalet ------------------------------------------------
CREATE TABLE IF NOT EXISTS role_room_agent_field_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id UUID NOT NULL,            -- matcher role_room_research_versions.research_id
  project_id TEXT NOT NULL,
  field_path TEXT NOT NULL,            -- f.eks. 'companyProfile.businessModel'
  action TEXT NOT NULL,               -- 'accepted' | 'edited' | 'cleared'
  -- Verdier. Fritekst pseudonymiseres FØR insert (buildBackendPseudonymMap).
  ai_value TEXT,
  final_value TEXT,
  -- Deterministisk, ikke-personlig kontekst som aggregering nøkler på:
  nace_code TEXT,
  business_model TEXT,
  geo_scope TEXT,
  source_chain TEXT[],
  confidence INT,                      -- 0-100 som AI-en rapporterte
  created_by TEXT,                     -- userId / email / null
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Én feedback-rad per felt per research; re-lagring oppdaterer (UPSERT).
  UNIQUE (research_id, field_path)
);

CREATE INDEX IF NOT EXISTS role_room_agent_field_feedback_field_idx
  ON role_room_agent_field_feedback (field_path, created_at DESC);
CREATE INDEX IF NOT EXISTS role_room_agent_field_feedback_nace_idx
  ON role_room_agent_field_feedback (nace_code)
  WHERE nace_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS role_room_agent_field_feedback_project_idx
  ON role_room_agent_field_feedback (project_id, created_at DESC);

COMMENT ON TABLE role_room_agent_field_feedback IS
  'Gull-signalet for lærings-loopen: produsentens draft→final-korreksjon per felt, med deterministisk ikke-personlig kontekst. Fritekst pseudonymiseres før insert; samtykke-gated.';

-- --- Lag 2a: human-in-the-loop overrides ---------------------------------
CREATE TABLE IF NOT EXISTS role_room_agent_learned_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_type TEXT NOT NULL,          -- 'nace_business_model' | 'confidence_calibration' | ...
  override_key TEXT NOT NULL,           -- f.eks. NACE-prefiks '70.10' eller confidence-bøtte '40-60'
  proposed_value TEXT NOT NULL,         -- f.eks. 'B2C'
  -- Bevis fra aggregeringen:
  sample_count INT NOT NULL DEFAULT 0,
  agreement_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed', -- 'proposed' | 'approved' | 'rejected'
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Én aktiv forslag/beslutning per (type, key). Nye aggregeringer UPSERT-er.
  UNIQUE (override_type, override_key)
);

CREATE INDEX IF NOT EXISTS role_room_agent_learned_overrides_status_idx
  ON role_room_agent_learned_overrides (override_type, status);

COMMENT ON TABLE role_room_agent_learned_overrides IS
  'Human-in-the-loop lærte overrides. Nattlig aggregering skriver status=proposed; menneske godkjenner (approved) før runtime (classifyByNace/grounding) bruker dem. Runtime leser KUN approved.';

COMMIT;
