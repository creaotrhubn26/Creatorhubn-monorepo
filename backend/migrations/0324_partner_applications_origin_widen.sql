-- 0324_partner_applications_origin_widen.sql
-- 'origin' var VARCHAR(20). Utvidet til 40 for å støtte
-- 'developer_self_application' (27 tegn).
ALTER TABLE partner_applications ALTER COLUMN origin TYPE VARCHAR(40);
