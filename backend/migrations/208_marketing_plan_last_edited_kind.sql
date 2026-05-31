-- 208_marketing_plan_last_edited_kind.sql
-- Markedsplanen er nå en shared workspace — både produsent og klient
-- (klient_reviewer-rollen) kan redigere posts. For at det skal være
-- klart hvem som endret hva, sporer vi rolle-typen ved hver edit.
--
-- 'team'  = produsent eller intern team-bruker (producer, director,
--           content_producer, user)
-- 'client'= klient (client_reviewer) som redigerer fra sin Markedsplan-
--           fane i ClientWorkspaceShell

ALTER TABLE role_room_marketing_plan_posts
  ADD COLUMN IF NOT EXISTS last_edited_by_kind TEXT
    CHECK (last_edited_by_kind IN ('team', 'client'));

ALTER TABLE role_room_marketing_plan_pillars
  ADD COLUMN IF NOT EXISTS last_edited_by_kind TEXT
    CHECK (last_edited_by_kind IN ('team', 'client'));

COMMENT ON COLUMN role_room_marketing_plan_posts.last_edited_by_kind IS
  'Sporer om sist redigering var fra team (produsent) eller klient — UI bruker dette til å vise riktig farget badge.';
