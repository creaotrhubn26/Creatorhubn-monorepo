-- 294_role_room_material_categories.sql
-- Merkevare-/material-kategorier for klient↔produsent fil-deling.
--
-- role_room_client_materials.entry_type er fri TEXT (ingen CHECK-constraint),
-- så denne migrasjonen endrer ikke skjema — den dokumenterer det utvidede
-- vokabularet og indekserer for kategori-filtrering. Whitelisten håndheves i
-- backend (ALLOWED_MATERIAL_ENTRY_TYPES i role-room-routes.ts).
--
-- Utvidede entry_type-verdier (merkevare-fanen i klient-workspace):
--   brand_logo   — Logo
--   brand_colors — Farger / profil (inkl. merkevareprofil-PDF)
--   brand_fonts  — Fonter
--   reference    — Referanser (fantes)
--   other        — Annet
--   (brand_asset/asset_link/document/brief_note/feedback beholdt for bakoverkomp.)

COMMENT ON COLUMN role_room_client_materials.entry_type IS
  'Material-/merkevare-kategori. Whitelist i backend: brand_logo | brand_colors | brand_fonts | brand_asset | asset_link | reference | document | brief_note | feedback | other.';

-- Kategori-filtrering på board/fane scoper på prosjekt + entry_type.
CREATE INDEX IF NOT EXISTS idx_rr_client_materials_entry_type
  ON role_room_client_materials (project_id, entry_type);
