-- 207_marketing_plan_last_edited.sql
-- Per-rad-audit for markedsplan-posts og -pillars.
--
-- I dag sporer vi hvem som har generert hver versjon, men ikke hvem
-- som sist endret en spesifikk post eller pillar mellom versjoner.
-- Etter denne migrasjonen kan Markedsplan-dashboardet vise
-- "Sist endret av Bjarne · 2t siden" pr rad i tabellen.

ALTER TABLE role_room_marketing_plan_posts
  ADD COLUMN IF NOT EXISTS last_edited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

ALTER TABLE role_room_marketing_plan_pillars
  ADD COLUMN IF NOT EXISTS last_edited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

COMMENT ON COLUMN role_room_marketing_plan_posts.last_edited_by_user_id IS
  'Settes ved PATCH /marketing-plan/posts/:postId — peker på Bjarne eller team-medlemmet som sist endret raden.';
COMMENT ON COLUMN role_room_marketing_plan_pillars.last_edited_by_user_id IS
  'Settes ved PATCH eller POST på pillar — sporer hvem som sist endret raden.';
