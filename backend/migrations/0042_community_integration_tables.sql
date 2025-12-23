-- Community Integration Tables
-- Supports mentor sessions, file sharing, and cross-component features

-- Mentor Sessions table (for booking integration)
CREATE TABLE IF NOT EXISTS community_mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES community_groups(id) ON DELETE SET NULL,
  topic VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'scheduled', 'completed', 'cancelled', 'no_show')),
  preferred_date TIMESTAMP,
  scheduled_date TIMESTAMP,
  meeting_link VARCHAR(500),
  notes TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mentor Escalations (help desk integration)
CREATE TABLE IF NOT EXISTS community_mentor_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(255) NOT NULL,
  mentor_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escalated_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'returned')),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Community Files (shared files tracking)
CREATE TABLE IF NOT EXISTS community_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES community_channels(id) ON DELETE CASCADE,
  message_id UUID REFERENCES community_messages(id) ON DELETE SET NULL,
  uploaded_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT DEFAULT 0,
  drive_file_id VARCHAR(255),
  thumbnail_url TEXT,
  source VARCHAR(50) DEFAULT 'upload' CHECK (source IN ('upload', 'google_drive', 'project', 'portfolio')),
  source_id VARCHAR(255),
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add columns to community_messages for enhanced features
ALTER TABLE community_messages 
ADD COLUMN IF NOT EXISTS is_question BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS solution_message_id UUID REFERENCES community_messages(id),
ADD COLUMN IF NOT EXISTS is_mentor_answer BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_feedback_request BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS feedback_request_text TEXT,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(500),
ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(100);

-- Add columns to community_mentors for topic tracking
ALTER TABLE community_mentors
ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS response_time_avg INTERVAL,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2);

-- Add voting_item_id to feedback for conversion tracking
ALTER TABLE prototype_feedback
ADD COLUMN IF NOT EXISTS voting_item_id UUID REFERENCES community_voting_items(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_mentor ON community_mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_student ON community_mentor_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_status ON community_mentor_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mentor_escalations_mentor ON community_mentor_escalations(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_escalations_ticket ON community_mentor_escalations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_community_files_channel ON community_files(channel_id);
CREATE INDEX IF NOT EXISTS idx_community_files_uploader ON community_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_messages_is_question ON community_messages(is_question) WHERE is_question = true;
CREATE INDEX IF NOT EXISTS idx_messages_solution ON community_messages(solution_message_id);

