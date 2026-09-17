-- 0616_marketing_plan_posts_publish_state.sql
-- Markedssjef-modus fase 1b: en plan-post kan publiseres direkte til LinkedIn
-- fra /leadgrid/markedsforing (POST /marketing-plan/posts/:postId/publish).
-- Til nå ble published_at aldri skrevet, og posten hadde ingen kobling til
-- den eksterne posten. Disse kolonnene gjør publiseringstilstanden sporbar og
-- lar KPI-connectoren hente likes/kommentarer uten feed-planner-omveien.
--
-- Rent additivt. Role Room-flyten (accept → feed-planner) er uendret.

ALTER TABLE role_room_marketing_plan_posts
  ADD COLUMN IF NOT EXISTS external_post_id TEXT,
  ADD COLUMN IF NOT EXISTS external_permalink TEXT,
  ADD COLUMN IF NOT EXISTS published_platform TEXT,
  ADD COLUMN IF NOT EXISTS published_by_user_id TEXT,
  ADD COLUMN IF NOT EXISTS publish_error TEXT;

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_external_idx
  ON role_room_marketing_plan_posts (plan_id)
  WHERE external_post_id IS NOT NULL;
