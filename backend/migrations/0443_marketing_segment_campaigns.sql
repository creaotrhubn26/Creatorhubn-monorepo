-- 0443_marketing_segment_campaigns.sql
--
-- Fase 4 (attribusjon per segment): lenken segment → annonsekampanje. Når en
-- kampanje som targeter et segments audience kobles hit, kan ROAS/spend fra
-- ads_attribution_daily rulles opp til segment-nivå («hvilket segment gir best
-- avkastning»). Lenken opprettes eksplisitt (admin kobler en eksisterende
-- kampanje) — ingen live kampanje-oppretting/annonsekjøp fra broen.
--
-- NB: servicen self-healer tabellen lazily (ensureTables) — denne fila er den
-- kanoniske skjemadefinisjonen.

CREATE TABLE IF NOT EXISTS marketing_segment_campaigns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id   UUID NOT NULL REFERENCES marketing_segments(id) ON DELETE CASCADE,
  campaign_id  UUID NOT NULL REFERENCES ads_campaigns(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (segment_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_segment_campaigns_segment
  ON marketing_segment_campaigns (segment_id);
CREATE INDEX IF NOT EXISTS idx_marketing_segment_campaigns_campaign
  ON marketing_segment_campaigns (campaign_id);
