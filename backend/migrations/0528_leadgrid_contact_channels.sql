-- 0528_leadgrid_contact_channels.sql
--
-- Preserve the actual confirmed external contact channel. Previously SMS and
-- WhatsApp were stored as generic phone visits, which made activity history
-- and reporting misleading. Existing rows remain valid.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE crm_visits
  DROP CONSTRAINT IF EXISTS crm_visits_visit_type_check;

ALTER TABLE crm_visits
  ADD CONSTRAINT crm_visits_visit_type_check
  CHECK (visit_type IN (
    'physical', 'phone', 'sms', 'whatsapp', 'email',
    'online_meeting', 'research'
  )) NOT VALID;

ALTER TABLE crm_visits
  VALIDATE CONSTRAINT crm_visits_visit_type_check;

ALTER TABLE crm_visits
  DROP CONSTRAINT IF EXISTS crm_visits_activity_kind_check;

ALTER TABLE crm_visits
  ADD CONSTRAINT crm_visits_activity_kind_check
  CHECK (activity_kind IS NULL OR activity_kind IN (
    'call', 'sms', 'whatsapp', 'email', 'meeting', 'note', 'visit',
    'demo', 'proposal', 'deal_close'
  )) NOT VALID;

ALTER TABLE crm_visits
  VALIDATE CONSTRAINT crm_visits_activity_kind_check;

COMMENT ON COLUMN crm_visits.visit_type IS
  'Confirmed interaction channel. SMS and WhatsApp are distinct from phone calls.';

COMMIT;
