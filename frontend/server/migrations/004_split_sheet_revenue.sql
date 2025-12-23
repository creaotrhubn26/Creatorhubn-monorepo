-- Split Sheet Revenue Tracking Migration
-- Creates tables for tracking revenue and payments for split sheets

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SPLIT SHEET REVENUE TABLE ====================

-- Split Sheet Revenue Table
CREATE TABLE IF NOT EXISTS split_sheet_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NOK',
  revenue_source VARCHAR(50) NOT NULL CHECK (revenue_source IN ('streaming', 'sales', 'sync', 'performance', 'mechanical', 'publishing', 'other')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  platform VARCHAR(100), -- Spotify, Apple Music, YouTube Music, etc.
  description TEXT,
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

-- ==================== SPLIT SHEET PAYMENTS TABLE ====================

-- Split Sheet Payments Table (calculated distributions)
CREATE TABLE IF NOT EXISTS split_sheet_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES split_sheet_contributors(id) ON DELETE CASCADE,
  revenue_id UUID REFERENCES split_sheet_revenue(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'NOK',
  percentage DECIMAL(5,2) NOT NULL, -- Contributor's percentage at time of payment
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_date DATE,
  payment_method VARCHAR(50), -- bank_transfer, paypal, etc.
  payment_reference VARCHAR(255), -- Transaction ID or reference
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

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_revenue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for split_sheet_revenue
CREATE TRIGGER update_split_sheet_revenue_updated_at BEFORE UPDATE ON split_sheet_revenue
  FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

-- Trigger for split_sheet_payments
CREATE TRIGGER update_split_sheet_payments_updated_at BEFORE UPDATE ON split_sheet_payments
  FOR EACH ROW EXECUTE FUNCTION update_revenue_updated_at();

-- Function to auto-calculate payments when revenue is added
CREATE OR REPLACE FUNCTION calculate_payments_on_revenue()
RETURNS TRIGGER AS $$
DECLARE
  contributor_record RECORD;
  payment_amount DECIMAL(10,2);
BEGIN
  -- Calculate payment for each contributor based on their percentage
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

-- Trigger to auto-calculate payments
CREATE TRIGGER auto_calculate_payments
  AFTER INSERT ON split_sheet_revenue
  FOR EACH ROW EXECUTE FUNCTION calculate_payments_on_revenue();























