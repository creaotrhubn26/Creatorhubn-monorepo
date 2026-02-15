-- ============================================================================
-- Crew Calendar Events Migration
-- Adds table for crew scheduling calendar events
-- ============================================================================

-- Crew Calendar Events table
CREATE TABLE IF NOT EXISTS crew_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Event details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    
    -- Categorization
    department VARCHAR(50) NOT NULL CHECK (department IN (
        'regi', 'produksjon', 'kamera', 'lys', 'grip', 
        'lyd', 'art', 'hmu', 'kostyme', 'personal'
    )),
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'shooting', 'rehearsal', 'fitting', 'meeting', 
        'call', 'wrap', 'travel', 'personal'
    )),
    
    -- Related entities
    crew_ids UUID[] DEFAULT '{}',
    location_id UUID REFERENCES locations(id),
    location_name VARCHAR(255),
    
    -- Display
    color VARCHAR(20),
    
    -- Reminders
    reminders JSONB DEFAULT '[]',
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    parent_event_id UUID REFERENCES crew_calendar_events(id),
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS idx_crew_calendar_events_date 
ON crew_calendar_events(event_date);

-- Index for project-based filtering
CREATE INDEX IF NOT EXISTS idx_crew_calendar_events_project 
ON crew_calendar_events(project_id);

-- Index for department filtering
CREATE INDEX IF NOT EXISTS idx_crew_calendar_events_department 
ON crew_calendar_events(department);

-- Index for crew member lookup (GIN for array)
CREATE INDEX IF NOT EXISTS idx_crew_calendar_events_crew 
ON crew_calendar_events USING GIN(crew_ids);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_crew_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_crew_calendar_events_updated_at ON crew_calendar_events;
CREATE TRIGGER trigger_crew_calendar_events_updated_at
    BEFORE UPDATE ON crew_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_crew_calendar_events_updated_at();

-- ============================================================================
-- Crew Availability Enhancement
-- Add recurring availability patterns
-- ============================================================================

-- Add columns to existing crew_availability if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crew_availability' AND column_name = 'days_of_week'
    ) THEN
        ALTER TABLE crew_availability ADD COLUMN days_of_week INTEGER[] DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crew_availability' AND column_name = 'time_slots'
    ) THEN
        ALTER TABLE crew_availability ADD COLUMN time_slots JSONB DEFAULT '[]';
    END IF;
END $$;

-- ============================================================================
-- Sample Data (for development)
-- ============================================================================

-- Insert sample events (commented out for production)
/*
INSERT INTO crew_calendar_events (title, description, event_date, start_time, end_time, department, event_type, crew_ids)
VALUES 
    ('Emails design', 'Design review for email templates', CURRENT_DATE + INTERVAL '1 day', '09:00', '11:20', 'art', 'meeting', '{}'),
    ('Youtube video', 'Behind the scenes shooting', CURRENT_DATE + INTERVAL '1 day', '08:20', '09:40', 'kamera', 'shooting', '{}'),
    ('Brain storm', 'Creative session', CURRENT_DATE + INTERVAL '2 days', '11:10', '12:50', 'regi', 'meeting', '{}'),
    ('Team meeting', 'Weekly standup', CURRENT_DATE + INTERVAL '3 days', '11:00', '12:20', 'regi', 'meeting', '{}');
*/

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Crew Calendar Events migration completed successfully';
END $$;
