-- 0000c_missing_tables.sql
-- custom_profiles fantes i prod (drizzle-kit push direkte) men hadde
-- ingen CREATE TABLE i migrations-mappen — 0001_loose_kulan_gath.sql
-- refererer den (ALTER TABLE ... DISABLE ROW LEVEL SECURITY) uten at
-- den noensinne ble opprettet. Oppdaget 2026-08-16 ved migrering av ny
-- gentle-grass-DB. DDL hentet fra pg_dump mot gammel DB.

CREATE TABLE IF NOT EXISTS public.custom_profiles (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    profile_type character varying(100) NOT NULL,
    profile_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE ONLY public.custom_profiles ADD CONSTRAINT custom_profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
