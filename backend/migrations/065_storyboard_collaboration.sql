-- ============================================================================
-- Storyboard System - Collaboration Tables
-- Migration: 065_storyboard_collaboration.sql
-- ============================================================================

-- Storyboards Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    project_id UUID,
    
    -- Storyboard Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    aspect_ratio VARCHAR(20) DEFAULT '16:9',
    
    -- Settings
    settings JSONB,
    
    -- Stats
    frame_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    
    -- Metadata
    thumbnail_url TEXT,
    tags JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboards_user_id ON virtual_studio_storyboards(user_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboards_project_id ON virtual_studio_storyboards(project_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboards_created_at ON virtual_studio_storyboards(created_at);

-- Storyboard Frames Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboard_frames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES virtual_studio_storyboards(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    
    -- Frame Position
    index INTEGER NOT NULL,
    
    -- Visual
    image_url TEXT,
    thumbnail_url TEXT,
    
    -- Shot Info
    title VARCHAR(255) NOT NULL,
    shot_type VARCHAR(30) DEFAULT 'MS',
    camera_angle VARCHAR(30) DEFAULT 'Eye Level',
    camera_movement VARCHAR(30) DEFAULT 'Static',
    
    -- Timing
    duration INTEGER DEFAULT 5,
    
    -- Notes
    description TEXT,
    technical_notes TEXT,
    dialogue TEXT,
    
    -- 3D Scene Snapshot
    scene_snapshot JSONB,
    
    -- Canvas Annotations
    canvas_state JSONB,
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboard_frames_storyboard_id ON virtual_studio_storyboard_frames(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_frames_user_id ON virtual_studio_storyboard_frames(user_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_frames_index ON virtual_studio_storyboard_frames(index);

-- Storyboard Comments Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboard_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES virtual_studio_storyboards(id) ON DELETE CASCADE,
    frame_id UUID REFERENCES virtual_studio_storyboard_frames(id) ON DELETE CASCADE,
    parent_id UUID,
    
    -- Content
    text TEXT NOT NULL,
    attachments JSONB,
    
    -- Position (for pinned comments)
    position_x DECIMAL(6,2),
    position_y DECIMAL(6,2),
    
    -- Author
    author_id VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    author_avatar TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open',
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboard_comments_storyboard_id ON virtual_studio_storyboard_comments(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_comments_frame_id ON virtual_studio_storyboard_comments(frame_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_comments_parent_id ON virtual_studio_storyboard_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_comments_author_id ON virtual_studio_storyboard_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_comments_status ON virtual_studio_storyboard_comments(status);

-- Storyboard Versions Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboard_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES virtual_studio_storyboards(id) ON DELETE CASCADE,
    
    -- Version Info
    version INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Snapshot Data
    data JSONB NOT NULL,
    frame_count INTEGER NOT NULL,
    thumbnail_url TEXT,
    
    -- Author
    author_id VARCHAR(255) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    
    -- Type
    version_type VARCHAR(20) DEFAULT 'manual',
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboard_versions_storyboard_id ON virtual_studio_storyboard_versions(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_versions_version ON virtual_studio_storyboard_versions(version);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_versions_author_id ON virtual_studio_storyboard_versions(author_id);

-- Storyboard Team Members Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboard_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES virtual_studio_storyboards(id) ON DELETE CASCADE,
    
    -- Member Info
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_avatar TEXT,
    
    -- Permission
    permission VARCHAR(20) DEFAULT 'comment',
    
    -- Invitation
    invited_by VARCHAR(255) NOT NULL,
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    
    -- Activity
    last_active_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboard_team_members_storyboard_id ON virtual_studio_storyboard_team_members(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_team_members_user_id ON virtual_studio_storyboard_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_team_members_email ON virtual_studio_storyboard_team_members(user_email);

-- Storyboard Share Links Table
CREATE TABLE IF NOT EXISTS virtual_studio_storyboard_share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storyboard_id UUID NOT NULL REFERENCES virtual_studio_storyboards(id) ON DELETE CASCADE,
    
    -- Link Info
    token VARCHAR(64) NOT NULL UNIQUE,
    
    -- Settings
    permission VARCHAR(20) DEFAULT 'view',
    expires_at TIMESTAMP,
    max_views INTEGER,
    view_count INTEGER DEFAULT 0,
    requires_password BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),
    
    -- Metadata
    created_by VARCHAR(255) NOT NULL,
    last_accessed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vs_storyboard_share_links_storyboard_id ON virtual_studio_storyboard_share_links(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_vs_storyboard_share_links_token ON virtual_studio_storyboard_share_links(token);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vs_storyboards_updated_at ON virtual_studio_storyboards;
CREATE TRIGGER update_vs_storyboards_updated_at
    BEFORE UPDATE ON virtual_studio_storyboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vs_storyboard_frames_updated_at ON virtual_studio_storyboard_frames;
CREATE TRIGGER update_vs_storyboard_frames_updated_at
    BEFORE UPDATE ON virtual_studio_storyboard_frames
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vs_storyboard_comments_updated_at ON virtual_studio_storyboard_comments;
CREATE TRIGGER update_vs_storyboard_comments_updated_at
    BEFORE UPDATE ON virtual_studio_storyboard_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vs_storyboard_team_members_updated_at ON virtual_studio_storyboard_team_members;
CREATE TRIGGER update_vs_storyboard_team_members_updated_at
    BEFORE UPDATE ON virtual_studio_storyboard_team_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vs_storyboard_share_links_updated_at ON virtual_studio_storyboard_share_links;
CREATE TRIGGER update_vs_storyboard_share_links_updated_at
    BEFORE UPDATE ON virtual_studio_storyboard_share_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Done!
SELECT 'Storyboard collaboration tables created successfully!' as result;
