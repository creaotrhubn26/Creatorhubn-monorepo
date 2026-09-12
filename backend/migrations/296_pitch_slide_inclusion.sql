-- =====================================================================
-- 296_pitch_slide_inclusion.sql
--
-- Organisasjon-styrt slide-inkludering. Hver org skal kunne bestemme
-- hvilke slides som faktisk skal være med i presentasjonen — ikke bare
-- innholdet, men strukturen. F.eks. "vi vil ikke ha pilot-slide,"
-- "drop core_features," "alltid med proof."
--
-- Mekanikk:
--   - pitch_slides.is_included BOOL DEFAULT TRUE
--   - Studio viser toggle pr slide; tap = excluded (vises grået ut)
--   - PresentView filtrerer ut is_included=false
--   - Brief-generering ser bare is_included=true (Claude foreslår
--     ikke slides org har valgt vekk)
--   - Slettes IKKE — bevart i master så org kan re-aktivere uten
--     å regenerere innholdet
--
-- Onboarding-wizard'et vil ha et "Velg slides"-steg som lar org
-- toggle slides før Claude genererer. Default huket av alle.
-- =====================================================================

BEGIN;

ALTER TABLE pitch_slides
  ADD COLUMN IF NOT EXISTS is_included BOOLEAN NOT NULL DEFAULT true;

-- Index for raske ORDER BY position WHERE is_included queries (
-- PresentView + Brief)
CREATE INDEX IF NOT EXISTS idx_pitch_slides_deck_included
  ON pitch_slides(deck_id, position)
  WHERE is_included = true;

COMMIT;
