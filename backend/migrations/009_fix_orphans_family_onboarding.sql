-- 009_fix_orphans_family_onboarding.sql
-- Purpose: Resolve orphaned FKs for onboarding and family trees; repair user_id orphans; idempotent and guarded by existence checks.

-- Ensure pgcrypto available for UUID gen if used
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0) Ensure a system seed user exists (safe if already present)
DO $$
DECLARE
  has_users boolean;
  has_email boolean;
  has_name boolean;
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
      INSERT INTO public.users (id, email, name)
      VALUES ('system-seed-user','seed@system.local','System Seed User')
      ON CONFLICT (id) DO NOTHING;
    ELSIF has_email THEN
      INSERT INTO public.users (id, email)
      VALUES ('system-seed-user','seed@system.local')
      ON CONFLICT (id) DO NOTHING;
    ELSE
      INSERT INTO public.users (id)
      VALUES ('system-seed-user')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 1) Ensure a default onboarding_profile exists and repoint missing references to it (schema-adaptive)
DO $$
DECLARE
  op_exists boolean;
  pg_exists boolean;
  ar_exists boolean;
  default_id text := 'system-seed-onboarding-profile';
  req RECORD;
  colrec RECORD;
  cols text := 'id';
  vals text := quote_literal(default_id);
  has_any boolean := false;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='onboarding_profiles') INTO op_exists;
  IF NOT op_exists THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='onboarding_progress') INTO pg_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adaptive_recommendations') INTO ar_exists;

  -- Create a default onboarding profile row if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_profiles WHERE id = default_id) THEN
    -- Determine required NOT NULL columns without defaults
    FOR colrec IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='onboarding_profiles'
        AND is_nullable='NO'
        AND (column_default IS NULL OR column_default = '')
        AND column_name <> 'id'
    LOOP
      has_any := true;
      cols := cols || ', ' || quote_ident(colrec.column_name);
      -- Provide safe fallbacks for common columns; generic defaults otherwise
      IF colrec.column_name = 'user_id' THEN
        vals := vals || ', ' || quote_literal('system-seed-user');
      ELSIF colrec.column_name = 'user_type' THEN
        vals := vals || ', ' || quote_literal('creator');
      ELSIF colrec.column_name = 'profession' THEN
        vals := vals || ', ' || quote_literal('photographer');
      ELSIF colrec.data_type IN ('character varying','text') THEN
        vals := vals || ', ' || quote_literal('Default');
      ELSIF colrec.data_type IN ('integer','smallint','bigint','numeric','real','double precision') THEN
        vals := vals || ', 0';
      ELSIF colrec.data_type LIKE 'timestamp%' OR colrec.data_type = 'date' THEN
        vals := vals || ', CURRENT_TIMESTAMP';
      ELSIF colrec.data_type = 'boolean' THEN
        vals := vals || ', false';
      ELSE
        vals := vals || ', ' || quote_literal('Default');
      END IF;
    END LOOP;

    EXECUTE format('INSERT INTO public.onboarding_profiles (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING', cols, vals);
  END IF;

  -- Repoint orphan references to the default profile
  IF pg_exists THEN
    UPDATE public.onboarding_progress op
    SET profile_id = default_id
    WHERE op.profile_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_profiles p WHERE p.id = op.profile_id);
  END IF;

  IF ar_exists THEN
    UPDATE public.adaptive_recommendations ar
    SET profile_id = default_id
    WHERE ar.profile_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_profiles p WHERE p.id = ar.profile_id);
  END IF;
END $$;

-- 2) Backfill missing family_trees for tree_ids referenced by family_connections/family_members/upload_sessions
DO $$
DECLARE
  ft_exists boolean;
  fc_exists boolean;
  fm_exists boolean;
  us_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='family_trees') INTO ft_exists;
  IF NOT ft_exists THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='family_connections') INTO fc_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='family_members') INTO fm_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='upload_sessions') INTO us_exists;

  IF fc_exists THEN
    INSERT INTO public.family_trees (id, event_id, client_id, tree_name, tree_type)
    SELECT DISTINCT tree_id AS id, 'seed-event', 'seed-client', 'Seed Tree ' || left(tree_id::text, 12), 'wedding'
    FROM public.family_connections
    WHERE tree_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.family_trees ft WHERE ft.id = family_connections.tree_id);
  END IF;

  IF fm_exists THEN
    INSERT INTO public.family_trees (id, event_id, client_id, tree_name, tree_type)
    SELECT DISTINCT tree_id AS id, 'seed-event', 'seed-client', 'Seed Tree ' || left(tree_id::text, 12), 'wedding'
    FROM public.family_members
    WHERE tree_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.family_trees ft WHERE ft.id = family_members.tree_id);
  END IF;

  IF us_exists THEN
    INSERT INTO public.family_trees (id, event_id, client_id, tree_name, tree_type)
    SELECT DISTINCT tree_id AS id, 'seed-event', 'seed-client', 'Seed Tree ' || left(tree_id::text, 12), 'wedding'
    FROM public.upload_sessions
    WHERE tree_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.family_trees ft WHERE ft.id = upload_sessions.tree_id);
  END IF;
END $$;

-- 3) Backfill missing family_members referenced by family_connections (member_one_id/member_two_id)
DO $$
DECLARE
  fm_exists boolean;
  fc_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='family_members') INTO fm_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='family_connections') INTO fc_exists;
  IF NOT fm_exists OR NOT fc_exists THEN RETURN; END IF;

  INSERT INTO public.family_members (id, tree_id, first_name, generation, side)
  SELECT DISTINCT fc.member_one_id AS id, fc.tree_id, 'Seed', 0, 'neutral'
  FROM public.family_connections fc
  WHERE fc.member_one_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.id = fc.member_one_id);

  INSERT INTO public.family_members (id, tree_id, first_name, generation, side)
  SELECT DISTINCT fc.member_two_id AS id, fc.tree_id, 'Seed', 0, 'neutral'
  FROM public.family_connections fc
  WHERE fc.member_two_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.family_members fm WHERE fm.id = fc.member_two_id);
END $$;

-- 4) Repair meeting_sessions/showcase_items user_id orphans by pointing to system-seed-user (safe fallback)
DO $$
DECLARE
  users_exists boolean;
  ms_exists boolean;
  si_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users') INTO users_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions') INTO ms_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='showcase_items') INTO si_exists;

  IF users_exists AND ms_exists THEN
    UPDATE public.meeting_sessions ms
    SET user_id = 'system-seed-user'
    WHERE ms.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ms.user_id);
  END IF;

  IF users_exists AND si_exists THEN
    UPDATE public.showcase_items si
    SET user_id = 'system-seed-user'
    WHERE si.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = si.user_id);
  END IF;
END $$;

-- 5) Validate some known constraints if present (best-effort)
DO $$
DECLARE
  c text;
  cmds text[] := ARRAY[
    'ALTER TABLE public.family_members VALIDATE CONSTRAINT family_members_tree_id_family_trees_id_fk',
    'ALTER TABLE public.family_connections VALIDATE CONSTRAINT family_connections_tree_id_family_trees_id_fk',
    'ALTER TABLE public.onboarding_progress VALIDATE CONSTRAINT onboarding_progress_profile_id_onboarding_profiles_id_fk',
    'ALTER TABLE public.adaptive_recommendations VALIDATE CONSTRAINT adaptive_recommendations_profile_id_onboarding_profiles_id_fk',
    'ALTER TABLE public.meeting_sessions VALIDATE CONSTRAINT meeting_sessions_user_id_users_id_fk',
    'ALTER TABLE public.showcase_items VALIDATE CONSTRAINT showcase_items_user_id_users_id_fk'
  ];
BEGIN
  FOREACH c IN ARRAY cmds LOOP
    BEGIN
      EXECUTE c;
    EXCEPTION WHEN undefined_table OR undefined_object THEN
      CONTINUE; -- Skip if either table or constraint is absent
    WHEN foreign_key_violation THEN
      CONTINUE; -- Leave NOT VALID if still invalid
    END;
  END LOOP;
END $$;
