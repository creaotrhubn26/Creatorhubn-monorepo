-- Replace the legacy trigger chain with one explicit, project-scoped write.
-- The transaction-local marker prevents the Capture -> Photo Room trigger from
-- translating approved back to flagged while the canonical write is running.

DROP TRIGGER IF EXISTS project_photo_review_sync_capture ON project_photo_review;

CREATE OR REPLACE FUNCTION sync_project_photo_review_from_capture_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  review_project_id varchar;
  review_user_id varchar;
  next_status text;
BEGIN
  IF pg_trigger_depth() > 1
     OR current_setting('creatorhub.photo_review_sync', true) = 'from_review' THEN
    RETURN NEW;
  END IF;
  SELECT session.project_id, session.owner_user_id
    INTO review_project_id, review_user_id
    FROM public.capture_sessions session
   WHERE session.id = NEW.session_id;
  IF review_project_id IS NULL THEN
    RETURN NEW;
  END IF;
  next_status := CASE
    WHEN NEW.rejected IS TRUE THEN 'rejected'
    WHEN NEW.flagged_for_client IS TRUE THEN 'flagged'
    ELSE NULL
  END;
  INSERT INTO public.project_photo_review(asset_id, project_id, review_status, updated_by, updated_at)
  VALUES(NEW.id, review_project_id, next_status, review_user_id, now())
  ON CONFLICT(asset_id) DO UPDATE
    SET project_id=EXCLUDED.project_id,
        review_status=EXCLUDED.review_status,
        updated_by=EXCLUDED.updated_by,
        updated_at=now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION creatorhub_set_project_photo_review_status(
  requested_project_id varchar,
  requested_asset_ids uuid[],
  requested_status text,
  requesting_user_id varchar
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_count integer := 0;
BEGIN
  IF requested_status IS NOT NULL
     AND requested_status NOT IN ('approved', 'needs_edit', 'rejected', 'flagged') THEN
    RAISE EXCEPTION 'invalid photo review status' USING ERRCODE = '22023';
  END IF;
  IF requested_asset_ids IS NULL OR cardinality(requested_asset_ids) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('creatorhub.photo_review_sync', 'from_review', true);

  INSERT INTO public.project_photo_review(asset_id, project_id, review_status, updated_by, updated_at)
  SELECT asset.id, requested_project_id, requested_status, requesting_user_id, now()
    FROM public.capture_assets asset
    JOIN public.capture_sessions session ON session.id = asset.session_id
   WHERE asset.id = ANY(requested_asset_ids)
     AND session.project_id = requested_project_id
  ON CONFLICT(asset_id) DO UPDATE
    SET project_id=EXCLUDED.project_id,
        review_status=EXCLUDED.review_status,
        updated_by=EXCLUDED.updated_by,
        updated_at=now();
  GET DIAGNOSTICS affected_count = ROW_COUNT;

  UPDATE public.capture_assets asset
     SET rejected = COALESCE(requested_status = 'rejected', false),
         flagged_for_client = COALESCE(requested_status IN ('approved', 'flagged'), false),
         updated_at = now()
    FROM public.capture_sessions session
   WHERE session.id = asset.session_id
     AND session.project_id = requested_project_id
     AND asset.id = ANY(requested_asset_ids);

  PERFORM set_config('creatorhub.photo_review_sync', '', true);
  RETURN affected_count;
END;
$$;

REVOKE ALL ON FUNCTION creatorhub_set_project_photo_review_status(varchar, uuid[], text, varchar)
  FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'creatorhub_runtime_login') THEN
    GRANT EXECUTE ON FUNCTION creatorhub_set_project_photo_review_status(varchar, uuid[], text, varchar)
      TO creatorhub_runtime_login;
  END IF;
END
$$;
