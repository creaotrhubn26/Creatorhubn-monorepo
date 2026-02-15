-- Production Workflow Database Schema
-- PostgreSQL schema for persistent storage of production workflow data
-- Supports Shooting Days, Stripboard, Call Sheets, and Live Set tracking

-- ============================================
-- SHOOTING DAYS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS production_shooting_days (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    call_time TIME NOT NULL,
    wrap_time TIME,
    location VARCHAR(500) NOT NULL,
    location_address VARCHAR(500),
    notes TEXT,
    scenes JSONB DEFAULT '[]'::jsonb,  -- Array of scene IDs
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'wrapped', 'postponed', 'cancelled')),
    weather JSONB DEFAULT '{}'::jsonb,  -- WeatherInfo object
    crew_call_times JSONB DEFAULT '{}'::jsonb,  -- roleId -> call time
    cast_call_times JSONB DEFAULT '{}'::jsonb,  -- characterId -> call time
    equipment_needed JSONB DEFAULT '[]'::jsonb,
    meals JSONB DEFAULT '[]'::jsonb,  -- Array of MealBreak objects
    actual_start_time TIME,
    actual_wrap_time TIME,
    daily_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shooting_days_project_id ON production_shooting_days(project_id);
CREATE INDEX IF NOT EXISTS idx_shooting_days_date ON production_shooting_days(date);
CREATE INDEX IF NOT EXISTS idx_shooting_days_status ON production_shooting_days(status);

-- ============================================
-- STRIPBOARD TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS production_stripboard (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    scene_id VARCHAR(255) NOT NULL,
    scene_number VARCHAR(50) NOT NULL,
    shooting_day_id VARCHAR(255) REFERENCES production_shooting_days(id) ON DELETE SET NULL,
    day_number INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(20) DEFAULT '#4A5568',  -- hex color based on INT/EXT/Day/Night
    location VARCHAR(500),
    pages DECIMAL(5, 2) DEFAULT 0,
    cast_ids JSONB DEFAULT '[]'::jsonb,  -- Array of character IDs
    status VARCHAR(50) DEFAULT 'not-scheduled' CHECK (status IN ('not-scheduled', 'scheduled', 'shot', 'postponed')),
    estimated_time INTEGER DEFAULT 60,  -- minutes
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripboard_project_id ON production_stripboard(project_id);
CREATE INDEX IF NOT EXISTS idx_stripboard_scene_id ON production_stripboard(scene_id);
CREATE INDEX IF NOT EXISTS idx_stripboard_shooting_day_id ON production_stripboard(shooting_day_id);
CREATE INDEX IF NOT EXISTS idx_stripboard_sort_order ON production_stripboard(sort_order);

-- ============================================
-- CALL SHEETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS production_call_sheets (
    id VARCHAR(255) PRIMARY KEY,
    shooting_day_id VARCHAR(255) NOT NULL REFERENCES production_shooting_days(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL,
    project_title VARCHAR(500) NOT NULL,
    production_company VARCHAR(500),
    director VARCHAR(255),
    producer VARCHAR(255),
    date DATE NOT NULL,
    day_number INTEGER NOT NULL,
    total_days INTEGER,
    general_call_time TIME NOT NULL,
    crew_call_times JSONB DEFAULT '[]'::jsonb,  -- Array of CrewCallItem
    cast_call_times JSONB DEFAULT '[]'::jsonb,  -- Array of CastCallItem
    scenes JSONB DEFAULT '[]'::jsonb,  -- Array of CallSheetScene
    location_address VARCHAR(500),
    parking_info TEXT,
    catering_info TEXT,
    meals JSONB DEFAULT '[]'::jsonb,
    weather_forecast JSONB,
    special_instructions TEXT,
    emergency_contacts JSONB DEFAULT '[]'::jsonb,
    department_notes JSONB DEFAULT '{}'::jsonb,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'revised')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_sheets_project_id ON production_call_sheets(project_id);
CREATE INDEX IF NOT EXISTS idx_call_sheets_shooting_day_id ON production_call_sheets(shooting_day_id);
CREATE INDEX IF NOT EXISTS idx_call_sheets_date ON production_call_sheets(date);

-- ============================================
-- CAST MEMBERS TABLE (Production specific)
-- ============================================
CREATE TABLE IF NOT EXISTS production_cast (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    character_name VARCHAR(500) NOT NULL,
    scenes JSONB DEFAULT '[]'::jsonb,  -- Array of scene IDs
    phone VARCHAR(50),
    email VARCHAR(255),
    availability JSONB DEFAULT '{}'::jsonb,  -- date -> boolean
    contract JSONB DEFAULT '{}'::jsonb,  -- ContractInfo object
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_cast_project_id ON production_cast(project_id);

-- ============================================
-- CREW MEMBERS TABLE (Production specific)
-- ============================================
CREATE TABLE IF NOT EXISTS production_crew (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    role VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    availability JSONB DEFAULT '{}'::jsonb,  -- date -> boolean
    rate DECIMAL(10, 2),
    rate_type VARCHAR(50) DEFAULT 'daily' CHECK (rate_type IN ('hourly', 'daily', 'weekly', 'flat')),
    union_affiliation VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_production_crew_project_id ON production_crew(project_id);
CREATE INDEX IF NOT EXISTS idx_production_crew_department ON production_crew(department);

-- ============================================
-- LIVE SET STATUS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS production_live_set_status (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    shooting_day_id VARCHAR(255) REFERENCES production_shooting_days(id) ON DELETE SET NULL,
    current_scene_id VARCHAR(255),
    current_shot_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'standby' CHECK (status IN ('standby', 'rehearsal', 'rolling', 'cut', 'checking', 'moving', 'meal', 'wrapped')),
    current_setup INTEGER DEFAULT 0,
    total_setups INTEGER DEFAULT 0,
    pages_shot DECIMAL(5, 2) DEFAULT 0,
    scenes_completed JSONB DEFAULT '[]'::jsonb,
    scenes_partial JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMP WITH TIME ZONE,
    last_update_time TIMESTAMP WITH TIME ZONE,
    estimated_wrap TIME,
    today_takes JSONB DEFAULT '[]'::jsonb,  -- Array of Take objects
    notes TEXT,
    last_updated_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_live_set_project_id ON production_live_set_status(project_id);
CREATE INDEX IF NOT EXISTS idx_live_set_shooting_day_id ON production_live_set_status(shooting_day_id);

-- ============================================
-- TAKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS production_takes (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL,
    shooting_day_id VARCHAR(255) REFERENCES production_shooting_days(id) ON DELETE CASCADE,
    scene_id VARCHAR(255) NOT NULL,
    shot_id VARCHAR(255),
    take_number INTEGER NOT NULL,
    timecode_in VARCHAR(20),
    timecode_out VARCHAR(20),
    duration INTEGER,  -- seconds
    rating VARCHAR(20) CHECK (rating IN ('circle', 'good', 'ok', 'ng', 'technical')),
    notes TEXT,
    camera_roll VARCHAR(50),
    sound_roll VARCHAR(50),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_takes_project_id ON production_takes(project_id);
CREATE INDEX IF NOT EXISTS idx_takes_shooting_day_id ON production_takes(shooting_day_id);
CREATE INDEX IF NOT EXISTS idx_takes_scene_id ON production_takes(scene_id);

-- ============================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_production_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all production tables
DROP TRIGGER IF EXISTS update_shooting_days_updated_at ON production_shooting_days;
CREATE TRIGGER update_shooting_days_updated_at
    BEFORE UPDATE ON production_shooting_days
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

DROP TRIGGER IF EXISTS update_stripboard_updated_at ON production_stripboard;
CREATE TRIGGER update_stripboard_updated_at
    BEFORE UPDATE ON production_stripboard
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

DROP TRIGGER IF EXISTS update_call_sheets_updated_at ON production_call_sheets;
CREATE TRIGGER update_call_sheets_updated_at
    BEFORE UPDATE ON production_call_sheets
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

DROP TRIGGER IF EXISTS update_production_cast_updated_at ON production_cast;
CREATE TRIGGER update_production_cast_updated_at
    BEFORE UPDATE ON production_cast
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

DROP TRIGGER IF EXISTS update_production_crew_updated_at ON production_crew;
CREATE TRIGGER update_production_crew_updated_at
    BEFORE UPDATE ON production_crew
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

DROP TRIGGER IF EXISTS update_live_set_status_updated_at ON production_live_set_status;
CREATE TRIGGER update_live_set_status_updated_at
    BEFORE UPDATE ON production_live_set_status
    FOR EACH ROW EXECUTE FUNCTION update_production_updated_at();

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE production_shooting_days IS 'Stores shooting day schedules for film/video production';
COMMENT ON TABLE production_stripboard IS 'Stripboard strips mapping scenes to shooting days';
COMMENT ON TABLE production_call_sheets IS 'Generated call sheets for each shooting day';
COMMENT ON TABLE production_cast IS 'Cast members with availability and contract info';
COMMENT ON TABLE production_crew IS 'Crew members with department and rate info';
COMMENT ON TABLE production_live_set_status IS 'Real-time status tracking during production';
COMMENT ON TABLE production_takes IS 'Individual takes recorded during shooting';
