-- ============================================================================
-- SPLIT SHEETS CONSOLIDATED MIGRATION
-- ============================================================================
-- This file consolidates all split sheet migrations (003-010) in order
-- Run this file to set up the complete split sheet system
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- MIGRATION 003: CORE SPLIT SHEETS
-- ============================================================================

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
  user_id VARCHAR(255),
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_contributors_sheet_id ON split_sheet_contributors(split_sheet_id);
CREATE INDEX idx_split_sheet_contributors_email ON split_sheet_contributors(email);
CREATE INDEX idx_split_sheet_contributors_user_id ON split_sheet_contributors(user_id);
CREATE INDEX idx_split_sheet_contributors_status ON split_sheet_contributors(invitation_status);

-- Split Sheet Versions Table
CREATE TABLE IF NOT EXISTS split_sheet_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  changes JSONB NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  snapshot_data JSONB
);

CREATE INDEX idx_split_sheet_versions_sheet_id ON split_sheet_versions(split_sheet_id);
CREATE INDEX idx_split_sheet_versions_version_number ON split_sheet_versions(split_sheet_id, version_number);
CREATE INDEX idx_split_sheet_versions_created_at ON split_sheet_versions(created_at);

-- ============================================================================
-- MIGRATION 004: REVENUE & PAYMENTS
-- ============================================================================

-- Split Sheet Revenue Table
CREATE TABLE IF NOT EXISTS split_sheet_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NOK',
  revenue_source VARCHAR(50) NOT NULL CHECK (revenue_source IN ('streaming', 'sales', 'sync', 'performance', 'mechanical', 'publishing', 'other')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  platform VARCHAR(100),
  description TEXT,
  invoice_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_split_sheet_revenue_sheet_id ON split_sheet_revenue(split_sheet_id);
CREATE INDEX idx_split_sheet_revenue_period ON split_sheet_revenue(period_start, period_end);
CREATE INDEX idx_split_sheet_revenue_source ON split_sheet_revenue(revenue_source);
CREATE INDEX idx_split_sheet_revenue_platform ON split_sheet_revenue(platform);
CREATE INDEX idx_split_sheet_revenue_created_at ON split_sheet_revenue(created_at);
CREATE INDEX idx_split_sheet_revenue_invoice ON split_sheet_revenue(invoice_id);

-- Split Sheet Payments Table
CREATE TABLE IF NOT EXISTS split_sheet_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES split_sheet_contributors(id) ON DELETE CASCADE,
  revenue_id UUID REFERENCES split_sheet_revenue(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NOK',
  percentage DECIMAL(5,2) NOT NULL,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP
);

CREATE INDEX idx_split_sheet_payments_sheet_id ON split_sheet_payments(split_sheet_id);
CREATE INDEX idx_split_sheet_payments_contributor_id ON split_sheet_payments(contributor_id);
CREATE INDEX idx_split_sheet_payments_revenue_id ON split_sheet_payments(revenue_id);
CREATE INDEX idx_split_sheet_payments_status ON split_sheet_payments(payment_status);
CREATE INDEX idx_split_sheet_payments_date ON split_sheet_payments(payment_date);

-- ============================================================================
-- MIGRATION 005: COMMENTS
-- ============================================================================

-- Split Sheet Comments Table
CREATE TABLE IF NOT EXISTS split_sheet_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES split_sheet_comments(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]',
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_comments_sheet_id ON split_sheet_comments(split_sheet_id);
CREATE INDEX idx_split_sheet_comments_parent_id ON split_sheet_comments(parent_comment_id);
CREATE INDEX idx_split_sheet_comments_user_id ON split_sheet_comments(user_id);
CREATE INDEX idx_split_sheet_comments_created_at ON split_sheet_comments(created_at);

-- ============================================================================
-- MIGRATION 006: TEMPLATES
-- ============================================================================

-- Split Sheet Templates Table
CREATE TABLE IF NOT EXISTS split_sheet_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  contributors JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_templates_user_id ON split_sheet_templates(user_id);
CREATE INDEX idx_split_sheet_templates_system ON split_sheet_templates(is_system_template);
CREATE INDEX idx_split_sheet_templates_public ON split_sheet_templates(is_public);
CREATE INDEX idx_split_sheet_templates_usage ON split_sheet_templates(usage_count DESC);

-- ============================================================================
-- MIGRATION 008: SONGFLOW INTEGRATION
-- ============================================================================

-- Add SongFlow columns to split_sheets
ALTER TABLE split_sheets 
ADD COLUMN IF NOT EXISTS songflow_project_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS songflow_track_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_project_id ON split_sheets(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_track_id ON split_sheets(songflow_track_id);

-- Split Sheet SongFlow Links Table
CREATE TABLE IF NOT EXISTS split_sheet_songflow_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  songflow_project_id VARCHAR(255),
  songflow_track_id VARCHAR(255),
  link_type VARCHAR(50) NOT NULL DEFAULT 'track' CHECK (link_type IN ('project', 'track')),
  auto_created BOOLEAN DEFAULT FALSE,
  linked_at TIMESTAMP DEFAULT NOW(),
  linked_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT check_songflow_id CHECK (
    songflow_project_id IS NOT NULL OR songflow_track_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_split_sheet_id ON split_sheet_songflow_links(split_sheet_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_project_id ON split_sheet_songflow_links(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_track_id ON split_sheet_songflow_links(songflow_track_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_songflow_links_type ON split_sheet_songflow_links(link_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_split_sheet_songflow_link 
ON split_sheet_songflow_links(split_sheet_id, songflow_track_id) 
WHERE songflow_track_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_split_sheet_songflow_project_link 
ON split_sheet_songflow_links(split_sheet_id, songflow_project_id) 
WHERE songflow_project_id IS NOT NULL;

-- ============================================================================
-- MIGRATION 010: INTEGRATIONS (Contributor Access, Invoices, Calendar)
-- ============================================================================

-- Split Sheet Contributor Access Table
CREATE TABLE IF NOT EXISTS split_sheet_contributor_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contributor_id UUID NOT NULL REFERENCES split_sheet_contributors(id) ON DELETE CASCADE,
  access_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_contributor_access_token ON split_sheet_contributor_access(access_token);
CREATE INDEX idx_contributor_access_contributor ON split_sheet_contributor_access(contributor_id);
CREATE INDEX idx_contributor_access_expires ON split_sheet_contributor_access(expires_at);

-- Split Sheet Invoices Table
CREATE TABLE IF NOT EXISTS split_sheet_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NOK',
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  recipient_email VARCHAR(255),
  due_date DATE,
  paid_at TIMESTAMP,
  fiken_invoice_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_invoices_sheet ON split_sheet_invoices(split_sheet_id);
CREATE INDEX idx_split_sheet_invoices_status ON split_sheet_invoices(status);
CREATE INDEX idx_split_sheet_invoices_fiken ON split_sheet_invoices(fiken_invoice_id);

-- Split Sheet Calendar Events Table
CREATE TABLE IF NOT EXISTS split_sheet_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('signature_deadline', 'payment_due', 'revenue_period', 'created', 'completed')),
  event_date DATE NOT NULL,
  event_title VARCHAR(255) NOT NULL,
  description TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  reminder_sent_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_calendar_events_sheet ON split_sheet_calendar_events(split_sheet_id);
CREATE INDEX idx_split_sheet_calendar_events_date ON split_sheet_calendar_events(event_date);
CREATE INDEX idx_split_sheet_calendar_events_type ON split_sheet_calendar_events(event_type);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp (generic)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_split_sheets_updated_at BEFORE UPDATE ON split_sheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_contributors_updated_at BEFORE UPDATE ON split_sheet_contributors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_revenue_updated_at BEFORE UPDATE ON split_sheet_revenue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_payments_updated_at BEFORE UPDATE ON split_sheet_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_comments_updated_at BEFORE UPDATE ON split_sheet_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_templates_updated_at BEFORE UPDATE ON split_sheet_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_songflow_links_updated_at BEFORE UPDATE ON split_sheet_songflow_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_invoices_updated_at BEFORE UPDATE ON split_sheet_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_split_sheet_calendar_events_updated_at BEFORE UPDATE ON split_sheet_calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to validate and update total percentage
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

CREATE TRIGGER update_split_sheet_total_percentage
  AFTER INSERT OR UPDATE OR DELETE ON split_sheet_contributors
  FOR EACH ROW EXECUTE FUNCTION validate_split_sheet_percentage();

-- Function to auto-calculate payments when revenue is added
CREATE OR REPLACE FUNCTION calculate_payments_on_revenue()
RETURNS TRIGGER AS $$
DECLARE
  contributor_record RECORD;
  payment_amount DECIMAL(10,2);
BEGIN
  FOR contributor_record IN
    SELECT id, percentage, split_sheet_id
    FROM split_sheet_contributors
    WHERE split_sheet_id = NEW.split_sheet_id
  LOOP
    payment_amount := (NEW.amount * contributor_record.percentage / 100.0);
    
    INSERT INTO split_sheet_payments (
      split_sheet_id,
      contributor_id,
      revenue_id,
      amount,
      currency,
      percentage,
      payment_status
    )
    VALUES (
      NEW.split_sheet_id,
      contributor_record.id,
      NEW.id,
      payment_amount,
      NEW.currency,
      contributor_record.percentage,
      'pending'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_calculate_payments
  AFTER INSERT ON split_sheet_revenue
  FOR EACH ROW EXECUTE FUNCTION calculate_payments_on_revenue();

-- Function to sync SongFlow columns with junction table
CREATE OR REPLACE FUNCTION sync_split_sheet_songflow_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE split_sheets
    SET 
      songflow_project_id = COALESCE(NEW.songflow_project_id, songflow_project_id),
      songflow_track_id = COALESCE(NEW.songflow_track_id, songflow_track_id)
    WHERE id = NEW.split_sheet_id;
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER sync_split_sheet_songflow_columns_trigger
AFTER INSERT ON split_sheet_songflow_links
FOR EACH ROW EXECUTE FUNCTION sync_split_sheet_songflow_columns();

-- Function to generate contributor access token
CREATE OR REPLACE FUNCTION generate_contributor_access_token(contributor_uuid UUID, days_valid INTEGER DEFAULT 30)
RETURNS VARCHAR(255) AS $$
DECLARE
  token VARCHAR(255);
BEGIN
  token := encode(gen_random_bytes(32), 'hex');
  
  INSERT INTO split_sheet_contributor_access (contributor_id, access_token, expires_at)
  VALUES (contributor_uuid, token, NOW() + (days_valid || ' days')::INTERVAL)
  ON CONFLICT (access_token) DO UPDATE SET
    expires_at = NOW() + (days_valid || ' days')::INTERVAL,
    last_used_at = NULL;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DEFAULT DATA
-- ============================================================================

-- Insert default system templates
INSERT INTO split_sheet_templates (id, user_id, name, description, is_system_template, is_public, contributors)
VALUES
  (
    uuid_generate_v4(),
    NULL,
    '50/50 Produsent-Artist',
    'Standard 50/50 split mellom produsent og artist',
    TRUE,
    TRUE,
    '[
      {"name": "", "email": "", "role": "producer", "percentage": 50, "order_index": 0},
      {"name": "", "email": "", "role": "artist", "percentage": 50, "order_index": 1}
    ]'::jsonb
  ),
  (
    uuid_generate_v4(),
    NULL,
    'Standard 3-veis Split',
    'Produsent 50%, Artist 30%, Låtskriver 20%',
    TRUE,
    TRUE,
    '[
      {"name": "", "email": "", "role": "producer", "percentage": 50, "order_index": 0},
      {"name": "", "email": "", "role": "artist", "percentage": 30, "order_index": 1},
      {"name": "", "email": "", "role": "songwriter", "percentage": 20, "order_index": 2}
    ]'::jsonb
  ),
  (
    uuid_generate_v4(),
    NULL,
    'Produsent med Miksing',
    'Produsent 60%, Artist 30%, Mix Engineer 10%',
    TRUE,
    TRUE,
    '[
      {"name": "", "email": "", "role": "producer", "percentage": 60, "order_index": 0},
      {"name": "", "email": "", "role": "artist", "percentage": 30, "order_index": 1},
      {"name": "", "email": "", "role": "mix_engineer", "percentage": 10, "order_index": 2}
    ]'::jsonb
  ),
  (
    uuid_generate_v4(),
    NULL,
    'Full Produksjon',
    'Produsent 40%, Artist 25%, Låtskriver 20%, Mix 10%, Mastering 5%',
    TRUE,
    TRUE,
    '[
      {"name": "", "email": "", "role": "producer", "percentage": 40, "order_index": 0},
      {"name": "", "email": "", "role": "artist", "percentage": 25, "order_index": 1},
      {"name": "", "email": "", "role": "songwriter", "percentage": 20, "order_index": 2},
      {"name": "", "email": "", "role": "mix_engineer", "percentage": 10, "order_index": 3},
      {"name": "", "email": "", "role": "mastering_engineer", "percentage": 5, "order_index": 4}
    ]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================























