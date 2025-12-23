-- Enterprise Inquiries Migration
-- Stores enterprise plan upgrade requests from users

-- Enterprise Inquiries Table
CREATE TABLE IF NOT EXISTS enterprise_inquiries (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) REFERENCES users(id),
  org_number VARCHAR(20),
  company_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  team_size INTEGER NOT NULL DEFAULT 3,
  team_description TEXT,
  use_case TEXT NOT NULL,
  additional_message TEXT,
  industry VARCHAR(100),
  current_plan VARCHAR(50) DEFAULT 'pro',

  -- Google Workspace verification
  has_google_workspace BOOLEAN DEFAULT false,
  workspace_domain VARCHAR(255),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected', 'converted')),
  reviewed_by VARCHAR(255) REFERENCES users(id),
  reviewed_at TIMESTAMP,
  admin_notes TEXT,

  -- Conversion tracking
  converted_at TIMESTAMP,
  enterprise_subscription_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_status 
  ON enterprise_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_user_id 
  ON enterprise_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_org_number 
  ON enterprise_inquiries(org_number);
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_created_at 
  ON enterprise_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_pending 
  ON enterprise_inquiries(status) WHERE status = 'pending';

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_enterprise_inquiry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_enterprise_inquiry_timestamp ON enterprise_inquiries;
CREATE TRIGGER trigger_update_enterprise_inquiry_timestamp
  BEFORE UPDATE ON enterprise_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_enterprise_inquiry_timestamp();

-- Comments
COMMENT ON TABLE enterprise_inquiries IS 'Enterprise plan upgrade requests from users';
COMMENT ON COLUMN enterprise_inquiries.status IS 'pending=new, reviewing=in progress, approved=accepted, rejected=declined, converted=upgraded';

