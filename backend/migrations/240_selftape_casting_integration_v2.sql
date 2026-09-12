-- =====================================================================
-- 240_selftape_casting_integration_v2.sql
--
-- Re-deploy av 238_selftape_casting_integration.sql som ble forhindret
-- av filnavn-kollisjon med 238_role_room_mcc_link_state.sql.
-- Migrate-runneren markerte begge 238_*-filer som applied uten å kjøre
-- selftape-en. Denne migrasjonen anvender ALT-innholdet idempotent.
--
-- Inkluderer også typefix fra 239 (v_owner_user_id VARCHAR, v_existing_id VARCHAR).
--
-- ALT er idempotent — kan trygt re-kjøres.
-- =====================================================================

BEGIN;

-- ── (0) Talent-selftape-takes: eksterne kilder ─────────────────────
ALTER TABLE talent_selftape_takes
  ADD COLUMN IF NOT EXISTS source_provider VARCHAR(32) NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_video_id VARCHAR(120);

ALTER TABLE talent_selftape_takes
  DROP CONSTRAINT IF EXISTS talent_selftape_takes_source_provider_check;
ALTER TABLE talent_selftape_takes
  ADD CONSTRAINT talent_selftape_takes_source_provider_check
  CHECK (source_provider IN (
    'cloudflare_stream',
    'youtube_unlisted',
    'google_drive',
    'vimeo'
  ));

ALTER TABLE talent_selftape_takes
  DROP CONSTRAINT IF EXISTS talent_selftape_takes_external_url_check;
ALTER TABLE talent_selftape_takes
  ADD CONSTRAINT talent_selftape_takes_external_url_check
  CHECK (
    source_provider = 'cloudflare_stream'
    OR (external_url IS NOT NULL AND length(external_url) > 0)
  );

CREATE INDEX IF NOT EXISTS idx_selftape_takes_source_provider
  ON talent_selftape_takes(source_provider)
  WHERE source_provider != 'cloudflare_stream';

-- ── (1) Talent-selftape-submissions: revoke + view-tracking ───────
ALTER TABLE talent_selftape_submissions
  DROP CONSTRAINT IF EXISTS talent_selftape_submissions_status_check;
ALTER TABLE talent_selftape_submissions
  ADD CONSTRAINT talent_selftape_submissions_status_check
  CHECK (status IN ('draft','ready','submitted','viewed','shortlisted','passed','revoked'));

ALTER TABLE talent_selftape_submissions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_selftape_submissions_role_active
  ON talent_selftape_submissions(casting_role_id, status)
  WHERE status IN ('submitted','viewed','shortlisted')
    AND casting_role_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_selftape_submissions_project_status
  ON talent_selftape_submissions(project_id, status);

-- ── (2) Trigger: auto-link til casting_candidate ──────────────────
CREATE OR REPLACE FUNCTION selftape_submission_link_candidate()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_talent_name TEXT;
  v_existing_id VARCHAR(255);
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

DROP TRIGGER IF EXISTS trg_selftape_submission_link_candidate
  ON talent_selftape_submissions;
CREATE TRIGGER trg_selftape_submission_link_candidate
  AFTER INSERT OR UPDATE OF status
  ON talent_selftape_submissions
  FOR EACH ROW
  EXECUTE FUNCTION selftape_submission_link_candidate();

-- ── (3) Trigger: auto-grant consent ───────────────────────────────
CREATE OR REPLACE FUNCTION selftape_submission_grant_consent()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_owner_user_id VARCHAR(255);
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

DROP TRIGGER IF EXISTS trg_selftape_submission_grant_consent
  ON talent_selftape_submissions;
CREATE TRIGGER trg_selftape_submission_grant_consent
  AFTER INSERT OR UPDATE OF status
  ON talent_selftape_submissions
  FOR EACH ROW
  EXECUTE FUNCTION selftape_submission_grant_consent();

-- ── (4) Trigger: revoke-consent ───────────────────────────────────
CREATE OR REPLACE FUNCTION selftape_submission_revoke_consent()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
BEGIN
  IF NEW.status != 'revoked' OR OLD.status = 'revoked' THEN RETURN NEW; END IF;

  SELECT p.talent_id INTO v_talent_id
    FROM talent_selftape_projects p
   WHERE p.id = NEW.project_id;
  IF v_talent_id IS NULL THEN RETURN NEW; END IF;

  UPDATE talent_consent_registry
     SET status = 'revoked',
         revoked_at = now()
   WHERE talent_id = v_talent_id
     AND scope = 'self_tape_review'
     AND (
       (NEW.target_type = 'agency_direct' AND partner_type = 'agency_direct'
        AND partner_ref = NEW.agency_org_id::text)
       OR (NEW.target_type = 'role_specific' AND partner_type = 'production_team'
           AND partner_ref IN (
             SELECT created_by FROM casting_projects WHERE id = NEW.casting_project_id
           ))
       OR (NEW.target_type = 'private_link' AND partner_type = 'private_link'
           AND partner_ref = COALESCE(NEW.private_token, NEW.id::text))
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'selftape_revoke_consent failed: SQLSTATE=% MSG=%', SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_selftape_submission_revoke_consent
  ON talent_selftape_submissions;
CREATE TRIGGER trg_selftape_submission_revoke_consent
  AFTER UPDATE OF status
  ON talent_selftape_submissions
  FOR EACH ROW
  EXECUTE FUNCTION selftape_submission_revoke_consent();

-- ── (5) View for Kanban-lookup ────────────────────────────────────
CREATE OR REPLACE VIEW v_casting_role_selftapes AS
SELECT
  s.id::text                          AS submission_id,
  s.casting_role_id                   AS role_id,
  s.casting_project_id                AS project_id,
  s.status                            AS submission_status,
  s.submitted_at,
  s.viewed_at,
  s.view_count,
  s.last_viewed_at,
  s.revoked_at,
  s.metadata                          AS submission_metadata,
  t.id::text                          AS take_id,
  t.take_number,
  t.duration_ms,
  t.thumbnail_url,
  t.video_url,
  t.hls_manifest,
  t.stream_uid,
  t.source_provider,
  t.external_url,
  t.external_video_id,
  t.ai_feedback_id::text              AS ai_feedback_id,
  p.id::text                          AS selftape_project_id,
  p.talent_id::text                   AS talent_id,
  p.name                              AS selftape_project_name,
  tl.display_name                     AS talent_display_name,
  tl.headshot_url                     AS talent_headshot_url
FROM talent_selftape_submissions s
JOIN talent_selftape_projects p   ON p.id = s.project_id
LEFT JOIN talent_selftape_takes t ON t.id = s.take_id
LEFT JOIN talents tl              ON tl.id = p.talent_id
WHERE s.status IN ('submitted','viewed','shortlisted')
  AND s.revoked_at IS NULL;

COMMENT ON VIEW v_casting_role_selftapes IS
  'Hot-path lookup for KanbanPanel + CastingPlannerPanel: aktive self-tape-submissions ' ||
  'koblet til casting-rolle. Inkluderer talent + take + project-kontekst i én rad.';

-- ── (6) Demo-seed: koble Ingrid Nilsen til faktisk casting-rolle ──
DO $$
DECLARE
  v_demo_role_id   VARCHAR(255);
  v_demo_project_id VARCHAR(255);
  v_submission_id  CONSTANT UUID := 'c4444444-3333-3333-3333-333333333333';
  v_demo_talent_id CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
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

  -- Sikre at submission med fast UUID finnes (kan være innsatt av migrate 236)
  INSERT INTO talent_selftape_submissions
    (id, project_id, take_id, target_type, enabled, status, is_demo,
     casting_project_id, casting_role_id, submitted_at, status_updated_at)
  SELECT
    v_submission_id,
    'c1111111-1111-1111-1111-111111111111'::uuid,
    'c3333333-3333-3333-3333-333333333333'::uuid,  -- Take 3
    'role_specific', TRUE, 'submitted', TRUE,
    v_demo_project_id, v_demo_role_id,
    now() - interval '2 hours', now()
  WHERE EXISTS (
    SELECT 1 FROM talent_selftape_projects WHERE id = 'c1111111-1111-1111-1111-111111111111'
  )
  ON CONFLICT (id) DO UPDATE
    SET casting_project_id = EXCLUDED.casting_project_id,
        casting_role_id = EXCLUDED.casting_role_id,
        status = 'submitted',
        submitted_at = COALESCE(talent_selftape_submissions.submitted_at, EXCLUDED.submitted_at),
        status_updated_at = now();

  RAISE NOTICE 'selftape demo-seed: koblet submission % til rolle % i prosjekt %',
    v_submission_id, v_demo_role_id, v_demo_project_id;

  -- Backup: opprett candidate-rad direkte hvis trigger ikke fanget
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
