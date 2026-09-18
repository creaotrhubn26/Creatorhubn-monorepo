-- 0617_marketing_plan_posts_author_urn.sql
-- Markedssjef-modus fase 1c: hvem posten ble publisert SOM på LinkedIn —
-- urn:li:person:<memberId> eller urn:li:organization:<id>. Avgjør hvilken
-- statistikk-vei KPI-connectoren kan bruke (bedriftsposter kan leses via
-- organizationalEntityShareStatistics; personposter kan ikke leses fordi
-- r_member_social er stengt for nye søkere).
--
-- Rent additivt.

ALTER TABLE role_room_marketing_plan_posts
  ADD COLUMN IF NOT EXISTS published_author_urn TEXT;
