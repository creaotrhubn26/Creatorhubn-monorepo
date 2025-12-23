-- Phase 2: Timeline Visual Hierarchy Schema Migration
-- Creates 6 new tables for StoryArcStudio timeline features

-- ============================================================================
-- TIMELINE MARKER CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_marker_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  icon VARCHAR(50) NOT NULL,
  description TEXT,
  is_built_in BOOLEAN DEFAULT FALSE,
  hotkey VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_marker_categories_user_id_idx ON timeline_marker_categories(user_id);

-- ============================================================================
-- TIMELINE MARKERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  project_id UUID,
  timeline_id UUID,
  category_id UUID NOT NULL,
  time DECIMAL(10, 3) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration DECIMAL(10, 3),
  is_visible BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_markers_user_id_idx ON timeline_markers(user_id);
CREATE INDEX IF NOT EXISTS timeline_markers_project_id_idx ON timeline_markers(project_id);
CREATE INDEX IF NOT EXISTS timeline_markers_timeline_id_idx ON timeline_markers(timeline_id);
CREATE INDEX IF NOT EXISTS timeline_markers_category_id_idx ON timeline_markers(category_id);
CREATE INDEX IF NOT EXISTS timeline_markers_time_idx ON timeline_markers(time);

-- ============================================================================
-- TIMELINE COLOR SCHEMES (Semantic Color Coding)
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_color_schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  colors JSONB NOT NULL,
  category_labels JSONB,
  custom_categories JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_color_schemes_user_id_idx ON timeline_color_schemes(user_id);

-- ============================================================================
-- TIMELINE VISIBILITY PRESETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_visibility_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7),
  track_visibility JSONB NOT NULL,
  is_built_in BOOLEAN DEFAULT FALSE,
  hotkey VARCHAR(10),
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_visibility_presets_user_id_idx ON timeline_visibility_presets(user_id);

-- ============================================================================
-- TIMELINE RIPPLE SETTINGS (per user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_ripple_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE,
  auto_close_gaps BOOLEAN DEFAULT TRUE,
  respect_sync_groups BOOLEAN DEFAULT TRUE,
  show_conflict_warnings BOOLEAN DEFAULT TRUE,
  ripple_mode VARCHAR(20) DEFAULT 'selected',
  minimum_gap_size DECIMAL(5, 3) DEFAULT 0.1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_ripple_settings_user_id_idx ON timeline_ripple_settings(user_id);

-- ============================================================================
-- TIMELINE COMPOUND CLIPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS timeline_compound_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  project_id UUID,
  timeline_id UUID,
  clip_id VARCHAR NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_expanded BOOLEAN DEFAULT FALSE,
  nested_clips JSONB,
  depth DECIMAL(3, 0) DEFAULT 0,
  color VARCHAR(7),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_compound_clips_user_id_idx ON timeline_compound_clips(user_id);
CREATE INDEX IF NOT EXISTS timeline_compound_clips_project_id_idx ON timeline_compound_clips(project_id);
CREATE INDEX IF NOT EXISTS timeline_compound_clips_timeline_id_idx ON timeline_compound_clips(timeline_id);
CREATE INDEX IF NOT EXISTS timeline_compound_clips_clip_id_idx ON timeline_compound_clips(clip_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all tables were created
SELECT 'timeline_marker_categories' AS table_name, COUNT(*) AS exists 
FROM information_schema.tables 
WHERE table_name = 'timeline_marker_categories'
UNION ALL
SELECT 'timeline_markers', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'timeline_markers'
UNION ALL
SELECT 'timeline_color_schemes', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'timeline_color_schemes'
UNION ALL
SELECT 'timeline_visibility_presets', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'timeline_visibility_presets'
UNION ALL
SELECT 'timeline_ripple_settings', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'timeline_ripple_settings'
UNION ALL
SELECT 'timeline_compound_clips', COUNT(*) 
FROM information_schema.tables 
WHERE table_name = 'timeline_compound_clips';
