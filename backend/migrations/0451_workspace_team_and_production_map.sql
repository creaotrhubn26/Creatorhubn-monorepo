-- Canonical persistence for CreatorHub Team Workspace access and live production map.
-- Runtime CREATE/ALTER guards remain temporarily for rolling deployments, but this
-- migration is the authoritative schema contract.

CREATE TABLE IF NOT EXISTS project_team_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     VARCHAR(64) NOT NULL,
  user_id        VARCHAR(64),
  email          VARCHAR(255) NOT NULL,
  name           VARCHAR(255),
  role           VARCHAR(20) NOT NULL DEFAULT 'member',
  crew_role      VARCHAR(20),
  permissions    JSONB NOT NULL DEFAULT '{"canRead":true,"canEdit":false}'::jsonb,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',
  invite_token   VARCHAR(80),
  invited_by     VARCHAR(64),
  invited_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at    TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ptm_project_email
  ON project_team_members (project_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_ptm_project
  ON project_team_members (project_id) WHERE deactivated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ptm_user
  ON project_team_members (user_id) WHERE deactivated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ptm_token
  ON project_team_members (invite_token);

ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
ALTER TABLE wedding_locations ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

-- Older runtime guards used lat/lng. Preserve coordinates when promoting the
-- canonical latitude/longitude contract.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wedding_locations' AND column_name = 'lat'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wedding_locations' AND column_name = 'lng'
  ) THEN
    EXECUTE 'UPDATE wedding_locations
                SET latitude = COALESCE(latitude, lat),
                    longitude = COALESCE(longitude, lng)
              WHERE (latitude IS NULL AND lat IS NOT NULL)
                 OR (longitude IS NULL AND lng IS NOT NULL)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wedding_location_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id    VARCHAR(64) NOT NULL,
  location_id   UUID NOT NULL,
  member_name   VARCHAR(255) NOT NULL,
  member_role   VARCHAR(64),
  checked_in_by VARCHAR(64) NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE wedding_location_checkins ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(64);
UPDATE wedding_location_checkins
   SET checked_in_by = 'legacy:' || id::text
 WHERE checked_in_by IS NULL;
ALTER TABLE wedding_location_checkins ALTER COLUMN checked_in_by SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_checkins_member
  ON wedding_location_checkins (wedding_id, LOWER(member_name));
DROP INDEX IF EXISTS idx_wedding_checkins_location;
CREATE INDEX idx_wedding_checkins_location
  ON wedding_location_checkins (wedding_id, location_id);

CREATE TABLE IF NOT EXISTS wedding_crew_positions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id  VARCHAR(64) NOT NULL,
  member_name VARCHAR(255) NOT NULL,
  member_role VARCHAR(64),
  latitude    NUMERIC(9, 6) NOT NULL,
  longitude   NUMERIC(9, 6) NOT NULL,
  accuracy_m  NUMERIC(8, 2),
  updated_by  VARCHAR(64) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE wedding_crew_positions ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6);
ALTER TABLE wedding_crew_positions ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);
ALTER TABLE wedding_crew_positions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64);

-- Older runtime guards used lat/lng and keyed the live row by display name.
-- Keep any existing coordinates and give legacy rows a collision-free actor id;
-- all new writes use the authenticated user id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wedding_crew_positions' AND column_name = 'lat'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wedding_crew_positions' AND column_name = 'lng'
  ) THEN
    EXECUTE 'UPDATE wedding_crew_positions
                SET latitude = COALESCE(latitude, lat),
                    longitude = COALESCE(longitude, lng)
              WHERE (latitude IS NULL AND lat IS NOT NULL)
                 OR (longitude IS NULL AND lng IS NOT NULL)';
  END IF;
END $$;

UPDATE wedding_crew_positions
   SET updated_by = 'legacy:' || id::text
 WHERE updated_by IS NULL;
ALTER TABLE wedding_crew_positions ALTER COLUMN latitude SET NOT NULL;
ALTER TABLE wedding_crew_positions ALTER COLUMN longitude SET NOT NULL;
ALTER TABLE wedding_crew_positions ALTER COLUMN updated_by SET NOT NULL;
DROP INDEX IF EXISTS idx_wedding_positions_member;
CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_positions_actor
  ON wedding_crew_positions (wedding_id, updated_by);
CREATE INDEX IF NOT EXISTS idx_wedding_positions_recent
  ON wedding_crew_positions (wedding_id, updated_at DESC);
