-- Photo Room is written by the least-privilege application role. Run the two
-- tightly-scoped mirror triggers with the schema owner's rights so a review
-- update cannot depend on inherited table privileges. A fixed search_path is
-- mandatory for SECURITY DEFINER functions.

CREATE OR REPLACE FUNCTION sync_capture_asset_photo_review_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.capture_assets
     SET rejected = COALESCE(NEW.review_status = 'rejected', false),
         flagged_for_client = COALESCE(NEW.review_status IN ('approved', 'flagged'), false),
         updated_at = now()
   WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$;

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
  IF pg_trigger_depth() > 1 THEN
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'creatorhub_runtime_login') THEN
    REVOKE ALL ON FUNCTION sync_capture_asset_photo_review_status() FROM PUBLIC;
    REVOKE ALL ON FUNCTION sync_project_photo_review_from_capture_status() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION sync_capture_asset_photo_review_status()
      TO creatorhub_runtime_login;
    GRANT EXECUTE ON FUNCTION sync_project_photo_review_from_capture_status()
      TO creatorhub_runtime_login;
  END IF;
END
$$;
