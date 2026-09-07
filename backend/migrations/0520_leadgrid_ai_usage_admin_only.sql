-- 0520_leadgrid_ai_usage_admin_only.sql
-- AI-kost inneholder workspace-spesifikke kostnadsdata og følger samme
-- tilgangsmodell som faktura og betalingsadministrasjon.
BEGIN;

DELETE FROM role_permissions
 WHERE role = 'salgssjef'
   AND permission_key = 'billing.view_ai_usage';

COMMIT;
