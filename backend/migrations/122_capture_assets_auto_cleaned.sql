-- Slice 6: object-removal cleaned variants on capture_assets.
--
-- The iPad uploads cleaned JPGs (auto-removed studio equipment) to R2
-- after each shot via /api/capture/sessions/:sid/assets/:aid/upload-cleaned-variant.
-- This stores the resulting R2 key + Claude's detection count alongside
-- the original preview/full keys so the gallery render can re-sign the
-- cleaned variant on demand (same pattern as preview_key/full_key).
--
-- Both columns are nullable: most assets won't have a cleaned variant
-- (auto-clean toggle off, no detections found, or upload failed). The
-- IF NOT EXISTS guards make the migration safe to re-apply.

ALTER TABLE capture_assets
  ADD COLUMN IF NOT EXISTS auto_cleaned_key VARCHAR(1024);

ALTER TABLE capture_assets
  ADD COLUMN IF NOT EXISTS auto_cleaned_detection_count INTEGER;
