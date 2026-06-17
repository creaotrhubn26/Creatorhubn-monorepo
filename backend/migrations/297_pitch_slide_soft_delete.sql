-- =====================================================================
-- 297_pitch_slide_soft_delete.sql
--
-- Sletting m/ angrerett. Hard delete er for risikabelt for en bruker
-- som lager en pitch raskt før et møte og kommer til å trykke
-- "slett" på feil slide. Soft-delete + angre-snackbar gir oss:
--
--   - DELETE-route setter deleted_at = now() istedenfor DELETE FROM
--   - Alle SELECT-er filtrerer deleted_at IS NULL
--   - POST /slides/:id/restore null'er deleted_at
--   - GET /decks/:id/trash lister slettede slides for org-papirkurv
--   - Cron purge'er slides eldre enn 30 dager (legges til senere; ikke
--     i denne migrasjonen — vi vil ha brukerne kjennske til feature'n
--     først så vi ikke purge'er det de tror er backup)
-- =====================================================================

BEGIN;

ALTER TABLE pitch_slides
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Erstatter den eksisterende inkluderings-indexen — slik at SELECT-er
-- m/ deleted_at IS NULL + is_included = true treffer ren index-only.
DROP INDEX IF EXISTS idx_pitch_slides_deck_included;
CREATE INDEX IF NOT EXISTS idx_pitch_slides_deck_active
  ON pitch_slides(deck_id, position)
  WHERE deleted_at IS NULL AND is_included = true;

-- Egen index for trash-view
CREATE INDEX IF NOT EXISTS idx_pitch_slides_deck_trash
  ON pitch_slides(deck_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

COMMIT;
