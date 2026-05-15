-- 152_dance_formation_transition_paths.sql
-- F5-13B: per-formation bezier-baner mellom denne formasjonen og neste,
-- én entry per danser. Brukes når koreografen har tegnet en eksplisitt
-- kurve i curve-tool — overstyrer den auto-interpolerte rette linjen.
--
-- Format (jsonb-array):
--   [
--     { "dancerId": "dnc-1", "controlPoints": [{"x":0.4,"y":0.3}, {"x":0.6,"y":0.7}] },
--     { "dancerId": "dnc-2", "controlPoints": [...] }
--   ]
--
-- controlPoints = de TO interne bezier-kontroll-punktene (start- og slutt-
-- anker hentes fra formation.positions hhv. neste formasjon.positions).

ALTER TABLE dance_formation
  ADD COLUMN IF NOT EXISTS transition_paths JSONB NOT NULL DEFAULT '[]'::jsonb;
