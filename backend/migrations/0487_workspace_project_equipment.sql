-- Project-scoped equipment kit, internal reservations and maintenance history.
-- Equipment remains owned by user_equipment; projects only assign/reserve the
-- owner's inventory. Project ids are intentionally not foreign keyed because
-- the workspace supports both public.projects and legacy.projects.

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

UPDATE user_equipment SET quantity = 1 WHERE quantity IS NULL OR quantity < 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_equipment_quantity_check'
  ) THEN
    ALTER TABLE user_equipment
      ADD CONSTRAINT user_equipment_quantity_check
      CHECK (quantity BETWEEN 1 AND 9999) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_equipment_assignments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            VARCHAR(128) NOT NULL,
  project_owner_user_id VARCHAR(128) NOT NULL,
  equipment_id          INTEGER NOT NULL REFERENCES user_equipment(id) ON DELETE RESTRICT,
  quantity              INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 9999),
  responsible_member_id UUID REFERENCES project_team_members(id) ON DELETE SET NULL,
  assignment_type       VARCHAR(16) NOT NULL DEFAULT 'primary'
                        CHECK (assignment_type IN ('primary', 'reserve')),
  notes                 TEXT,
  documents             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by            VARCHAR(128) NOT NULL,
  updated_by            VARCHAR(128) NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_equipment_assignments_project_equipment_unique
    UNIQUE (project_id, equipment_id)
);

ALTER TABLE project_equipment_assignments
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_project_equipment_assignments_project
  ON project_equipment_assignments(project_id, assignment_type, created_at);
CREATE INDEX IF NOT EXISTS idx_project_equipment_assignments_equipment
  ON project_equipment_assignments(equipment_id);

ALTER TABLE project_equipment_assignments
  DROP CONSTRAINT IF EXISTS project_equipment_assignments_equipment_id_fkey;
ALTER TABLE project_equipment_assignments
  DROP CONSTRAINT IF EXISTS project_equipment_assignments_equipment_id_fk;
ALTER TABLE project_equipment_assignments
  ADD CONSTRAINT project_equipment_assignments_equipment_id_fk
  FOREIGN KEY (equipment_id) REFERENCES user_equipment(id) ON DELETE RESTRICT
  NOT VALID;

-- Bring the original rental table forward without discarding legacy rentals.
-- The consolidated schema tied project_id to public.projects. Workspace also
-- supports legacy.projects, so the polymorphic project reference must not keep
-- either the generated or PostgreSQL-default FK variant.
ALTER TABLE equipment_rentals
  DROP CONSTRAINT IF EXISTS equipment_rentals_project_id_projects_id_fk;
ALTER TABLE equipment_rentals
  DROP CONSTRAINT IF EXISTS equipment_rentals_project_id_fk;
ALTER TABLE equipment_rentals
  DROP CONSTRAINT IF EXISTS equipment_rentals_project_id_fkey;

ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS project_id VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS equipment_type VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS equipment_name VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS brand VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS model VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_company VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_contact JSONB;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_start_date DATE;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_end_date DATE;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS actual_return_date DATE;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(8, 2);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS total_cost NUMERIC(8, 2);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS deposit NUMERIC(8, 2);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS insurance NUMERIC(8, 2);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS rental_agreement_url VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS receipt_url VARCHAR;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS condition JSONB;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'booked';
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS equipment_id INTEGER;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS assignment_id UUID;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS reserved_by VARCHAR(128);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS checkout_notes TEXT;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS return_notes TEXT;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS return_condition VARCHAR(32);
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS pickup_photos JSONB;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS return_photos JSONB;
ALTER TABLE equipment_rentals ADD COLUMN IF NOT EXISTS damage_notes TEXT;

-- Some generated-schema environments previously used rental_cost instead of
-- the baseline total_cost. Preserve those values while making total_cost the
-- single canonical cost column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'equipment_rentals' AND column_name = 'rental_cost'
  ) THEN
    EXECUTE 'UPDATE equipment_rentals
                SET total_cost = COALESCE(total_cost, rental_cost)
              WHERE total_cost IS NULL';
  END IF;
END $$;

UPDATE equipment_rentals
   SET equipment_type = COALESCE(NULLIF(equipment_type, ''), 'equipment'),
       equipment_name = COALESCE(NULLIF(equipment_name, ''), NULLIF(TRIM(CONCAT_WS(' ', brand, model)), ''), 'Equipment'),
       rental_company = COALESCE(NULLIF(rental_company, ''), 'CreatorHub intern'),
       rental_start_date = COALESCE(rental_start_date, created_at::date, CURRENT_DATE),
       rental_end_date = COALESCE(rental_end_date, rental_start_date, created_at::date, CURRENT_DATE),
       total_cost = COALESCE(total_cost, 0)
 WHERE equipment_type IS NULL OR equipment_name IS NULL OR rental_company IS NULL
    OR rental_start_date IS NULL OR rental_end_date IS NULL OR total_cost IS NULL;

ALTER TABLE equipment_rentals ALTER COLUMN equipment_type SET NOT NULL;
ALTER TABLE equipment_rentals ALTER COLUMN equipment_name SET NOT NULL;
ALTER TABLE equipment_rentals ALTER COLUMN rental_company SET NOT NULL;
ALTER TABLE equipment_rentals ALTER COLUMN rental_start_date SET NOT NULL;
ALTER TABLE equipment_rentals ALTER COLUMN rental_end_date SET NOT NULL;
ALTER TABLE equipment_rentals ALTER COLUMN total_cost SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE equipment_rentals
    DROP CONSTRAINT IF EXISTS equipment_rentals_assignment_id_fk;
  ALTER TABLE equipment_rentals
    DROP CONSTRAINT IF EXISTS equipment_rentals_assignment_id_fkey;
  ALTER TABLE equipment_rentals
    ADD CONSTRAINT equipment_rentals_assignment_id_fk
    FOREIGN KEY (assignment_id) REFERENCES project_equipment_assignments(id) ON DELETE RESTRICT
    NOT VALID;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipment_rentals_equipment_id_fk'
  ) THEN
    ALTER TABLE equipment_rentals
      DROP CONSTRAINT IF EXISTS equipment_rentals_equipment_id_fkey;
    ALTER TABLE equipment_rentals
      ADD CONSTRAINT equipment_rentals_equipment_id_fk
      FOREIGN KEY (equipment_id) REFERENCES user_equipment(id) ON DELETE RESTRICT
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'equipment_rentals_quantity_check'
  ) THEN
    ALTER TABLE equipment_rentals
      ADD CONSTRAINT equipment_rentals_quantity_check
      CHECK (quantity BETWEEN 1 AND 9999) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipment_rentals_project_dates
  ON equipment_rentals(project_id, rental_start_date, rental_end_date);
CREATE INDEX IF NOT EXISTS idx_equipment_rentals_conflicts
  ON equipment_rentals(equipment_id, rental_start_date, rental_end_date, status);

-- The generated schema already models these richer maintenance fields, while
-- the consolidated SQL originally created a smaller table. Make the runtime
-- contract explicit and backwards compatible.
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS service_provider VARCHAR;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS next_scheduled_date TIMESTAMP;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS parts_replaced JSONB;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS labor_hours NUMERIC(5, 2);
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS warranty_extended BOOLEAN DEFAULT FALSE;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS receipt_url VARCHAR;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS before_photos JSONB;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS after_photos JSONB;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS service_notes TEXT;
ALTER TABLE equipment_maintenance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE equipment_maintenance
   SET description = COALESCE(description, notes, '')
 WHERE description IS NULL;

ALTER TABLE equipment_maintenance ALTER COLUMN description SET NOT NULL;
