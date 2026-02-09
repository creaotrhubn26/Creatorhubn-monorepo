-- Create checklist_tasks table for couple checklist items (including tradition-specific tasks)
CREATE TABLE IF NOT EXISTS checklist_tasks (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  couple_id VARCHAR(255) NOT NULL REFERENCES couple_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  months_before INTEGER DEFAULT 0,
  category VARCHAR(50) DEFAULT 'planning',
  is_default BOOLEAN DEFAULT FALSE,
  is_tradition_item BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_tasks_couple_id ON checklist_tasks(couple_id);
CREATE INDEX IF NOT EXISTS idx_checklist_tasks_category ON checklist_tasks(category);
