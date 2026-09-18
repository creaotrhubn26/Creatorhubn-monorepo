-- 0645_game_plan_fase8_features.sql
-- Story Graph Fase 8g — nye plan-funksjoner for Studio: `ci_evidence` (CI-bevis-webhook, 8c)
-- og `playtest_telemetry` (spilltest-tokens, 8e). Frem til nå har begge vært ugatet (dokumentert
-- i produktplanen); fra nå gates opprettelse av hooks/tokens på Studio-planen. Eksisterende hooks
-- og tokens fortsetter å virke (webhook/inntak sjekker ikke plan — bare hemmelighet/token).
-- Muterer KUN features med jsonb-merge (mønster 0622); priser/limits beholdes.

UPDATE game_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'ci_evidence'
           UNION SELECT 'playtest_telemetry'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug = 'studio'
   AND NOT (features @> '["ci_evidence", "playtest_telemetry"]'::jsonb);
