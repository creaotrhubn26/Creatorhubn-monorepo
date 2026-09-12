-- 0385_trigger_events.sql
-- Salgstriggere (trigger-basert salg): eksterne hendelser med tidsstempel
-- som åpner et salgsvindu — anbud publisert, strategisignal i media,
-- strategisk ansettelse. Rå hendelser lagres her (samle-laget);
-- sales-trigger-detektoren konverterer til innsikter med dedup.

CREATE TABLE IF NOT EXISTS trigger_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source          VARCHAR(20) NOT NULL,  -- 'ted' | 'gdelt' | 'doffin' | 'nav'
  event_id        TEXT NOT NULL,         -- kildens stabile id (dedup)
  kind            VARCHAR(24) NOT NULL CHECK (kind IN ('tender','strategy_media','hire')),
  title           TEXT NOT NULL,
  url             TEXT,
  published_at    DATE,
  matched_topic   TEXT NOT NULL,         -- vertikal/prompt-sett ELLER lead-navn
  raw             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_trigger_events_org_created
  ON trigger_events (organization_id, created_at DESC);
