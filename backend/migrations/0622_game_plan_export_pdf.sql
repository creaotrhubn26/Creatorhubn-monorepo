-- 0622_game_plan_export_pdf.sql
-- Ny feature `export_pdf` (lesbart manus som PDF) på Pro og Studio.
-- Muterer KUN features med jsonb-merge (mønster fra 0074_dance_plan_seed.sql);
-- admin-konfigurerte priser og limits beholdes. Solo får ikke featuren.

UPDATE game_plan
   SET features = (
         SELECT jsonb_agg(DISTINCT v) FROM (
           SELECT jsonb_array_elements_text(features) AS v
           UNION SELECT 'export_pdf'
         ) merged_features
       ),
       updated_at = now()
 WHERE slug IN ('pro', 'studio')
   AND NOT (features @> '["export_pdf"]'::jsonb);
