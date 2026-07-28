-- 0435_role_room_lti_launch_metadata.sql
--
-- Canvas-metadata + Deep Linking på LTI-launchen. Emne/emnekode/semester/
-- institusjon fra launch-claims, + deep_linking_settings (retur-URL + data).
-- Selv-heles også lat i koden (ensureNrpsColumn) — denne er for journalen.

ALTER TABLE role_room_lti_launches
  ADD COLUMN IF NOT EXISTS context_title        TEXT,  -- emne (context.title)
  ADD COLUMN IF NOT EXISTS context_label        TEXT,  -- emnekode (context.label)
  ADD COLUMN IF NOT EXISTS platform_name        TEXT,  -- institusjon (tool_platform.name)
  ADD COLUMN IF NOT EXISTS term                 TEXT,  -- semester (custom.term_name)
  ADD COLUMN IF NOT EXISTS deep_link_return_url TEXT,
  ADD COLUMN IF NOT EXISTS deep_link_data       TEXT;
