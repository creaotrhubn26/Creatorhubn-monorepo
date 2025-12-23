-- Migration: Content Calendar and Scheduled Publishing
-- Date: 2025-10-31
-- Description: Add content calendar, scheduling, and draft management for announcements

-- Content Calendar Events
CREATE TABLE IF NOT EXISTS content_calendar_events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL, -- 'announcement', 'video', 'blog', 'social', 'campaign'
  status VARCHAR(50) NOT NULL DEFAULT 'planned', -- 'planned', 'in-progress', 'ready', 'published', 'cancelled'
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  published_date TIMESTAMP,
  
  -- Assignment
  assigned_to VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  
  -- Marketing metadata
  marketing_purpose VARCHAR(50), -- 'brand-awareness', 'lead-generation', 'seo', 'education', 'sales'
  target_audience JSONB, -- Array of professions
  
  -- References
  announcement_id UUID, -- Reference to platform_announcements if needed
  youtube_video_id VARCHAR(255),
  
  -- Notes and tracking
  notes TEXT,
  progress_percentage INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcement Drafts
CREATE TABLE IF NOT EXISTS announcement_drafts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  importance VARCHAR(50) NOT NULL,
  
  -- Targeting
  target_professions JSONB,
  target_user_types JSONB,
  
  -- Media
  image_url TEXT,
  tutorial_video_url TEXT,
  tutorial_title VARCHAR(255),
  tutorial_description TEXT,
  
  -- Marketing fields
  marketing_purpose VARCHAR(50),
  target_audience JSONB,
  call_to_action TEXT,
  
  -- Actions
  action_label VARCHAR(100),
  action_url TEXT,
  feature_key VARCHAR(100),
  
  -- Scheduling
  scheduled_publish_date TIMESTAMP,
  auto_publish BOOLEAN DEFAULT false,
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_draft_id INTEGER REFERENCES announcement_drafts(id),
  
  -- Metadata
  created_by VARCHAR(255) NOT NULL,
  last_edited_by VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Calendar Templates
CREATE TABLE IF NOT EXISTS content_calendar_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- 'monthly', 'quarterly', 'campaign'
  
  -- Template structure (JSON)
  schedule_template JSONB NOT NULL, -- Array of events with relative dates
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Publishing Queue
CREATE TABLE IF NOT EXISTS publishing_queue (
  id SERIAL PRIMARY KEY,
  queue_type VARCHAR(50) NOT NULL, -- 'announcement', 'youtube', 'social'
  
  -- Reference
  draft_id INTEGER REFERENCES announcement_drafts(id),
  calendar_event_id INTEGER REFERENCES content_calendar_events(id),
  
  -- Scheduling
  scheduled_time TIMESTAMP NOT NULL,
  published_time TIMESTAMP,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'published', 'failed', 'cancelled'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Metadata
  payload JSONB, -- Full data needed for publishing
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Performance Tracking
CREATE TABLE IF NOT EXISTS content_performance (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- 'announcement', 'video', 'blog'
  
  -- Metrics
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Video specific
  watch_time_seconds INTEGER,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Time tracking
  tracked_date DATE NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(content_id, content_type, tracked_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON content_calendar_events(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON content_calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON content_calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled ON announcement_drafts(scheduled_publish_date) WHERE scheduled_publish_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drafts_user ON announcement_drafts(created_by);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON publishing_queue(scheduled_time, status);
CREATE INDEX IF NOT EXISTS idx_queue_status ON publishing_queue(status);
CREATE INDEX IF NOT EXISTS idx_performance_date ON content_performance(tracked_date);

-- Comments
COMMENT ON TABLE content_calendar_events IS 'Monthly content calendar for planning announcements, videos, and campaigns';
COMMENT ON TABLE announcement_drafts IS 'Draft announcements that can be scheduled or saved for later';
COMMENT ON TABLE content_calendar_templates IS 'Reusable templates for monthly content planning';
COMMENT ON TABLE publishing_queue IS 'Scheduled publishing queue with retry logic';
COMMENT ON TABLE content_performance IS 'Track performance metrics for all content types';
