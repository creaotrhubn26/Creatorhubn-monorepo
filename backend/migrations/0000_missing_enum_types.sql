-- 0000_missing_enum_types.sql
-- Enum-typer opprettet historisk via drizzle-kit push direkte mot DB,
-- aldri fanget som SQL-migrasjon. migrate.sh kjører nå med
-- 'SQL migrations are authoritative' (drizzle push skippes på Render),
-- så en fersk DB manglet alle 28 enum-typer og ~230 migrasjoner feilet
-- (oppdaget 2026-08-16 ved migrering av ny gentle-grass-DB).
-- Idempotent: trygg å kjøre mot DB som allerede har typene.

DO $$ BEGIN
  CREATE TYPE public."aktivitet_type_v2" AS ENUM ('aktivitet','klientmøte','nettverksmøte','ansvarsgruppemøte','veiledning','dokumentasjon','kurs','annet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."audit_action" AS ENUM ('data_access','data_modification','data_deletion','login_attempt','consent_given','consent_withdrawn','privacy_settings_changed','export_requested','account_created','account_deleted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."campaign_status" AS ENUM ('active','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."client_status" AS ENUM ('active','inactive','pending','terminated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."communication_type" AS ENUM ('email','phone','meeting','report');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."competition_level" AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."consent_type" AS ENUM ('essential','functional','analytics','marketing','data_processing','email_marketing','third_party_sharing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."crawl_mode" AS ENUM ('bfs','dfs','sitemap','list');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."crawl_status" AS ENUM ('pending','queued','crawling','rendering','completed','failed','paused','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."data_category" AS ENUM ('personal_info','contact_info','professional_info','project_data','financial_data','usage_analytics','communication_data','media_files');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."device_type" AS ENUM ('desktop','mobile','tablet');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."direction" AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."field_type" AS ENUM ('text','textarea','select','date','number','checkbox','heading','divider');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."gdpr_request_status" AS ENUM ('pending','in_progress','completed','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."gdpr_request_type" AS ENUM ('data_export','data_deletion','data_correction','data_portability','processing_restriction','objection_to_processing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."goal_status_v2" AS ENUM ('aktiv','pågår','fullført','avbrutt');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."invoice_status" AS ENUM ('draft','sent','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."issue_severity" AS ENUM ('info','low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."issue_type" AS ENUM ('title_missing','title_duplicate','title_too_long','title_too_short','meta_desc_missing','meta_desc_duplicate','meta_desc_too_long','meta_desc_too_short','h1_missing','h1_multiple','h1_duplicate','h2_missing','thin_content','duplicate_content','mixed_content','broken_link','redirect_chain','redirect_loop','canonical_missing','canonical_mismatch','hreflang_missing','hreflang_invalid','robots_blocked','noindex','nofollow','slow_response','large_page','render_blocking','image_alt_missing','image_too_large','image_broken','schema_missing','schema_invalid','schema_incomplete','viewport_missing','tap_targets_small','font_too_small','http_not_https','mixed_content_security','norwegian_missing','gdpr_missing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."notification_type" AS ENUM ('ranking_change','budget_alert','task_due','report_ready');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."priority" AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."rapport_status" AS ENUM ('utkast','til_godkjenning','returnert','godkjent','arkivert');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."report_status" AS ENUM ('draft','sent','viewed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."report_type" AS ENUM ('monthly','quarterly','annual','custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."sak_status" AS ENUM ('aktiv','avsluttet','pause','venter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."seo_specialist_status" AS ENUM ('active','inactive','suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."task_status" AS ENUM ('pending','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public."trend" AS ENUM ('rising','stable','declining');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

