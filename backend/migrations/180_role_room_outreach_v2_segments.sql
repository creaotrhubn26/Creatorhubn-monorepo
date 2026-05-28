-- Outreach Plan v2 — korreksjon av segments i 179-seedede templates.
--
-- Migrasjon 179 satte inn 4 v2-templates med segments fra industry_targets-
-- listen (skuda, agency). Outreach-template-API-en har sin egen smalere
-- VALID_SEGMENTS-enum (casting_director, producer, union, institution,
-- press, agency, other). Det betyr at:
--   - skuda-noda-partnership (segment='skuda') ble seedet men kan ikke
--     filtreres til via API
--   - foto-no-affiliate (segment='agency') vises som agency-template som
--     er en upresis kategori for affiliate-partnerskap
--
-- v2 introduserer 2 nye kategorier i outreach-template-enum: 'dance' og
-- 'affiliate'. Backend VALID_SEGMENTS + frontend OutreachTemplateSegment
-- utvides parallelt med denne migrasjonen.

UPDATE role_room_outreach_templates
   SET segment = 'dance',
       updated_at = NOW()
 WHERE user_id IS NULL
   AND slug = 'skuda-noda-partnership';

UPDATE role_room_outreach_templates
   SET segment = 'affiliate',
       updated_at = NOW()
 WHERE user_id IS NULL
   AND slug = 'foto-no-affiliate';
