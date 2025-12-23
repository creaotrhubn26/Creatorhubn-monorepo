-- 007_fix_fk_types_and_constraints.sql
-- Purpose: Align data types and add problematic foreign keys as NOT VALID to avoid data validation failures.
-- Safe to run multiple times.

-- 1) Align meeting_notes.wedding_timeline_id type to match wedding_timelines.id
DO $$
DECLARE
  notes_col_type text;
  wedding_id_type text;
BEGIN
  SELECT data_type INTO notes_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'meeting_notes' AND column_name = 'wedding_timeline_id';

  SELECT data_type INTO wedding_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'wedding_timelines' AND column_name = 'id';

  IF notes_col_type IS NOT NULL AND wedding_id_type IS NOT NULL AND notes_col_type <> wedding_id_type THEN
    IF wedding_id_type = 'character varying' THEN
      EXECUTE 'ALTER TABLE "meeting_notes" ALTER COLUMN "wedding_timeline_id" TYPE varchar USING "wedding_timeline_id"::varchar';
    ELSIF wedding_id_type = 'uuid' THEN
      EXECUTE 'ALTER TABLE "meeting_notes" ALTER COLUMN "wedding_timeline_id" TYPE uuid USING CASE WHEN ("wedding_timeline_id")::text ~ ''^[0-9a-fA-F-]{36}$'' THEN ("wedding_timeline_id")::uuid ELSE NULL END';
    END IF;
  END IF;
END $$;

-- 2) Add FK for meeting_notes.wedding_timeline_id -> wedding_timelines(id) as NOT VALID (guard by name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_notes'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wedding_timelines'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'meeting_notes_wedding_timeline_id_wedding_timelines_id_fk'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_wedding_timeline_id_wedding_timelines_id_fk" FOREIGN KEY ("wedding_timeline_id") REFERENCES "public"."wedding_timelines"("id") NOT VALID';
  END IF;
END $$;

-- 3) Align journey_analytics.template_id and journey_steps.template_id with customer_journey_templates.id
DO $$
DECLARE
  cjt_id_type text;
  ja_type text;
  js_type text;
BEGIN
  SELECT data_type INTO cjt_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='id';

  SELECT data_type INTO ja_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='journey_analytics' AND column_name='template_id';

  SELECT data_type INTO js_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='journey_steps' AND column_name='template_id';

  IF cjt_id_type IS NOT NULL THEN
    IF cjt_id_type = 'uuid' THEN
      IF ja_type IS NOT NULL AND ja_type <> 'uuid' THEN
        EXECUTE 'ALTER TABLE "journey_analytics" ALTER COLUMN "template_id" TYPE uuid USING (CASE WHEN "template_id" ~ ''^[0-9a-fA-F-]{36}$'' THEN "template_id"::uuid ELSE NULL END)';
      END IF;
      IF js_type IS NOT NULL AND js_type <> 'uuid' THEN
        EXECUTE 'ALTER TABLE "journey_steps" ALTER COLUMN "template_id" TYPE uuid USING (CASE WHEN "template_id" ~ ''^[0-9a-fA-F-]{36}$'' THEN "template_id"::uuid ELSE NULL END)';
      END IF;
    ELSIF cjt_id_type = 'character varying' THEN
      IF ja_type = 'uuid' THEN
        EXECUTE 'ALTER TABLE "journey_analytics" ALTER COLUMN "template_id" TYPE varchar USING "template_id"::text';
      END IF;
      IF js_type = 'uuid' THEN
        EXECUTE 'ALTER TABLE "journey_steps" ALTER COLUMN "template_id" TYPE varchar USING "template_id"::text';
      END IF;
    END IF;
  END IF;
END $$;

-- 4) Add FKs for journey tables as NOT VALID (only if types now match)
DO $$
DECLARE
  cjt_id_type text;
  ja_type text;
  js_type text;
BEGIN
  SELECT data_type INTO cjt_id_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='id';

  SELECT data_type INTO ja_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='journey_analytics' AND column_name='template_id';

  SELECT data_type INTO js_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='journey_steps' AND column_name='template_id';

  IF cjt_id_type = ja_type THEN
IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journey_analytics'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.conname='journey_analytics_template_id_customer_journey_templates_id_fk' AND n.nspname='public'
    ) THEN
      EXECUTE 'ALTER TABLE "journey_analytics" ADD CONSTRAINT "journey_analytics_template_id_customer_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_journey_templates"("id") NOT VALID';
    END IF;
  END IF;

  IF cjt_id_type = js_type THEN
IF EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journey_steps'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.conname='journey_steps_template_id_customer_journey_templates_id_fk' AND n.nspname='public'
    ) THEN
      EXECUTE 'ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_template_id_customer_journey_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."customer_journey_templates"("id") NOT VALID';
    END IF;
  END IF;
END $$;

-- 5) Add NOT VALID FKs where prior attempts failed due to missing referenced rows
DO $$
BEGIN
  -- meeting_sessions.user_id -> users(id)
IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='meeting_sessions_user_id_users_id_fk' AND n.nspname='public'
  ) THEN
    EXECUTE 'ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") NOT VALID';
  END IF;

  -- meeting_sessions.project_id -> projects(id)
IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='meeting_sessions_project_id_projects_id_fk' AND n.nspname='public'
  ) THEN
    EXECUTE 'ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") NOT VALID';
  END IF;

  -- showcase_items.user_id -> users(id)
IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='showcase_items_user_id_users_id_fk' AND n.nspname='public'
  ) THEN
    EXECUTE 'ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") NOT VALID';
  END IF;

  -- showcase_items.project_id -> projects(id)
IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_items'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='showcase_items_project_id_projects_id_fk' AND n.nspname='public'
  ) THEN
    EXECUTE 'ALTER TABLE "showcase_items" ADD CONSTRAINT "showcase_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") NOT VALID';
  END IF;
END $$;

-- End of migration
