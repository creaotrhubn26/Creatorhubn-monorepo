-- Small productions staff one person in several crew roles: producer and
-- director, or DoP and camera operator. casting_user_roles keeps one row per
-- (project_id, user_id), so `role` could only name one of them.
--
-- additional_roles carries the rest on the same row. The unique index stays,
-- so no existing row moves and no reader that only knows `role` changes
-- behaviour: `role` remains the primary role every legacy query already sees.

ALTER TABLE casting_user_roles
  ADD COLUMN IF NOT EXISTS additional_roles TEXT[] NOT NULL DEFAULT '{}';
