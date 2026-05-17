-- 0088_role_room_research_versions.sql
-- Server-side researchVersion + full historikk per prosjekt (item #15
-- proper-fix). Dropper localStorage-basert versjons-counter til fordel
-- for en server-source-of-truth som er delt på tvers av nettlesere/team-
-- medlemmer. Låser også opp ekte server-side diff (#9 proper-fix) der
-- man kan sammenligne to vilkårlige versjoner, ikke bare "siste vs.
-- forrige i denne nettleseren".

CREATE TABLE IF NOT EXISTS role_room_research_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  research_id UUID NOT NULL UNIQUE,    -- matches generateRoleRoomAgentProducerBootstrap's researchId
  version_number INT NOT NULL,         -- 1, 2, 3... per project, never gaps
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by TEXT,                    -- userId / email / null for system runs
  -- Hele bootstrap-resultatet. JSONB lar oss filter/index på kolonner som
  -- companyProfile.industry uten å trekke ut hele payloadet, og er
  -- backwards-compatible med fremtidige felt-utvidelser.
  serialized_result JSONB NOT NULL,
  -- Kopier av instrumenterings-bagene. Lagres flatt så vi kan filtre på
  -- "alle research som hadde claude_synthesis > 5s" eller "alle som
  -- brukte cohere-rerank" uten å parse serialized_result hver gang.
  service_latencies JSONB,
  fallbacks_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  total_ms INT,
  provider TEXT,                        -- 'openai' | 'anthropic' | 'fallback'
  model TEXT,
  -- Sikrer at version_number er unik per project_id selv ved race
  -- conditions (to bootstrap-kall som lander samtidig). Insert bruker
  -- (SELECT MAX + 1) — denne UNIQUE-constrainten kicker hvis to
  -- transaksjoner havner på samme nummer, og vi retry-er.
  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS role_room_research_versions_project_idx
  ON role_room_research_versions (project_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS role_room_research_versions_project_version_idx
  ON role_room_research_versions (project_id, version_number DESC);

COMMENT ON TABLE role_room_research_versions IS
  'Persistert historikk over hver bootstrap-kjøring per prosjekt. Erstatter localStorage-baserte versjons-counter; gir multi-bruker/multi-device versjons-konsistens og backend-source for ekte cross-version diff.';
COMMENT ON COLUMN role_room_research_versions.version_number IS
  'Monotonisk økende per project_id, starter på 1. Aldri gaps — re-genereres ikke hvis en row slettes.';
