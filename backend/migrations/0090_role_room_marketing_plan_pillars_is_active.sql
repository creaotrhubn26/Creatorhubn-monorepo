-- 0090_role_room_marketing_plan_pillars_is_active.sql
-- Items #142 (inline edit), #144 (add custom pillar), #145 (toggle active).
-- Vi trenger is_active så brukeren kan slå av en pillar uten å miste data,
-- og en is_custom-flagg så UI kan vise "lagt til manuelt"-merket og slik
-- skille AI-genererte pillars fra manuelle.

ALTER TABLE role_room_marketing_plan_pillars
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE role_room_marketing_plan_pillars
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN role_room_marketing_plan_pillars.is_active IS
  'Når FALSE, ekskluderes pillaren fra post-generering og UI-rendering, men data bevares for å kunne re-aktiveres senere.';
COMMENT ON COLUMN role_room_marketing_plan_pillars.is_custom IS
  'TRUE for pillars lagt til manuelt av brukeren (#144). FALSE for AI-genererte pillars. UI markerer manuelle som "egendefinert".';
