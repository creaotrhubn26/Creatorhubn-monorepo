-- Split Sheet Database Schema
-- PostgreSQL schema for persistent storage of split sheets

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Split Sheets table
CREATE TABLE IF NOT EXISTS split_sheets (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    project_id VARCHAR(255),
    track_id VARCHAR(255),
    songflow_project_id VARCHAR(255),
    songflow_track_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signatures', 'completed', 'archived')),
    total_percentage DECIMAL(5,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Split Sheet Contributors table
CREATE TABLE IF NOT EXISTS split_sheet_contributors (
    id VARCHAR(255) PRIMARY KEY,
    split_sheet_id VARCHAR(255) NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100) NOT NULL DEFAULT 'collaborator',
    percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
    signed_at TIMESTAMP WITH TIME ZONE,
    signature_data JSONB,
    invitation_sent_at TIMESTAMP WITH TIME ZONE,
    invitation_status VARCHAR(50) DEFAULT 'not_sent' CHECK (invitation_status IN ('not_sent', 'sent', 'viewed', 'signed', 'declined')),
    user_id VARCHAR(255),
    order_index INTEGER DEFAULT 0,
    notes TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_split_sheets_user_id ON split_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_project_id ON split_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_track_id ON split_sheets(track_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_status ON split_sheets(status);
CREATE INDEX IF NOT EXISTS idx_split_sheets_updated_at ON split_sheets(updated_at);

CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_split_sheet_id ON split_sheet_contributors(split_sheet_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_email ON split_sheet_contributors(email);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_user_id ON split_sheet_contributors(user_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_order_index ON split_sheet_contributors(split_sheet_id, order_index);

-- Split Sheet SongFlow Links table
CREATE TABLE IF NOT EXISTS split_sheet_songflow_links (
    id VARCHAR(255) PRIMARY KEY,
    split_sheet_id VARCHAR(255) NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
    songflow_project_id VARCHAR(255),
    songflow_track_id VARCHAR(255),
    link_type VARCHAR(50) NOT NULL CHECK (link_type IN ('project', 'track')),
    auto_created BOOLEAN DEFAULT FALSE,
    linked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    linked_by VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_songflow_reference CHECK (
        (songflow_project_id IS NOT NULL AND songflow_track_id IS NULL) OR
        (songflow_project_id IS NULL AND songflow_track_id IS NOT NULL) OR
        (songflow_project_id IS NOT NULL AND songflow_track_id IS NOT NULL)
    )
);

-- Create indexes for SongFlow links
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_split_sheet_id ON split_sheet_songflow_links(split_sheet_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_songflow_project_id ON split_sheet_songflow_links(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_songflow_track_id ON split_sheet_songflow_links(songflow_track_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_link_type ON split_sheet_songflow_links(link_type);

