-- 0367 declared project_id + sent_by as UUID, but Role Room project ids are TEXT
-- slugs (e.g. 'holy-crust-innholdsproduksjon-…') and user ids are TEXT across the
-- role_room tables. As-is, inserting a client update and the portal read
-- (WHERE project_id = <slug>) both fail with 'invalid input syntax for type
-- uuid'. Correct the column types. plan_id stays UUID (plan ids are uuids).

ALTER TABLE role_room_client_updates
  ALTER COLUMN project_id TYPE text USING project_id::text;

ALTER TABLE role_room_client_updates
  ALTER COLUMN sent_by TYPE text USING sent_by::text;
