-- 0391_morning_briefs.sql
-- JARVIS J1: butlerens morgenbrief — én per org per dag, generert etter
-- detektorkjøringen. Lagres så panelet (og senere e-post) leser samme
-- tekst, og så historikken kan leses tilbake.

CREATE TABLE IF NOT EXISTS morning_briefs (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brief_date      DATE NOT NULL,
  content         TEXT NOT NULL,
  facts           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- 'generated' = LLM m/ siterings-validering; 'quiet' = deterministisk
  -- stille-natt-melding (ingen tokens brukt)
  kind            VARCHAR(12) NOT NULL CHECK (kind IN ('generated','quiet')),
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, brief_date)
);
