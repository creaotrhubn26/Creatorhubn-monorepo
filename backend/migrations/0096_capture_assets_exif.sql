-- 0096_capture_assets_exif.sql
-- Lagrer EXIF-metadata parset i nettleseren ved opplasting + auto-genererte
-- tags fra de viktigste feltene (kamera, linse, ISO, fokallengde, dato, GPS).
-- Brukes til søk/filter i galleri og analytics ("hvilke kameraer ble brukt
-- mest denne uka?").

ALTER TABLE capture_assets
  ADD COLUMN IF NOT EXISTS exif JSONB;

ALTER TABLE capture_assets
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- GIN-index for tag-filter (WHERE tags @> ARRAY['canon-eos-r5']::text[])
CREATE INDEX IF NOT EXISTS capture_assets_tags_gin
  ON capture_assets USING gin (tags);

-- GIN-index for EXIF jsonb-søk
CREATE INDEX IF NOT EXISTS capture_assets_exif_gin
  ON capture_assets USING gin (exif);

COMMENT ON COLUMN capture_assets.exif IS
  'Parset EXIF-metadata fra opplastede filer. Inneholder camera, lens, ISO, aperture, shutter, focal length, GPS, captureDate. Fyles ved POST /api/capture/assets/:id/exif.';
COMMENT ON COLUMN capture_assets.tags IS
  'Auto-genererte tags (slug-format: "canon-eos-r5", "85mm", "iso-1600", "f-2-8", "2026-05") + manuelle tags fotograf legger til.';
