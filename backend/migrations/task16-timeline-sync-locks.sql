
-- Task 16: Timeline Sync Locks & Visual Settings

-- Timeline Sync Locks table
CREATE TABLE IF NOT EXISTS timeline_sync_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  timeline_id VARCHAR(255),
  name VARCHAR(255),
  track_ids JSONB NOT NULL,
  locked BOOLEAN NOT NULL DEFAULT true,
  color VARCHAR(7),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_sync_locks_user_id_idx ON timeline_sync_locks(user_id);
CREATE INDEX IF NOT EXISTS timeline_sync_locks_project_id_idx ON timeline_sync_locks(project_id);
CREATE INDEX IF NOT EXISTS timeline_sync_locks_timeline_id_idx ON timeline_sync_locks(timeline_id);

-- Timeline Sync Lock Visual Settings table
CREATE TABLE IF NOT EXISTS timeline_sync_lock_visual_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  line_opacity JSONB NOT NULL DEFAULT '0.8',
  line_thickness JSONB NOT NULL DEFAULT '3',
  glow_enabled BOOLEAN NOT NULL DEFAULT true,
  glow_intensity JSONB NOT NULL DEFAULT '0.3',
  video_color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  audio_color VARCHAR(7) NOT NULL DEFAULT '#10b981',
  av_sync_color VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
  default_color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  locked_opacity JSONB NOT NULL DEFAULT '0.8',
  unlocked_opacity JSONB NOT NULL DEFAULT '0.4',
  dashed_lines_unlocked BOOLEAN NOT NULL DEFAULT true,
  show_lock_icons BOOLEAN NOT NULL DEFAULT true,
  icon_size JSONB NOT NULL DEFAULT '4',
  highlight_on_hover BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS timeline_sync_lock_visual_settings_user_id_idx ON timeline_sync_lock_visual_settings(user_id);

