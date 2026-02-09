-- Add expected_guests column to couple_profiles for guest count tracking
ALTER TABLE couple_profiles ADD COLUMN IF NOT EXISTS expected_guests INTEGER DEFAULT 0;
