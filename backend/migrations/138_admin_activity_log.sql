-- Migration 138: admin_activity_log
--
-- Append-only endringshistorikk for Admin Room-entiteter. Brukes til
-- IN-søknad-revisjons-spor og generell oversikt over hva som ble
-- gjort når. Email-låst per user_id, ingen modifikasjon etter create.

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  entity_type varchar NOT NULL,    -- 'funding_app' | 'investor' | 'partner' | 'business_plan' | 'deck' | 'deck_slide'
  entity_id varchar,                -- NULL for entity-uavhengige events
  action varchar NOT NULL,          -- 'created' | 'updated' | 'deleted' | 'generated' | 'status_change'
  summary varchar,                  -- kort menneske-lesbar beskrivelse
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_activity_log_user_idx
  ON admin_activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_activity_log_entity_idx
  ON admin_activity_log (user_id, entity_type, entity_id, created_at DESC);
