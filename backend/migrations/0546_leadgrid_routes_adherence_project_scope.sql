-- Bind route planning, position telemetry and route visits to one explicit
-- Leadgrid customer project. Legacy ambiguity is retained as NULL; every new
-- write must satisfy the project tuple and relational invariants below.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'leadgrid_route_assignments'
       AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'leadgrid_route_assignments'
       AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE leadgrid_route_assignments
      RENAME COLUMN org_id TO organization_id;
  END IF;
END $$;

ALTER TABLE leadgrid_user_positions
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE leadgrid_route_assignments
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_hash TEXT;
ALTER TABLE leadgrid_route_visits
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

-- Infer an assignment only when every UUID stop resolves to a customer in one
-- project within the assignment organization. Non-UUID planner stops neither
-- widen nor invalidate that evidence.
WITH stop_evidence AS (
  SELECT assignment.id,
         MIN(customer.project_id) AS project_id,
         COUNT(*) FILTER (
           WHERE stop.value->>'lead_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         ) AS uuid_count,
         COUNT(customer.id) FILTER (WHERE customer.project_id IS NOT NULL) AS matched_count,
         COUNT(DISTINCT customer.project_id) FILTER (
           WHERE customer.project_id IS NOT NULL
         ) AS project_count
    FROM leadgrid_route_assignments assignment
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(assignment.stops) = 'array'
           THEN assignment.stops ELSE '[]'::jsonb END
    ) stop(value)
    LEFT JOIN crm_customers customer
      ON stop.value->>'lead_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     AND customer.id::text = stop.value->>'lead_id'
     AND customer.organization_id = assignment.organization_id
     AND customer.project_id IS NOT NULL
   WHERE assignment.project_id IS NULL
   GROUP BY assignment.id
)
UPDATE leadgrid_route_assignments assignment
   SET project_id = evidence.project_id
  FROM stop_evidence evidence
 WHERE assignment.id = evidence.id
   AND evidence.uuid_count > 0
   AND evidence.matched_count = evidence.uuid_count
   AND evidence.project_count = 1;

-- Organization-only route records are safe to infer only for a true singleton
-- organization. Archived projects count too: history must not be reassigned.
WITH single_project AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
)
UPDATE leadgrid_route_assignments assignment
   SET project_id = single_project.project_id
  FROM single_project
 WHERE assignment.project_id IS NULL
   AND assignment.organization_id = single_project.organization_id;

-- A visit inherits only the exact assignment tuple.
UPDATE leadgrid_route_visits visit
   SET organization_id = assignment.organization_id,
       project_id = assignment.project_id
  FROM leadgrid_route_assignments assignment
 WHERE visit.assignment_id = assignment.id
   AND (visit.organization_id IS NULL OR visit.project_id IS NULL)
   AND assignment.project_id IS NOT NULL;

-- Position samples carry no historical tenant key. Bind them only when the
-- local calendar day has exactly one resolved assignment tuple for the user.
WITH route_day AS (
  SELECT assignment.user_id,
         assignment.route_date,
         MIN(assignment.organization_id::text)::uuid AS organization_id,
         MIN(assignment.project_id) AS project_id
    FROM leadgrid_route_assignments assignment
   WHERE assignment.project_id IS NOT NULL
   GROUP BY assignment.user_id, assignment.route_date
  HAVING COUNT(DISTINCT (assignment.organization_id::text || ':' || assignment.project_id)) = 1
)
UPDATE leadgrid_user_positions position
   SET organization_id = route_day.organization_id,
       project_id = route_day.project_id
  FROM route_day
 WHERE position.organization_id IS NULL
   AND position.project_id IS NULL
   AND position.user_id = route_day.user_id
   AND (position.sampled_at AT TIME ZONE 'Europe/Oslo')::date = route_day.route_date;

-- If a user has exactly one resolved route tuple over all history, it is also
-- safe evidence for samples on days without an assignment.
WITH user_scope AS (
  SELECT assignment.user_id,
         MIN(assignment.organization_id::text)::uuid AS organization_id,
         MIN(assignment.project_id) AS project_id
    FROM leadgrid_route_assignments assignment
   WHERE assignment.project_id IS NOT NULL
   GROUP BY assignment.user_id
  HAVING COUNT(DISTINCT (assignment.organization_id::text || ':' || assignment.project_id)) = 1
)
UPDATE leadgrid_user_positions position
   SET organization_id = user_scope.organization_id,
       project_id = user_scope.project_id
  FROM user_scope
 WHERE position.organization_id IS NULL
   AND position.project_id IS NULL
   AND position.user_id = user_scope.user_id;

DROP INDEX IF EXISTS uniq_leadgrid_user_positions_user_time;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_positions_project_sample
  ON leadgrid_user_positions (
    organization_id, project_id, user_id, sampled_at
  );
CREATE INDEX IF NOT EXISTS idx_leadgrid_positions_project_latest
  ON leadgrid_user_positions (
    organization_id, project_id, user_id, sampled_at DESC
  ) WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_route_assignments_scope_id
  ON leadgrid_route_assignments (organization_id, project_id, id);
CREATE INDEX IF NOT EXISTS idx_route_assignments_project_user_date
  ON leadgrid_route_assignments (
    organization_id, project_id, user_id, route_date DESC
  ) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_route_assignments_idempotency
  ON leadgrid_route_assignments (
    organization_id, project_id, idempotency_key
  ) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_visits_project_assignment
  ON leadgrid_route_visits (
    organization_id, project_id, assignment_id, arrived_at
  ) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_route_visits_idempotency
  ON leadgrid_route_visits (
    organization_id, project_id, idempotency_key
  ) WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_positions_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_user_positions
      ADD CONSTRAINT leadgrid_positions_project_required_check
      CHECK (organization_id IS NOT NULL AND project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_assignments_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_route_assignments
      ADD CONSTRAINT leadgrid_assignments_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_visits_project_required_check'
  ) THEN
    ALTER TABLE leadgrid_route_visits
      ADD CONSTRAINT leadgrid_visits_project_required_check
      CHECK (organization_id IS NOT NULL AND project_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_assignments_idempotency_hash_check'
  ) THEN
    ALTER TABLE leadgrid_route_assignments
      ADD CONSTRAINT leadgrid_assignments_idempotency_hash_check
      CHECK (idempotency_key IS NULL OR request_hash IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_visits_idempotency_hash_check'
  ) THEN
    ALTER TABLE leadgrid_route_visits
      ADD CONSTRAINT leadgrid_visits_idempotency_hash_check
      CHECK (idempotency_key IS NULL OR request_hash IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_positions_coordinate_check'
  ) THEN
    ALTER TABLE leadgrid_user_positions
      ADD CONSTRAINT leadgrid_positions_coordinate_check
      CHECK (
        latitude BETWEEN -90 AND 90
        AND longitude BETWEEN -180 AND 180
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_assignments_stops_check'
  ) THEN
    ALTER TABLE leadgrid_route_assignments
      ADD CONSTRAINT leadgrid_assignments_stops_check
      CHECK (
        jsonb_typeof(stops) = 'array'
        AND total_stops = jsonb_array_length(stops)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_positions_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_user_positions
      ADD CONSTRAINT leadgrid_positions_project_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_assignments_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_route_assignments
      ADD CONSTRAINT leadgrid_assignments_project_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_visits_project_fkey'
  ) THEN
    ALTER TABLE leadgrid_route_visits
      ADD CONSTRAINT leadgrid_visits_project_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'leadgrid_visits_assignment_scope_fkey'
  ) THEN
    ALTER TABLE leadgrid_route_visits
      ADD CONSTRAINT leadgrid_visits_assignment_scope_fkey
      FOREIGN KEY (organization_id, project_id, assignment_id)
      REFERENCES leadgrid_route_assignments (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_leadgrid_route_project_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stop JSONB;
BEGIN
  IF NEW.organization_id IS NULL OR NEW.project_id IS NULL OR NOT EXISTS (
    SELECT 1
      FROM leadgrid_projects project
     WHERE project.organization_id = NEW.organization_id
       AND project.id = NEW.project_id
       AND (project.status IS NULL OR project.status NOT IN ('archived', 'deleted'))
  ) THEN
    RAISE EXCEPTION 'invalid Leadgrid route project scope'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'leadgrid_route_assignments' THEN
    FOR stop IN SELECT value FROM jsonb_array_elements(NEW.stops)
    LOOP
      IF NOT (
        stop ? 'lead_id'
        AND stop ? 'latitude'
        AND stop ? 'longitude'
        AND stop ? 'order_index'
      ) OR (stop->>'latitude')::double precision NOT BETWEEN -90 AND 90
        OR (stop->>'longitude')::double precision NOT BETWEEN -180 AND 180
        OR (stop->>'order_index')::integer < 0 THEN
        RAISE EXCEPTION 'invalid Leadgrid route stop shape'
          USING ERRCODE = '23514';
      END IF;

      IF stop->>'lead_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         AND NOT EXISTS (
           SELECT 1
             FROM crm_customers customer
            WHERE customer.id::text = stop->>'lead_id'
              AND customer.organization_id = NEW.organization_id
              AND customer.project_id = NEW.project_id
              AND customer.archived_at IS NULL
         ) THEN
        RAISE EXCEPTION 'Leadgrid route stop outside project'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'leadgrid_route_visits' THEN
    IF NOT EXISTS (
      SELECT 1
        FROM leadgrid_route_assignments assignment
        CROSS JOIN LATERAL jsonb_array_elements(assignment.stops) stop(value)
       WHERE assignment.organization_id = NEW.organization_id
         AND assignment.project_id = NEW.project_id
         AND assignment.id = NEW.assignment_id
         AND stop.value->>'lead_id' = NEW.stop_lead_id
    ) THEN
      RAISE EXCEPTION 'Leadgrid route visit outside assignment stop scope'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leadgrid_positions_project_scope
  ON leadgrid_user_positions;
CREATE TRIGGER trg_leadgrid_positions_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id
ON leadgrid_user_positions
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_route_project_scope();

DROP TRIGGER IF EXISTS trg_leadgrid_assignments_project_scope
  ON leadgrid_route_assignments;
CREATE TRIGGER trg_leadgrid_assignments_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, stops, total_stops
ON leadgrid_route_assignments
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_route_project_scope();

DROP TRIGGER IF EXISTS trg_leadgrid_visits_project_scope
  ON leadgrid_route_visits;
CREATE TRIGGER trg_leadgrid_visits_project_scope
BEFORE INSERT OR UPDATE OF organization_id, project_id, assignment_id, stop_lead_id
ON leadgrid_route_visits
FOR EACH ROW EXECUTE FUNCTION enforce_leadgrid_route_project_scope();

COMMIT;
