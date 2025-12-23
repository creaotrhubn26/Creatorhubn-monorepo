-- Migration: Add tutorial video fields to platform_announcements
-- Date: 2025-10-29
-- Description: Add tutorial_video_url, tutorial_title, and tutorial_description columns to support embedded tutorial videos in announcements

-- Add tutorial video URL column
ALTER TABLE platform_announcements 
ADD COLUMN IF NOT EXISTS tutorial_video_url TEXT;

-- Add tutorial title column
ALTER TABLE platform_announcements 
ADD COLUMN IF NOT EXISTS tutorial_title TEXT;

-- Add tutorial description column
ALTER TABLE platform_announcements 
ADD COLUMN IF NOT EXISTS tutorial_description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN platform_announcements.tutorial_video_url IS 'Embed URL for tutorial video (YouTube, Vimeo, etc.)';
COMMENT ON COLUMN platform_announcements.tutorial_title IS 'Title for the tutorial video section';
COMMENT ON COLUMN platform_announcements.tutorial_description IS 'Description of what the tutorial video demonstrates';

-- Create index for faster lookups of announcements with tutorials
CREATE INDEX IF NOT EXISTS idx_announcements_with_tutorial 
ON platform_announcements(tutorial_video_url) 
WHERE tutorial_video_url IS NOT NULL;
