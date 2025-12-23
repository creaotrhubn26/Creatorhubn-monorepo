-- 008_seed_missing_fk_rows_and_validate.sql
-- Purpose: Seed minimal referenced rows so FK constraints can be validated safely.
-- Safe and idempotent. All operations guarded by table/column existence checks.

-- Enable common extensions if available (safe if already present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Ensure a system seed user exists for linking projects if needed
DO $$
DECLARE
  has_users boolean;
  has_email boolean;
  has_name boolean;
  seed_user_id text := 'system-seed-user';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'
  ) INTO has_users;

  IF has_users THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email'
    ) INTO has_email;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name'
    ) INTO has_name;

    IF has_email AND has_name THEN
      EXECUTE 'INSERT INTO public.users (id, email, name)
               VALUES (''system-seed-user'',''seed@system.local'',''System Seed User'')
               ON CONFLICT (id) DO NOTHING';
    ELSIF has_email THEN
      EXECUTE 'INSERT INTO public.users (id, email)
               VALUES (''system-seed-user'',''seed@system.local'')
               ON CONFLICT (id) DO NOTHING';
    ELSE
      EXECUTE 'INSERT INTO public.users (id)
               VALUES (''system-seed-user'')
               ON CONFLICT (id) DO NOTHING';
    END IF;
  END IF;
END $$;

-- 1) Seed missing users referenced by meeting_sessions.user_id and showcase_items.user_id
DO $$
DECLARE
  users_exists boolean;
  ms_exists boolean;
  si_exists boolean;
  email_exists boolean;
  name_exists boolean;
  source_parts text[] := ARRAY[]::text[];
  source_sql text;
  col_list text := '"id"';
  sel_list text := 's.id';
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') INTO users_exists;
  IF NOT users_exists THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions') INTO ms_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_items') INTO si_exists;

  IF ms_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT user_id AS id FROM public.meeting_sessions WHERE user_id IS NOT NULL');
  END IF;
  IF si_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT user_id AS id FROM public.showcase_items WHERE user_id IS NOT NULL');
  END IF;

  IF array_length(source_parts,1) IS NULL THEN RETURN; END IF;
  source_sql := array_to_string(source_parts, ' UNION ');

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='email') INTO email_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='name') INTO name_exists;

  IF email_exists THEN
    col_list := col_list || ', "email"';
    sel_list := sel_list || ', s.id';
  END IF;
  IF name_exists THEN
    col_list := col_list || ', "name"';
    sel_list := sel_list || ', COALESCE(NULLIF(s.id, ''''), ''Seed User'')';
  END IF;

  -- Avoid inserting rows that would violate unique(email) if email column exists
  IF email_exists THEN
    EXECUTE format('INSERT INTO public.users (%s)
                    SELECT %s FROM (%s) s
                    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.id)
                      AND NOT EXISTS (SELECT 1 FROM public.users u2 WHERE u2.email = s.id)',
                    col_list, sel_list, source_sql);
  ELSE
    EXECUTE format('INSERT INTO public.users (%s)
                    SELECT %s FROM (%s) s
                    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = s.id)',
                    col_list, sel_list, source_sql);
  END IF;
END $$;

-- 2) Seed missing projects referenced by meeting_sessions.project_id and showcase_items.project_id
DO $$
DECLARE
  projects_exists boolean;
  ms_exists boolean;
  si_exists boolean;
  user_id_exists boolean;
  title_exists boolean;
  name_exists boolean;
  project_type_exists boolean;
  source_parts text[] := ARRAY[]::text[];
  source_sql text;
  col_list text := '"id"';
  sel_list text := 's.id';
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='projects') INTO projects_exists;
  IF NOT projects_exists THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions') INTO ms_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_items') INTO si_exists;

  IF ms_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT project_id AS id FROM public.meeting_sessions WHERE project_id IS NOT NULL');
  END IF;
  IF si_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT project_id AS id FROM public.showcase_items WHERE project_id IS NOT NULL');
  END IF;

  IF array_length(source_parts,1) IS NULL THEN RETURN; END IF;
  source_sql := array_to_string(source_parts, ' UNION ');

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='user_id') INTO user_id_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='title') INTO title_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='name') INTO name_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='project_type') INTO project_type_exists;

  IF user_id_exists THEN
    col_list := col_list || ', "user_id"';
    sel_list := sel_list || ', ''system-seed-user''';
  END IF;
  IF title_exists THEN
    col_list := col_list || ', "title"';
    sel_list := sel_list || ', concat(''Seed Project '', s.id)';
  END IF;
  IF name_exists THEN
    col_list := col_list || ', "name"';
    sel_list := sel_list || ', concat(''Seed Project '', s.id)';
  END IF;
  IF project_type_exists THEN
    col_list := col_list || ', "project_type"';
    sel_list := sel_list || ', ''general''';
  END IF;

  EXECUTE format('INSERT INTO public.projects (%s)
                  SELECT %s FROM (%s) s
                  WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = s.id)',
                  col_list, sel_list, source_sql);
END $$;

-- 3) Seed missing customer_journey_templates referenced by journey_* tables
DO $$
DECLARE
  cjt_exists boolean;
  ja_exists boolean;
  js_exists boolean;
  name_exists boolean;
  profession_exists boolean;
  package_type_exists boolean;
  status_exists boolean;
  source_parts text[] := ARRAY[]::text[];
  source_sql text;
  col_list text := '"id"';
  sel_list text := 's.id';
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_journey_templates') INTO cjt_exists;
  IF NOT cjt_exists THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journey_analytics') INTO ja_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='journey_steps') INTO js_exists;

  IF ja_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT template_id AS id FROM public.journey_analytics WHERE template_id IS NOT NULL');
  END IF;
  IF js_exists THEN
    source_parts := array_append(source_parts, 'SELECT DISTINCT template_id AS id FROM public.journey_steps WHERE template_id IS NOT NULL');
  END IF;

  IF array_length(source_parts,1) IS NULL THEN RETURN; END IF;
  source_sql := array_to_string(source_parts, ' UNION ');

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='name') INTO name_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='profession') INTO profession_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='package_type') INTO package_type_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customer_journey_templates' AND column_name='status') INTO status_exists;

  IF name_exists THEN
    col_list := col_list || ', "name"';
    sel_list := sel_list || ', concat(''Seed CJT '', left(s.id::text, 12))';
  END IF;
  IF profession_exists THEN
    col_list := col_list || ', "profession"';
    sel_list := sel_list || ', ''general''';
  END IF;
  IF package_type_exists THEN
    col_list := col_list || ', "package_type"';
    sel_list := sel_list || ', ''default''';
  END IF;
  IF status_exists THEN
    col_list := col_list || ', "status"';
    sel_list := sel_list || ', ''active''';
  END IF;

  EXECUTE format('INSERT INTO public.customer_journey_templates (%s)
                  SELECT %s FROM (%s) s
                  WHERE NOT EXISTS (SELECT 1 FROM public.customer_journey_templates t WHERE t.id = s.id)',
                  col_list, sel_list, source_sql);
END $$;

-- 4) Seed missing wedding_timelines referenced by meeting_notes
DO $$
DECLARE
  wt_exists boolean;
  mn_exists boolean;
  user_id_exists boolean;
  title_exists boolean;
  couple_name_exists boolean;
  source_sql text;
  col_list text := '"id"';
  sel_list text := 's.id';
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wedding_timelines') INTO wt_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_notes') INTO mn_exists;
  IF NOT wt_exists OR NOT mn_exists THEN RETURN; END IF;

  source_sql := 'SELECT DISTINCT wedding_timeline_id AS id FROM public.meeting_notes WHERE wedding_timeline_id IS NOT NULL';

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wedding_timelines' AND column_name='user_id') INTO user_id_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wedding_timelines' AND column_name='title') INTO title_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wedding_timelines' AND column_name='couple_name') INTO couple_name_exists;

  IF user_id_exists THEN
    col_list := col_list || ', "user_id"';
    sel_list := sel_list || ', ''system-seed-user''';
  END IF;
  IF title_exists THEN
    col_list := col_list || ', "title"';
    sel_list := sel_list || ', concat(''Seed Wedding Timeline '', left(s.id::text, 12))';
  END IF;
  IF couple_name_exists THEN
    col_list := col_list || ', "couple_name"';
    sel_list := sel_list || ', ''Seed Couple''';
  END IF;

  EXECUTE format('INSERT INTO public.wedding_timelines (%s)
                  SELECT %s FROM (%s) s
                  WHERE NOT EXISTS (SELECT 1 FROM public.wedding_timelines w WHERE w.id = s.id)',
                  col_list, sel_list, source_sql);
END $$;

-- 5) Validate constraints if present
DO $$
DECLARE
  rec record;
  cmds text[] := ARRAY[
    'ALTER TABLE public.meeting_sessions VALIDATE CONSTRAINT meeting_sessions_user_id_users_id_fk',
    'ALTER TABLE public.meeting_sessions VALIDATE CONSTRAINT meeting_sessions_project_id_projects_id_fk',
    'ALTER TABLE public.showcase_items  VALIDATE CONSTRAINT showcase_items_user_id_users_id_fk',
    'ALTER TABLE public.showcase_items  VALIDATE CONSTRAINT showcase_items_project_id_projects_id_fk',
    'ALTER TABLE public.meeting_notes   VALIDATE CONSTRAINT meeting_notes_wedding_timeline_id_wedding_timelines_id_fk',
    'ALTER TABLE public.journey_analytics VALIDATE CONSTRAINT journey_analytics_template_id_customer_journey_templates_id_fk',
    'ALTER TABLE public.journey_steps     VALIDATE CONSTRAINT journey_steps_template_id_customer_journey_templates_id_fk'
  ];
  c text;
BEGIN
  FOREACH c IN ARRAY cmds LOOP
    BEGIN
      EXECUTE c;
    EXCEPTION WHEN undefined_table OR undefined_object THEN
      -- Skip if table or constraint does not exist
      CONTINUE;
    WHEN foreign_key_violation THEN
      -- If still invalid, leave NOT VALID in place
      CONTINUE;
    END;
  END LOOP;
END $$;
