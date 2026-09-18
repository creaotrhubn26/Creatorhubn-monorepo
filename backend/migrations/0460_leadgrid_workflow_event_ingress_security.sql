-- 0460_leadgrid_workflow_event_ingress_security.sql
-- Defines the two event-specific permissions accepted from user sessions.
-- No non-admin role is granted either permission by default. An organization
-- admin must grant them explicitly through user_permission_overrides.

BEGIN;

INSERT INTO permissions (key, category, description) VALUES
  ('workflow_events.meeting_booked', 'Workflows', 'Registrere kanonisk møte-booket-event'),
  ('workflow_events.meeting_no_show', 'Workflows', 'Registrere kanonisk møte-ikke-møtt-event')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

COMMIT;
