-- PRO Connections Migration
-- Creates tables for user-managed PRO account connections

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PRO CONNECTIONS TABLE ====================

-- PRO Connections Table (user-managed)
CREATE TABLE IF NOT EXISTS pro_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  pro_name VARCHAR(100) NOT NULL CHECK (pro_name IN ('tono', 'stim', 'other')),
  access_token_encrypted TEXT, -- Encrypted OAuth access token
  refresh_token_encrypted TEXT, -- Encrypted OAuth refresh token
  token_expires_at TIMESTAMP,
  pro_account_id VARCHAR(255), -- User's PRO account identifier
  isrc_prefix VARCHAR(12), -- ISRC prefix from PRO
  connection_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'disconnected', 'error')),
  last_sync_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pro_connections_user_id ON pro_connections(user_id);
CREATE INDEX idx_pro_connections_pro_name ON pro_connections(pro_name);
CREATE INDEX idx_pro_connections_status ON pro_connections(connection_status);

-- ==================== PRO WORKS TABLE ====================

-- PRO Works Table (links split sheets to PRO works)
CREATE TABLE IF NOT EXISTS pro_works (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  pro_connection_id UUID REFERENCES pro_connections(id) ON DELETE SET NULL,
  pro_work_id VARCHAR(255), -- Work ID in PRO system
  isrc_code VARCHAR(12), -- ISRC code for the work
  registration_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'registered', 'rejected', 'error')),
  registration_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pro_works_split_sheet_id ON pro_works(split_sheet_id);
CREATE INDEX idx_pro_works_connection_id ON pro_works(pro_connection_id);
CREATE INDEX idx_pro_works_isrc ON pro_works(isrc_code);
CREATE INDEX idx_pro_works_status ON pro_works(registration_status);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pro_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for pro_connections
CREATE TRIGGER update_pro_connections_updated_at BEFORE UPDATE ON pro_connections
  FOR EACH ROW EXECUTE FUNCTION update_pro_updated_at();

-- Trigger for pro_works
CREATE TRIGGER update_pro_works_updated_at BEFORE UPDATE ON pro_works
  FOR EACH ROW EXECUTE FUNCTION update_pro_updated_at();























