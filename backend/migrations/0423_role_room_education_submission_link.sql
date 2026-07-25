-- 0423_role_room_education_submission_link.sql
-- Utdannings-workspace: EKTE innlevering — studenten leverer en lenke til
-- arbeidet sitt (video/Drive/produksjonen). Tidligere var «levert» bare en
-- status faglærer huket av. Nå kan studenten selv levere via sin isolerte sesjon.

ALTER TABLE role_room_education_submissions
  ADD COLUMN IF NOT EXISTS link TEXT;
