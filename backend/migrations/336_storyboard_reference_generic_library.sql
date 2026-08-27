-- General project reference libraries: storage-backed uploads plus an
-- invariant that anything inherited by Prompt Engine is both approved and
-- locked. Existing built-in TROLL references keep storage_file_id = NULL.

ALTER TABLE storyboard_reference_assets
  ADD COLUMN IF NOT EXISTS storage_file_id UUID
    REFERENCES role_room_user_files(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_reference_assets_project_storage_idx
  ON storyboard_reference_assets (project_id, storage_file_id)
  WHERE storage_file_id IS NOT NULL;

UPDATE storyboard_reference_assets
   SET locked = TRUE,
       updated_at = NOW()
 WHERE approval_status = 'approved'
   AND locked = FALSE;

DO $$
BEGIN
  ALTER TABLE storyboard_reference_assets
    ADD CONSTRAINT storyboard_reference_assets_approved_locked_check
    CHECK (approval_status <> 'approved' OR locked = TRUE) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE storyboard_reference_assets
  VALIDATE CONSTRAINT storyboard_reference_assets_approved_locked_check;
