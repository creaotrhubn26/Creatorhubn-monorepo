-- Split Sheets Database Migration
-- Creates tables for music producer split sheets, contributors, and version history

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SPLIT SHEETS TABLE ====================

-- Split Sheets Table
CREATE TABLE IF NOT EXISTS split_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  track_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signatures', 'completed', 'archived')),
  total_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (total_percentage >= 0 AND total_percentage <= 100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_split_sheets_user_id ON split_sheets(user_id);
CREATE INDEX idx_split_sheets_project_id ON split_sheets(project_id);
CREATE INDEX idx_split_sheets_track_id ON split_sheets(track_id);
CREATE INDEX idx_split_sheets_status ON split_sheets(status);
CREATE INDEX idx_split_sheets_created_at ON split_sheets(created_at);

-- ==================== SPLIT SHEET CONTRIBUTORS TABLE ====================

-- Split Sheet Contributors Table
CREATE TABLE IF NOT EXISTS split_sheet_contributors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(100) NOT NULL CHECK (role IN ('producer', 'artist', 'songwriter', 'mix_engineer', 'mastering_engineer', 'featured_artist', 'collaborator', 'other')),
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  signed_at TIMESTAMP,
  signature_data JSONB,
  invitation_sent_at TIMESTAMP,
  invitation_status VARCHAR(50) DEFAULT 'not_sent' CHECK (invitation_status IN ('not_sent', 'sent', 'viewed', 'signed', 'declined')),
  user_id VARCHAR(255), -- If contributor is a registered user
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_contributors_sheet_id ON split_sheet_contributors(split_sheet_id);
CREATE INDEX idx_split_sheet_contributors_email ON split_sheet_contributors(email);
CREATE INDEX idx_split_sheet_contributors_user_id ON split_sheet_contributors(user_id);
CREATE INDEX idx_split_sheet_contributors_status ON split_sheet_contributors(invitation_status);

-- ==================== SPLIT SHEET VERSIONS TABLE ====================

-- Split Sheet Versions Table (for version history)
CREATE TABLE IF NOT EXISTS split_sheet_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes JSONB NOT NULL, -- Stores the changes made in this version
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  snapshot_data JSONB -- Full snapshot of split sheet at this version
);

CREATE INDEX idx_split_sheet_versions_sheet_id ON split_sheet_versions(split_sheet_id);
CREATE INDEX idx_split_sheet_versions_version_number ON split_sheet_versions(split_sheet_id, version_number);
CREATE INDEX idx_split_sheet_versions_created_at ON split_sheet_versions(created_at);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for split_sheets
CREATE TRIGGER update_split_sheets_updated_at BEFORE UPDATE ON split_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for split_sheet_contributors
CREATE TRIGGER update_split_sheet_contributors_updated_at BEFORE UPDATE ON split_sheet_contributors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to validate total percentage
CREATE OR REPLACE FUNCTION validate_split_sheet_percentage()
RETURNS TRIGGER AS $$
DECLARE
  total_perc DECIMAL(5,2);
BEGIN
  SELECT COALESCE(SUM(percentage), 0) INTO total_perc
  FROM split_sheet_contributors
  WHERE split_sheet_id = COALESCE(NEW.split_sheet_id, OLD.split_sheet_id);
  
  UPDATE split_sheets
  SET total_percentage = total_perc
  WHERE id = COALESCE(NEW.split_sheet_id, OLD.split_sheet_id);
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update total percentage when contributors change
CREATE TRIGGER update_split_sheet_total_percentage
  AFTER INSERT OR UPDATE OR DELETE ON split_sheet_contributors
  FOR EACH ROW EXECUTE FUNCTION validate_split_sheet_percentage();























