-- Split Sheet Integrations Migration
-- Creates tables and columns for split sheet integrations with other systems

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== CONTRIBUTOR ACCESS TOKENS ====================

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

-- ==================== INVOICE LINKS ====================

-- Add invoice_id column to split_sheet_revenue if it doesn't exist
ALTER TABLE split_sheet_revenue
ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_split_sheet_revenue_invoice ON split_sheet_revenue(invoice_id);

-- ==================== SPLIT SHEET INVOICES TABLE ====================

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

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_split_sheet_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_split_sheet_invoices_updated_at
BEFORE UPDATE ON split_sheet_invoices
FOR EACH ROW
EXECUTE FUNCTION update_split_sheet_invoices_updated_at();

-- ==================== CALENDAR EVENTS ====================
-- Note: Calendar events can use existing calendar system or be stored here

-- Split Sheet Calendar Events (optional - can integrate with existing calendar)
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

-- ==================== TRIGGERS ====================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_split_sheet_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_split_sheet_calendar_events_updated_at
BEFORE UPDATE ON split_sheet_calendar_events
FOR EACH ROW
EXECUTE FUNCTION update_split_sheet_calendar_events_updated_at();

-- ==================== HELPER FUNCTIONS ====================

-- Function to generate access token for contributor
CREATE OR REPLACE FUNCTION generate_contributor_access_token(contributor_uuid UUID, days_valid INTEGER DEFAULT 30)
RETURNS VARCHAR(255) AS $$
DECLARE
  token VARCHAR(255);
BEGIN
  -- Generate a secure random token
  token := encode(gen_random_bytes(32), 'hex');
  
  -- Insert access token
  INSERT INTO split_sheet_contributor_access (contributor_id, access_token, expires_at)
  VALUES (contributor_uuid, token, NOW() + (days_valid || ' days')::INTERVAL)
  ON CONFLICT (access_token) DO UPDATE SET
    expires_at = NOW() + (days_valid || ' days')::INTERVAL,
    last_used_at = NULL;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;























