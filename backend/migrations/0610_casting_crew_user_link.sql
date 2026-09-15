-- casting_crew rows carry a name, an email and a phone number, but never said
-- which account they are. Availability overlays and conflict lookups matched
-- crew to members by lowercased email, which breaks when someone changes their
-- address, has none on the row, or shares one with a production mailbox.
--
-- user_id names the account explicitly. It is nullable: a crew credit for
-- someone without a CreatorHub account is still a valid row, and no existing
-- row is backfilled by guessing from email.
--
-- This is a credit, not an authorization: casting_user_roles remains the only
-- source of project access.

ALTER TABLE casting_crew
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_casting_crew_project_user
  ON casting_crew(project_id, user_id);
