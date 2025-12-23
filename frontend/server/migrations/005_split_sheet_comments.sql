-- Split Sheet Comments Migration
-- Creates tables for comments and discussions on split sheets

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SPLIT SHEET COMMENTS TABLE ====================

-- Split Sheet Comments Table
CREATE TABLE IF NOT EXISTS split_sheet_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES split_sheet_comments(id) ON DELETE CASCADE, -- For threaded comments
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]', -- Array of mentioned user IDs or emails
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_comments_sheet_id ON split_sheet_comments(split_sheet_id);
CREATE INDEX idx_split_sheet_comments_parent_id ON split_sheet_comments(parent_comment_id);
CREATE INDEX idx_split_sheet_comments_user_id ON split_sheet_comments(user_id);
CREATE INDEX idx_split_sheet_comments_created_at ON split_sheet_comments(created_at);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for split_sheet_comments
CREATE TRIGGER update_split_sheet_comments_updated_at BEFORE UPDATE ON split_sheet_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_updated_at();























