-- Split Sheet Templates Migration
-- Creates tables for split sheet templates

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== SPLIT SHEET TEMPLATES TABLE ====================

-- Split Sheet Templates Table
CREATE TABLE IF NOT EXISTS split_sheet_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255), -- NULL for system templates, user_id for custom templates
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_system_template BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE, -- Allow sharing with other users
  contributors JSONB NOT NULL, -- Array of contributor definitions
  metadata JSONB DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_templates_user_id ON split_sheet_templates(user_id);
CREATE INDEX idx_split_sheet_templates_system ON split_sheet_templates(is_system_template);
CREATE INDEX idx_split_sheet_templates_public ON split_sheet_templates(is_public);
CREATE INDEX idx_split_sheet_templates_usage ON split_sheet_templates(usage_count DESC);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for split_sheet_templates
CREATE TRIGGER update_split_sheet_templates_updated_at BEFORE UPDATE ON split_sheet_templates
  FOR EACH ROW EXECUTE FUNCTION update_template_updated_at();

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























