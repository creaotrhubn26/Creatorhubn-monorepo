-- Create budget_items table for couple budget tracking (including tradition-specific items)
CREATE TABLE IF NOT EXISTS budget_items (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  couple_id VARCHAR(255) NOT NULL REFERENCES couple_profiles(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
  label TEXT NOT NULL,
  estimated_cost INTEGER DEFAULT 0,
  actual_cost INTEGER DEFAULT 0,
  is_paid BOOLEAN DEFAULT FALSE,
  is_tradition_item BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_couple_id ON budget_items(couple_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_category ON budget_items(category);
