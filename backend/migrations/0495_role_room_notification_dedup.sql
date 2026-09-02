-- 0495_role_room_notification_dedup.sql
--
-- One logical producer-inbox event must map to one row. The application uses
-- this exact expression key in INSERT .. ON CONFLICT, eliminating the former
-- SELECT-then-INSERT race and preventing duplicate notifications.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0495_role_room_notification_dedup'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_rr_project_notifications_logical_event
  ON role_room_project_notifications (
    project_id,
    audience,
    event_type,
    (COALESCE(linked_entity_type, '')),
    (COALESCE(linked_entity_id, ''))
  );

COMMIT;
