-- =====================================================================
-- 238_selftape_casting_integration.sql
--
-- Kobler self-tape-submissions inn i den eksisterende utvelgelses-flyten
-- (KanbanPanel + casting_candidates) via auto-link + auto-consent + audit.
--
-- Designprinsipper (se PR #348):
--   - Talent eier filen alltid; submission er en delings-handling
--   - Explisitt grunnlag for prod-tilgang: role_specific submission ELLER
--     partnership_talent_proposal ELLER prosjekt-target
--   - Signed URLs (3t TTL) + audit per visning
--   - Default expires_at = project_end_date + 90 dager
--   - Talent kan revoke når som helst → produksjon mister tilgang
-- =====================================================================

BEGIN;

-- ── 0. Takes: støtte for eksterne video-kilder ────────────────────
-- Talent kan velge mellom CF Stream (default) eller eksterne providers.
-- AI-feedback + watermark + signed URLs fungerer KUN for CF Stream.
ALTER TABLE talent_selftape_takes
  ADD COLUMN IF NOT EXISTS source_provider VARCHAR(32) NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS external_video_id VARCHAR(120);

-- Tillatte providers (alt annet er ugyldig)
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

-- For eksterne kilder: external_url er påkrevd
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

-- ── 1. Submission-status: utvid med 'revoked' ──────────────────────
ALTER TABLE talent_selftape_submissions
  DROP CONSTRAINT IF EXISTS talent_selftape_submissions_status_check;
ALTER TABLE talent_selftape_submissions
  ADD CONSTRAINT talent_selftape_submissions_status_check
  CHECK (status IN ('draft','ready','submitted','viewed','shortlisted','passed','revoked'));

-- Felt for talent's eksplisitte revoke
ALTER TABLE talent_selftape_submissions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoke_reason TEXT,
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

-- ── 2. Indekser for Kanban-lookup (hot path) ──────────────────────
-- Produksjon spør: "alle aktive submissions for rolle X"
CREATE INDEX IF NOT EXISTS idx_selftape_submissions_role_active
  ON talent_selftape_submissions(casting_role_id, status)
  WHERE status IN ('submitted','viewed','shortlisted')
    AND casting_role_id IS NOT NULL;

-- Talent spør: "alle mine delte submissions"
CREATE INDEX IF NOT EXISTS idx_selftape_submissions_project_status
  ON talent_selftape_submissions(project_id, status);

-- ── 3. Auto-link submission til casting_candidate ──────────────────
-- Når en talent sender role_specific submission, ønsker vi at
-- produksjonsteamet ser kandidaten i Kanban automatisk (status='requested').
--
-- ROBUSTHET: All feil i triggeren fanges og logges (NOTICE). En feil i
-- linking skal ALDRI blokkere submission-INSERT — talentens data er
-- viktigere enn auto-koblingen.
CREATE OR REPLACE FUNCTION selftape_submission_link_candidate()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_talent_name TEXT;
  v_existing_id UUID;
  v_role_exists BOOLEAN;
  v_project_exists BOOLEAN;
BEGIN
  -- Guard-clauses
  IF NEW.target_type != 'role_specific' THEN RETURN NEW; END IF;
  IF NEW.casting_role_id IS NULL OR NEW.casting_project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status != 'submitted' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN RETURN NEW; END IF;

  BEGIN
    -- Verifiser at FK-targets eksisterer (defensiv — ingen orphan-koblinger)
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

    -- Hent talent fra prosjekt
    SELECT p.talent_id INTO v_talent_id
      FROM talent_selftape_projects p
     WHERE p.id = NEW.project_id;
    IF v_talent_id IS NULL THEN
      RAISE NOTICE 'selftape_link: talent_id mangler for project %', NEW.project_id;
      RETURN NEW;
    END IF;

    SELECT t.display_name INTO v_talent_name FROM talents t WHERE t.id = v_talent_id;

    -- Idempotent UPSERT (foretrekk SELECT-FIRST for å unngå INSERT-konflikt)
    SELECT id INTO v_existing_id
      FROM casting_candidates
     WHERE project_id = NEW.casting_project_id
       AND talent_id = v_talent_id
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO casting_candidates
        (project_id, talent_id, name, status, metadata)
      VALUES (
        NEW.casting_project_id,
        v_talent_id,
        COALESCE(v_talent_name, 'Ukjent talent'),
        'requested',
        jsonb_build_object(
          'source', 'self_tape_submission',
          'submission_id', NEW.id::text,
          'role_id', NEW.casting_role_id::text,
          'created_via_trigger', true,
          'created_at_iso', now()
        )
      );
    ELSE
      UPDATE casting_candidates
         SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
               'self_tape_submission_id', NEW.id::text,
               'self_tape_updated_at_iso', now()
             )
       WHERE id = v_existing_id;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Logg, men blokker IKKE submission. SQLSTATE-feil må ikke kaskadere.
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

-- ── 4. Auto-grant self_tape_review-scope ved submission ────────────
-- Eksplisitt GDPR-trail: talent har gitt consent ved å sende submission.
-- Scope expires_at default = prosjekt-slutt + 90 dager (eller +180d hvis
-- ingen end_date).
-- ROBUSTHET: omsluttet av BEGIN/EXCEPTION så en consent-feil ikke blokkerer
-- submission. Sentral GDPR-trail beholdes selv om partner-ref er null.
CREATE OR REPLACE FUNCTION selftape_submission_grant_consent()
RETURNS TRIGGER AS $$
DECLARE
  v_talent_id UUID;
  v_owner_user_id UUID;
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

    -- Bestem partner-konteksten
    IF NEW.target_type = 'agency_direct' AND NEW.agency_org_id IS NOT NULL THEN
      v_partner_type := 'agency_direct';
      v_partner_ref := NEW.agency_org_id::text;
    ELSIF NEW.target_type = 'role_specific' AND NEW.casting_project_id IS NOT NULL THEN
      SELECT created_by INTO v_owner_user_id
        FROM casting_projects WHERE id = NEW.casting_project_id;
      v_partner_type := 'production_team';
      v_partner_ref := COALESCE(v_owner_user_id::text, NEW.casting_project_id::text);
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

    -- Default-expiry: deadline_at + 90d, eller 180d fra nå
    v_expires := COALESCE(
      NEW.deadline_at + INTERVAL '90 days',
      now() + INTERVAL '180 days'
    );

    -- Idempotent UPSERT
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

-- ── 5. Revoke-trigger: når submission revokes, revoker også consent ─
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

  -- Revoker tilsvarende consent-rad
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
             SELECT created_by::text FROM casting_projects WHERE id = NEW.casting_project_id
           ))
       OR (NEW.target_type = 'private_link' AND partner_type = 'private_link'
           AND partner_ref = COALESCE(NEW.private_token, NEW.id::text))
     );

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

-- ── 6. View: aktive submissions per rolle (for Kanban-badge-lookup) ─
CREATE OR REPLACE VIEW v_casting_role_selftapes AS
SELECT
  s.id::text                          AS submission_id,
  s.casting_role_id::text             AS role_id,
  s.casting_project_id::text          AS project_id,
  s.status                            AS submission_status,
  s.submitted_at,
  s.viewed_at,
  s.view_count,
  s.last_viewed_at,
  s.revoked_at,
  s.metadata                          AS submission_metadata,
  -- Take-info
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
  -- Project (talent's eget self-tape-prosjekt)
  p.id::text                          AS selftape_project_id,
  p.talent_id::text                   AS talent_id,
  p.name                              AS selftape_project_name,
  -- Talent-display
  tl.display_name                     AS talent_display_name,
  tl.headshot_url                     AS talent_headshot_url
FROM talent_selftape_submissions s
JOIN talent_selftape_projects p   ON p.id = s.project_id
LEFT JOIN talent_selftape_takes t ON t.id = s.take_id
LEFT JOIN talents tl              ON tl.id = p.talent_id
WHERE s.status IN ('submitted','viewed','shortlisted')
  AND s.revoked_at IS NULL;

COMMENT ON VIEW v_casting_role_selftapes IS
  'Hot-path lookup for KanbanPanel: aktive self-tape-submissions koblet til casting-rolle. ' ||
  'Inkluderer talent + take + project-kontekst i én rad.';

COMMIT;
