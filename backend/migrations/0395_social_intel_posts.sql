-- 0395_social_intel_posts.sql
-- Synlighets-sløyfen: innsiktsdrevne poster i godkjennings-kø.
-- J3-regelen håndheves i skjemaet: kun status-overgangen
-- draft → approved → published (eller → rejected) er lovlig i koden;
-- ingenting publiseres uten menneskelig approved.

CREATE TABLE IF NOT EXISTS social_intel_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  solution        VARCHAR(20) NOT NULL CHECK (solution IN ('leadgrid','theroleroom','creatorhub')),
  platform        VARCHAR(20) NOT NULL,   -- 'linkedin' | 'instagram' | 'manual'
  body            TEXT NOT NULL,
  -- Faktagrunnlaget posten ble komponert fra — tall-validert mot dette
  facts           JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          VARCHAR(12) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','published','failed','rejected')),
  external_id     TEXT,
  external_url    TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at     TIMESTAMPTZ,
  published_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_social_intel_posts_org
  ON social_intel_posts (organization_id, status, created_at DESC);
