-- =====================================================================
-- 239_selftape_integration_hotfix.sql
--
-- Hot-fix for 3 produksjons-bugs oppdaget under ende-til-ende verifisering:
--
--   (A) Trigger v_owner_user_id var deklarert UUID, men casting_projects.created_by
--       er VARCHAR(255) → "operator does not exist: uuid = character varying"
--   (B) Demo-submissions hadde ingen casting_project_id/role_id og status='draft' →
--       triggeren kunne aldri fyre → ingen casting-candidate ble auto-opprettet →
--       ingen 📹-badge i Kanban
--   (C) v_existing_id i link-trigger var UUID, men casting_candidates.id er
--       VARCHAR(255) → samme type-mismatch når trigger forsøkte å oppdatere
--
-- Etter denne migrasjonen skal ende-til-ende flyten virke:
--   Ingrid Nilsen submission --(trigger)--> casting_candidate i TROLL Kanban
-- =====================================================================

BEGIN;

-- ── (A) + (C) Fix trigger-funksjoner — riktig variable-typer ──────

CREATE OR REPLACE FUNCTION selftape_submission_link_candidate()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_talent_name TEXT;
  v_existing_id VARCHAR(255);    -- FIX: var UUID, casting_candidates.id er VARCHAR
  v_new_id VARCHAR(255);
  v_role_exists BOOLEAN;
  v_project_exists BOOLEAN;
BEGIN
  IF NEW.target_type != 'role_specific' THEN RETURN NEW; END IF;
  IF NEW.casting_role_id IS NULL OR NEW.casting_project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status != 'submitted' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN RETURN NEW; END IF;

  BEGIN
    SELECT EXISTS(SELECT 1 FROM casting_projects WHERE id = NEW.casting_project_id)
      INTO v_project_exists;
    IF NOT v_project_exists THEN
      RAISE NOTICE 'selftape_link: casting_project_id % finnes ikke, skip', NEW.casting_project_id;
      RETURN NEW;
    END IF;
    SELECT EXISTS(SELECT 1 FROM casting_roles WHERE id = NEW.casting_role_id)
      INTO v_role_exists;
    IF NOT v_role_exists THEN
      RAISE NOTICE 'selftape_link: casting_role_id % finnes ikke, skip', NEW.casting_role_id;
      RETURN NEW;
    END IF;

    SELECT p.talent_id INTO v_talent_id
      FROM talent_selftape_projects p
     WHERE p.id = NEW.project_id;
    IF v_talent_id IS NULL THEN
      RAISE NOTICE 'selftape_link: talent_id mangler for project %', NEW.project_id;
      RETURN NEW;
    END IF;

    SELECT t.display_name INTO v_talent_name FROM talents t WHERE t.id = v_talent_id;

    SELECT id INTO v_existing_id
      FROM casting_candidates
     WHERE project_id = NEW.casting_project_id
       AND talent_id = v_talent_id
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      -- casting_candidates.id er VARCHAR; generer en lesbar slug
      v_new_id := 'sf-' || replace(NEW.id::text, '-', '');
      INSERT INTO casting_candidates
        (id, project_id, talent_id, name, status, metadata)
      VALUES (
        v_new_id,
        NEW.casting_project_id,
        v_talent_id,
        COALESCE(v_talent_name, 'Ukjent talent'),
        'requested',
        jsonb_build_object(
          'source', 'self_tape_submission',
          'self_tape_submission_id', NEW.id::text,
          'submission_id', NEW.id::text,
          'role_id', NEW.casting_role_id,
          'created_via_trigger', true,
          'created_at_iso', now()
        )
      ) ON CONFLICT (id) DO NOTHING;
    ELSE
      UPDATE casting_candidates
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
               'self_tape_submission_id', NEW.id::text,
               'submission_id', NEW.id::text,
               'self_tape_updated_at_iso', now()
             )
       WHERE id = v_existing_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'selftape_link_candidate failed (submission %): SQLSTATE=% MSG=%',
      NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Fix grant-consent trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION selftape_submission_grant_consent()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_owner_user_id VARCHAR(255);   -- FIX: var UUID, casting_projects.created_by er VARCHAR
  v_partner_ref TEXT;
  v_partner_type TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF NEW.status != 'submitted' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN RETURN NEW; END IF;

  BEGIN
    SELECT p.talent_id INTO v_talent_id
      FROM talent_selftape_projects p
     WHERE p.id = NEW.project_id;
    IF v_talent_id IS NULL THEN
      RAISE NOTICE 'selftape_grant_consent: talent_id mangler for project %', NEW.project_id;
      RETURN NEW;
    END IF;

    IF NEW.target_type = 'agency_direct' AND NEW.agency_org_id IS NOT NULL THEN
      v_partner_type := 'agency_direct';
      v_partner_ref := NEW.agency_org_id::text;
    ELSIF NEW.target_type = 'role_specific' AND NEW.casting_project_id IS NOT NULL THEN
      SELECT created_by INTO v_owner_user_id
        FROM casting_projects WHERE id = NEW.casting_project_id;
      v_partner_type := 'production_team';
      v_partner_ref := COALESCE(v_owner_user_id, NEW.casting_project_id);
    ELSIF NEW.target_type = 'private_link' THEN
      v_partner_type := 'private_link';
      v_partner_ref := COALESCE(NEW.private_token, NEW.id::text);
    ELSE
      RAISE NOTICE 'selftape_grant_consent: ukjent target_type %', NEW.target_type;
      RETURN NEW;
    END IF;

    IF v_partner_ref IS NULL THEN
      RAISE NOTICE 'selftape_grant_consent: partner_ref er null, skip';
      RETURN NEW;
    END IF;

    v_expires := COALESCE(
      NEW.deadline_at + INTERVAL '90 days',
      now() + INTERVAL '180 days'
    );

    INSERT INTO talent_consent_registry
      (talent_id, partner_type, partner_ref, scope, status, granted_at,
       expires_at, request_context)
    VALUES (
      v_talent_id, v_partner_type, v_partner_ref, 'self_tape_review',
      'granted', now(), v_expires,
      jsonb_build_object(
        'source', 'self_tape_submission',
        'submission_id', NEW.id::text,
        'target_type', NEW.target_type,
        'granted_at_iso', now()
      )
    )
    ON CONFLICT (talent_id, partner_type, partner_ref, scope) DO UPDATE
      SET status = 'granted',
          granted_at = COALESCE(talent_consent_registry.granted_at, now()),
          revoked_at = NULL,
          expires_at = GREATEST(talent_consent_registry.expires_at, EXCLUDED.expires_at),
          request_context = EXCLUDED.request_context;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'selftape_grant_consent failed (submission %): SQLSTATE=% MSG=%',
      NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── (B) Demo-seed oppdatering ─────────────────────────────────────
-- Koble Ingrid Nilsen's role_specific demo-submission til en faktisk
-- demo-rolle slik at trigger fyrer ende-til-ende.
--
-- Vi velger første tilgjengelige aktive casting-rolle som mål for demo.
-- Hvis ingen finnes (tom DB), skip og fortsett gracefully.
DO $$
DECLARE
  v_demo_role_id   VARCHAR(255);
  v_demo_project_id VARCHAR(255);
  v_submission_id  CONSTANT UUID := 'c4444444-3333-3333-3333-333333333333';
  v_demo_talent_id CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Finn et eksisterende prosjekt + rolle vi kan henge demo'en på.
  -- Prioriter prosjekt med talenter eller candidates som allerede finnes,
  -- så Kanban viser data umiddelbart.
  SELECT cr.id, cr.project_id INTO v_demo_role_id, v_demo_project_id
    FROM casting_roles cr
    JOIN casting_projects cp ON cp.id = cr.project_id
   WHERE cp.status = 'active'
   ORDER BY cp.created_at DESC NULLS LAST
   LIMIT 1;

  IF v_demo_role_id IS NULL THEN
    RAISE NOTICE 'selftape demo-seed: ingen casting-roller funnet, skip';
    RETURN;
  END IF;

  -- Oppdater Ingrid's role_specific submission til å peke til ekte rolle
  -- og marker som 'submitted' så trigger fyrer
  UPDATE talent_selftape_submissions
     SET casting_project_id = v_demo_project_id,
         casting_role_id = v_demo_role_id,
         status = 'submitted',
         submitted_at = COALESCE(submitted_at, now() - interval '2 hours'),
         status_updated_at = now()
   WHERE id = v_submission_id
     AND target_type = 'role_specific';

  RAISE NOTICE 'selftape demo-seed: koblet submission % til rolle % i prosjekt %',
    v_submission_id, v_demo_role_id, v_demo_project_id;

  -- For ekstra trygghet: håndmessig opprette candidate hvis trigger
  -- ikke fyrer (idempotent)
  INSERT INTO casting_candidates (id, project_id, talent_id, name, status, metadata)
  SELECT
    'sf-demo-ingrid-' || replace(v_demo_role_id, '-', ''),
    v_demo_project_id,
    v_demo_talent_id,
    'Ingrid Nilsen',
    'requested',
    jsonb_build_object(
      'source', 'self_tape_submission',
      'self_tape_submission_id', v_submission_id::text,
      'submission_id', v_submission_id::text,
      'role_id', v_demo_role_id,
      'demo', true
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM casting_candidates
     WHERE project_id = v_demo_project_id
       AND talent_id = v_demo_talent_id
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'selftape demo-seed: SQLSTATE=% MSG=%', SQLSTATE, SQLERRM;
END $$;

COMMIT;
