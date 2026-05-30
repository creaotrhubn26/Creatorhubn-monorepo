-- Lag 2: AI-anbefalinger om budsjettflytting + svake annonser å pause.
-- Genereres daglig av attribution-tick etter spend-sweep + auto-pause-sweep.
-- Erstatter forrige genering for samme (prosjekt, periode).

CREATE TABLE IF NOT EXISTS role_room_ads_recommendations (
  project_id text NOT NULL,
  period text NOT NULL, -- YYYY-MM
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_with_model text,
  recommendations jsonb NOT NULL,
  PRIMARY KEY (project_id, period)
);

CREATE INDEX IF NOT EXISTS idx_role_room_ads_recommendations_generated_at
  ON role_room_ads_recommendations (generated_at DESC);
