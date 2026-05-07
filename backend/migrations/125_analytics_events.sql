-- analytics_events: unified event log som binder alle CreatorHub-
-- systemer sammen. Photo Enhancer, Showcase-galleri, Capture-sessions,
-- Project-status-transitions, Stripe-betalinger — alle skriver hit.
-- BI-laget leser herfra istedenfor å forene siloer per query.
--
-- Design:
--   • entity_type+entity_id som loose foreign-key så vi kan logge
--     hendelser for ressurser uten å kreve sterk schema-binding.
--   • actor_user_id eier event'en (photographer som utløste). NULL ved
--     system-events (cron, webhooks).
--   • metadata JSONB tar event-spesifikk payload (amount, currency,
--     gallery_id, project_id, etc).
--   • created_at indeksert for tidsserie-queries.
--   • (entity_type, entity_id) indeksert for "alle hendelser for X".
--   • (actor_user_id, created_at DESC) for "min aktivitet siste 7d".

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32),
  entity_id VARCHAR(64),
  actor_user_id VARCHAR(64),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
  ON analytics_events (created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_entity_idx
  ON analytics_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_actor_idx
  ON analytics_events (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_type_idx
  ON analytics_events (event_type, created_at DESC);

-- GIN på metadata for ad-hoc queries ("alle events der payment-amount > 1000")
CREATE INDEX IF NOT EXISTS analytics_events_metadata_gin
  ON analytics_events USING GIN (metadata jsonb_path_ops);
