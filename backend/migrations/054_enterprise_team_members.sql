-- Enterprise Team Members Migration
-- Stores team members for enterprise accounts

CREATE TABLE IF NOT EXISTS enterprise_team_members (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'deactivated')),
  
  -- Invitation tracking
  invited_by VARCHAR(255) REFERENCES users(id),
  invited_at TIMESTAMP DEFAULT NOW(),
  joined_at TIMESTAMP,
  
  -- Deactivation tracking
  deactivated_at TIMESTAMP,
  deactivated_by VARCHAR(255) REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enterprise_team_org_id 
  ON enterprise_team_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_team_user_id 
  ON enterprise_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_team_email 
  ON enterprise_team_members(email);
CREATE INDEX IF NOT EXISTS idx_enterprise_team_status 
  ON enterprise_team_members(status);

-- Unique constraint: one email per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_team_unique_member
  ON enterprise_team_members(organization_id, email);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_enterprise_team_member_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_enterprise_team_member_timestamp ON enterprise_team_members;
CREATE TRIGGER trigger_update_enterprise_team_member_timestamp
  BEFORE UPDATE ON enterprise_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_enterprise_team_member_timestamp();

-- Comments
COMMENT ON TABLE enterprise_team_members IS 'Team members for enterprise subscription accounts';
COMMENT ON COLUMN enterprise_team_members.role IS 'admin=full access, member=standard access, viewer=read-only';
COMMENT ON COLUMN enterprise_team_members.status IS 'pending=invited, active=joined, deactivated=removed';

