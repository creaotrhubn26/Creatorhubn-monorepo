-- 0451_marketing_tactic_findings.sql
-- Merkevare/taktikk-analyse for Marketing mode (Post Agent Demo Studio).
--
-- Lagrer hvert "Analyser merkevare & taktikk"-kall: input-siden, Claudes
-- rå funn, og bruker sin accept/reject/rediger-handling per funn. Dette
-- er data-grunnlaget for en fremtidig fase-3 klassifikator (ikke bygget
-- her), og cachen som lar identisk/lignende sider gjenbruke tidligere
-- funn i stedet for et nytt Claude-kall (se marketing-tactic-cache.ts).
--
-- Cache er bevisst IKKE bruker-scoped (til forskjell fra
-- role_room_reference_frames sin owner_user_id) — target-sidene er
-- offentlige nettsider, og gjenbruk på tvers av brukere er poenget.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS marketing_tactic_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL,
  page_text_snapshot text NOT NULL,
  raw_findings jsonb NOT NULL,
  user_feedback jsonb,
  embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS marketing_tactic_findings_embedding_idx
  ON marketing_tactic_findings
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS marketing_tactic_findings_domain_idx
  ON marketing_tactic_findings (domain);
