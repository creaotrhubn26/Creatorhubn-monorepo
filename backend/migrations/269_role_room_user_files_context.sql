-- =====================================================================
-- 269_role_room_user_files_context.sql
--
-- L4 — Kontekst-kobling for role_room_user_files.
--
-- Idag har vi `source_module` (TEXT) og `metadata` (JSONB) som svakt
-- knytter filen til opphavet. Vi trenger ekte foreign keys så vi kan
--   1. Filtrere "vis alle filer for prosjekt X"
--   2. Vise "denne storyboarden bruker 3 referansebilder"
--   3. Slette kaskaderende når et prosjekt slettes
--   4. Migrere casting_storyboards.image_data ut av Postgres til B2 og
--      knytte filen til (project_id, scene_id, storyboard_id)
-- =====================================================================

BEGIN;

ALTER TABLE role_room_user_files
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255)
    REFERENCES casting_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scene_id VARCHAR(255),
  -- Polymorfisk binding: f.eks. ('storyboard', '<uuid>'), ('role', '<uuid>'),
  -- ('role_research', '<uuid>'), ('deck_slide', '<uuid>'),
  -- ('self_tape_thumbnail', '<uuid>'), ('casting_call_poster', '<uuid>')
  ADD COLUMN IF NOT EXISTS attached_to_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS attached_to_entity_id TEXT,
  -- Beskrivelse på hva filen brukes til ("Referansebilde til scene 4")
  ADD COLUMN IF NOT EXISTS attachment_note TEXT;

-- Indekser for de viktigste filter-spørringene
CREATE INDEX IF NOT EXISTS idx_role_room_user_files_project
  ON role_room_user_files(user_id, project_id, uploaded_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_room_user_files_entity
  ON role_room_user_files(attached_to_entity_type, attached_to_entity_id)
  WHERE deleted_at IS NULL AND attached_to_entity_type IS NOT NULL;

-- ---------------------------------------------------------------------
-- Oppdater register-helper-funksjonen til å ta kontekst-felter
-- (overwrite — tar samme parametre som før + nye)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION role_room_register_user_upload(
  p_user_id VARCHAR,
  p_b2_key TEXT,
  p_display_name TEXT,
  p_size_bytes BIGINT,
  p_content_type TEXT,
  p_source_module TEXT,
  p_metadata JSONB,
  p_project_id VARCHAR DEFAULT NULL,
  p_scene_id VARCHAR DEFAULT NULL,
  p_attached_to_entity_type TEXT DEFAULT NULL,
  p_attached_to_entity_id TEXT DEFAULT NULL,
  p_attachment_note TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_file_id UUID;
BEGIN
  INSERT INTO role_room_user_files (
    user_id, b2_key, display_name, size_bytes, content_type, source_module, metadata,
    project_id, scene_id, attached_to_entity_type, attached_to_entity_id, attachment_note
  )
  VALUES (
    p_user_id, p_b2_key, p_display_name, p_size_bytes, p_content_type,
    p_source_module, COALESCE(p_metadata, '{}'::jsonb),
    p_project_id, p_scene_id, p_attached_to_entity_type, p_attached_to_entity_id, p_attachment_note
  )
  RETURNING id INTO v_file_id;

  INSERT INTO role_room_user_storage_consumption (user_id, used_bytes, file_count, last_calculated_at)
  VALUES (p_user_id, p_size_bytes, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    used_bytes = role_room_user_storage_consumption.used_bytes + p_size_bytes,
    file_count = role_room_user_storage_consumption.file_count + 1,
    last_calculated_at = NOW();

  RETURN v_file_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Storyboard-kobling: legg til b2_file_id-ref på casting_storyboards
-- (peker MOT en rad i role_room_user_files. Når satt, skal image_data
-- være NULL — den bor i B2 nå.)
-- ---------------------------------------------------------------------
ALTER TABLE casting_storyboards
  ADD COLUMN IF NOT EXISTS b2_file_id UUID
    REFERENCES role_room_user_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_casting_storyboards_b2_file
  ON casting_storyboards(b2_file_id) WHERE b2_file_id IS NOT NULL;

COMMIT;
