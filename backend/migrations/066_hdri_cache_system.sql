-- ============================================================================
-- Migration: 066_hdri_cache_system.sql
-- Description: HDRI Cache System for Virtual Studio
-- 
-- Creates tables for:
-- - hdri_cache: Cached HDRI files per user
-- - hdri_user_preferences: User preferences for caching
-- - hdri_pre_cache_jobs: Pre-cache job tracking
-- - hdri_cache_stats: Aggregated cache statistics
-- ============================================================================

-- ============================================================================
-- HDRI Cache Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS hdri_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hdri_id TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'polyhaven',
  category TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  access_count INTEGER NOT NULL DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  data_ref TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for hdri_cache
CREATE INDEX IF NOT EXISTS hdri_cache_user_id_idx ON hdri_cache(user_id);
CREATE INDEX IF NOT EXISTS hdri_cache_hdri_id_idx ON hdri_cache(hdri_id);
CREATE UNIQUE INDEX IF NOT EXISTS hdri_cache_user_hdri_idx ON hdri_cache(user_id, hdri_id);
CREATE INDEX IF NOT EXISTS hdri_cache_last_accessed_idx ON hdri_cache(last_accessed_at);
CREATE INDEX IF NOT EXISTS hdri_cache_source_idx ON hdri_cache(source);

-- ============================================================================
-- User HDRI Preferences Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS hdri_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Pre-cache settings
  auto_pre_cache BOOLEAN NOT NULL DEFAULT true,
  pre_cache_priority TEXT NOT NULL DEFAULT 'essential',
  max_cache_size INTEGER NOT NULL DEFAULT 524288000, -- 500MB
  max_cache_items INTEGER NOT NULL DEFAULT 100,
  cache_expiration_days INTEGER NOT NULL DEFAULT 30,
  
  -- User preferences
  default_hdri_id TEXT,
  favorite_hdris JSONB DEFAULT '[]'::jsonb,
  recent_hdris JSONB DEFAULT '[]'::jsonb,
  
  -- First visit tracking
  has_completed_initial_pre_cache BOOLEAN NOT NULL DEFAULT false,
  first_visit_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for hdri_user_preferences
CREATE INDEX IF NOT EXISTS hdri_user_prefs_user_id_idx ON hdri_user_preferences(user_id);

-- ============================================================================
-- Pre-Cache Jobs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS hdri_pre_cache_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'essential',
  
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  current_item TEXT,
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  
  error_log JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for hdri_pre_cache_jobs
CREATE INDEX IF NOT EXISTS hdri_pre_cache_jobs_user_id_idx ON hdri_pre_cache_jobs(user_id);
CREATE INDEX IF NOT EXISTS hdri_pre_cache_jobs_status_idx ON hdri_pre_cache_jobs(status);

-- ============================================================================
-- Cache Statistics Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS hdri_cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  total_cache_size INTEGER NOT NULL DEFAULT 0,
  total_cache_items INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  cache_misses INTEGER NOT NULL DEFAULT 0,
  
  most_used_hdris JSONB DEFAULT '[]'::jsonb,
  
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for hdri_cache_stats
CREATE INDEX IF NOT EXISTS hdri_cache_stats_user_id_idx ON hdri_cache_stats(user_id);

-- ============================================================================
-- Triggers for updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_hdri_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hdri_user_preferences_updated_at
  BEFORE UPDATE ON hdri_user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_hdri_preferences_updated_at();

CREATE TRIGGER hdri_pre_cache_jobs_updated_at
  BEFORE UPDATE ON hdri_pre_cache_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_hdri_preferences_updated_at();

-- ============================================================================
-- Function to automatically update cache stats
-- ============================================================================
CREATE OR REPLACE FUNCTION update_hdri_cache_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert cache stats for the user
  INSERT INTO hdri_cache_stats (user_id, total_cache_size, total_cache_items, last_updated_at)
  SELECT 
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(SUM(size), 0),
    COUNT(*),
    NOW()
  FROM hdri_cache
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_cache_size = EXCLUDED.total_cache_size,
    total_cache_items = EXCLUDED.total_cache_items,
    last_updated_at = NOW();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hdri_cache_stats_update
  AFTER INSERT OR UPDATE OR DELETE ON hdri_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_hdri_cache_stats();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE hdri_cache IS 'Stores cached HDRI files per user for the Virtual Studio';
COMMENT ON TABLE hdri_user_preferences IS 'User preferences for HDRI caching and pre-loading';
COMMENT ON TABLE hdri_pre_cache_jobs IS 'Tracks pre-cache job progress for users';
COMMENT ON TABLE hdri_cache_stats IS 'Aggregated cache statistics per user';

COMMENT ON COLUMN hdri_cache.source IS 'HDRI source: polyhaven, blenderkit, or custom';
COMMENT ON COLUMN hdri_cache.data_ref IS 'Reference to blob storage or inline base64 for small files';
COMMENT ON COLUMN hdri_user_preferences.auto_pre_cache IS 'Auto-start pre-caching on first visit';
COMMENT ON COLUMN hdri_user_preferences.pre_cache_priority IS 'Pre-cache priority: essential, recommended, or all';

