-- ============================================================================
-- MIGRATION 011: EXPAND SPLIT SHEET ROLES FOR ALL PROFESSIONS
-- ============================================================================
-- This migration expands the split_sheet_contributors.role CHECK constraint
-- to include roles for photographer and videographer professions
-- ============================================================================

-- Drop the existing CHECK constraint
ALTER TABLE split_sheet_contributors 
DROP CONSTRAINT IF EXISTS split_sheet_contributors_role_check;

-- Add new CHECK constraint with all profession-specific roles
ALTER TABLE split_sheet_contributors
ADD CONSTRAINT split_sheet_contributors_role_check 
CHECK (role IN (
  -- Music roles (existing)
  'producer',
  'artist',
  'songwriter',
  'composer',
  'lyricist',
  'vocalist',
  'instrumentalist',
  'mix_engineer',
  'mastering_engineer',
  'arranger',
  'featured_artist',
  'backing_vocalist',
  'session_musician',
  'publisher',
  'label',
  -- Photographer roles (new)
  'second_shooter',
  'photo_editor',
  'retoucher',
  'assistant',
  'stylist',
  'makeup_artist',
  -- Videographer roles (new)
  'video_editor',
  'colorist',
  'sound_engineer',
  'cinematographer',
  'grip',
  'gaffer',
  -- Generic roles
  'collaborator',
  'other'
));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================























