-- Casting Planner Database Schema
-- PostgreSQL schema for persistent storage of casting projects

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Casting Projects table
CREATE TABLE IF NOT EXISTS casting_projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    production_plan_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL DEFAULT '{}'::jsonb -- Stores the full project structure
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_casting_projects_updated_at ON casting_projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_casting_projects_name ON casting_projects(name);

-- Optional: Separate tables for better normalization (alternative approach)
-- This would allow for better querying but requires more complex joins

-- Roles table (normalized approach - optional)
CREATE TABLE IF NOT EXISTS casting_roles (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    requirements JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'draft',
    scene_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_roles_project_id ON casting_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_roles_status ON casting_roles(status);

-- Candidates table
CREATE TABLE IF NOT EXISTS casting_candidates (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    contact_info JSONB DEFAULT '{}'::jsonb,
    photos JSONB DEFAULT '[]'::jsonb,
    videos JSONB DEFAULT '[]'::jsonb,
    model_url VARCHAR(1000),
    personality VARCHAR(50),
    audition_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_roles JSONB DEFAULT '[]'::jsonb,
    emergency_contact JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_candidates_project_id ON casting_candidates(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_candidates_status ON casting_candidates(status);
CREATE INDEX IF NOT EXISTS idx_casting_candidates_name ON casting_candidates(name);

-- Schedules table
CREATE TABLE IF NOT EXISTS casting_schedules (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    candidate_id VARCHAR(255) NOT NULL,
    role_id VARCHAR(255) NOT NULL,
    scene_id VARCHAR(255),
    date DATE NOT NULL,
    time TIME NOT NULL,
    location VARCHAR(500) NOT NULL,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_schedules_project_id ON casting_schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_schedules_candidate_id ON casting_schedules(candidate_id);
CREATE INDEX IF NOT EXISTS idx_casting_schedules_date ON casting_schedules(date);
CREATE INDEX IF NOT EXISTS idx_casting_schedules_status ON casting_schedules(status);

-- Crew members table
CREATE TABLE IF NOT EXISTS casting_crew (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    role VARCHAR(100) NOT NULL,
    contact_info JSONB DEFAULT '{}'::jsonb,
    availability JSONB DEFAULT '{}'::jsonb,
    assigned_scenes JSONB DEFAULT '[]'::jsonb,
    rate DECIMAL(10, 2),
    notes TEXT,
    travel_costs JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_crew_project_id ON casting_crew(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_crew_role ON casting_crew(role);

-- Locations table
CREATE TABLE IF NOT EXISTS casting_locations (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    address VARCHAR(1000),
    type VARCHAR(100),
    capacity INTEGER,
    facilities JSONB DEFAULT '[]'::jsonb,
    availability JSONB DEFAULT '{}'::jsonb,
    assigned_scenes JSONB DEFAULT '[]'::jsonb,
    contact_info JSONB DEFAULT '{}'::jsonb,
    coordinates JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_locations_project_id ON casting_locations(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_locations_type ON casting_locations(type);

-- Props table
CREATE TABLE IF NOT EXISTS casting_props (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    availability JSONB DEFAULT '{}'::jsonb,
    assigned_scenes JSONB DEFAULT '[]'::jsonb,
    quantity INTEGER DEFAULT 1,
    location VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_props_project_id ON casting_props(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_props_category ON casting_props(category);

-- Production days table
CREATE TABLE IF NOT EXISTS casting_production_days (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    call_time TIME NOT NULL,
    wrap_time TIME NOT NULL,
    location_id VARCHAR(255),
    scenes JSONB DEFAULT '[]'::jsonb,
    crew JSONB DEFAULT '[]'::jsonb,
    props JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'planned',
    weather_forecast JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_production_days_project_id ON casting_production_days(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_production_days_date ON casting_production_days(date);
CREATE INDEX IF NOT EXISTS idx_casting_production_days_status ON casting_production_days(status);

-- Shot lists table
CREATE TABLE IF NOT EXISTS casting_shot_lists (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    scene_id VARCHAR(255) NOT NULL,
    shots JSONB DEFAULT '[]'::jsonb,
    camera_settings JSONB DEFAULT '{}'::jsonb,
    equipment JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_shot_lists_project_id ON casting_shot_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_lists_scene_id ON casting_shot_lists(scene_id);

-- User roles table (for sharing/permissions)
CREATE TABLE IF NOT EXISTS casting_user_roles (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL, -- 'owner', 'editor', 'viewer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_casting_user_roles_project_id ON casting_user_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_user_roles_user_id ON casting_user_roles(user_id);

-- Consent table (for candidate consents)
CREATE TABLE IF NOT EXISTS casting_consents (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    candidate_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'photo', 'video', 'personal_data', etc.
    granted BOOLEAN DEFAULT false,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_consents_project_id ON casting_consents(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_consents_candidate_id ON casting_consents(candidate_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_casting_projects_updated_at BEFORE UPDATE ON casting_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_roles_updated_at BEFORE UPDATE ON casting_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_candidates_updated_at BEFORE UPDATE ON casting_candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_schedules_updated_at BEFORE UPDATE ON casting_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_crew_updated_at BEFORE UPDATE ON casting_crew
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_locations_updated_at BEFORE UPDATE ON casting_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_props_updated_at BEFORE UPDATE ON casting_props
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_production_days_updated_at BEFORE UPDATE ON casting_production_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_shot_lists_updated_at BEFORE UPDATE ON casting_shot_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_user_roles_updated_at BEFORE UPDATE ON casting_user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_consents_updated_at BEFORE UPDATE ON casting_consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MANUSCRIPT AND SCRIPT SYSTEM TABLES
-- ============================================================================

-- Manuscripts table - Main script/screenplay documents
CREATE TABLE IF NOT EXISTS casting_manuscripts (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    subtitle VARCHAR(500),
    author VARCHAR(255),
    version VARCHAR(50) DEFAULT '1.0',
    format VARCHAR(50) DEFAULT 'fountain', -- fountain, final-draft, markdown
    content TEXT NOT NULL, -- Full manuscript content
    page_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    estimated_runtime INTEGER, -- in minutes
    status VARCHAR(50) DEFAULT 'draft', -- draft, review, approved, shooting, completed
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata like copyright, WGA registration, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_manuscripts_project_id ON casting_manuscripts(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_manuscripts_status ON casting_manuscripts(status);

-- Script Revisions - Version control for manuscripts
CREATE TABLE IF NOT EXISTS casting_script_revisions (
    id VARCHAR(255) PRIMARY KEY,
    manuscript_id VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    changes_summary TEXT,
    changed_by VARCHAR(255),
    color_code VARCHAR(50), -- Industry standard: white, blue, pink, yellow, green, goldenrod, buff, salmon, cherry
    revision_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_script_revisions_manuscript_id ON casting_script_revisions(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_casting_script_revisions_version ON casting_script_revisions(version);

-- Acts/Chapters - Organize scenes into acts (3-act structure, chapters, etc.)
CREATE TABLE IF NOT EXISTS casting_acts (
    id VARCHAR(255) PRIMARY KEY,
    manuscript_id VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    act_number INTEGER NOT NULL,
    title VARCHAR(500),
    description TEXT,
    page_start INTEGER,
    page_end INTEGER,
    estimated_runtime INTEGER, -- in minutes
    color_code VARCHAR(50), -- For visual organization
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_acts_manuscript_id ON casting_acts(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_casting_acts_project_id ON casting_acts(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_acts_act_number ON casting_acts(act_number);

-- Scene Breakdown - Detailed scene information
CREATE TABLE IF NOT EXISTS casting_scenes (
    id VARCHAR(255) PRIMARY KEY,
    manuscript_id VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    act_id VARCHAR(255) REFERENCES casting_acts(id) ON DELETE SET NULL, -- Link to act/chapter
    scene_number VARCHAR(50) NOT NULL, -- e.g., "1", "1A", "1B"
    scene_heading VARCHAR(500) NOT NULL, -- e.g., "INT. APARTMENT - DAY"
    int_ext VARCHAR(10), -- INT, EXT, INT/EXT
    location_name VARCHAR(500),
    time_of_day VARCHAR(50), -- DAY, NIGHT, DAWN, DUSK, CONTINUOUS, LATER
    page_length DECIMAL(4,2), -- e.g., 2.5 pages (in eighths: 2 4/8)
    estimated_screen_time INTEGER, -- in seconds
    description TEXT, -- Action/description lines
    dramatic_day VARCHAR(50), -- Story timeline day
    sequence VARCHAR(100), -- Sequence/act grouping
    
    -- Production breakdown
    characters JSONB DEFAULT '[]'::jsonb, -- Array of role IDs
    extras_count INTEGER DEFAULT 0,
    props_needed JSONB DEFAULT '[]'::jsonb, -- Array of prop IDs or names
    wardrobe_notes TEXT,
    makeup_notes TEXT,
    special_effects TEXT,
    stunts_notes TEXT,
    vehicles JSONB DEFAULT '[]'::jsonb,
    animals JSONB DEFAULT '[]'::jsonb,
    sound_notes TEXT,
    music_notes TEXT,
    
    -- Scheduling
    location_id VARCHAR(255), -- Reference to casting_locations
    shooting_date DATE,
    call_time TIME,
    estimated_duration INTEGER, -- shooting time in minutes
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'not-scheduled', -- not-scheduled, scheduled, shot, in-post, completed
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_scenes_manuscript_id ON casting_scenes(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_casting_scenes_project_id ON casting_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_scenes_scene_number ON casting_scenes(scene_number);
CREATE INDEX IF NOT EXISTS idx_casting_scenes_location_id ON casting_scenes(location_id);
CREATE INDEX IF NOT EXISTS idx_casting_scenes_shooting_date ON casting_scenes(shooting_date);
CREATE INDEX IF NOT EXISTS idx_casting_scenes_status ON casting_scenes(status);

-- Dialogue - Character dialogue lines
CREATE TABLE IF NOT EXISTS casting_dialogue (
    id VARCHAR(255) PRIMARY KEY,
    scene_id VARCHAR(255) NOT NULL REFERENCES casting_scenes(id) ON DELETE CASCADE,
    manuscript_id VARCHAR(255) NOT NULL REFERENCES casting_manuscripts(id) ON DELETE CASCADE,
    character_name VARCHAR(255) NOT NULL,
    role_id VARCHAR(255), -- Reference to casting_roles if linked
    dialogue_text TEXT NOT NULL,
    parenthetical TEXT, -- e.g., "(whispering)", "(to John)"
    line_number INTEGER,
    dialogue_type VARCHAR(50) DEFAULT 'dialogue', -- dialogue, voice-over, off-screen
    emotion_tag VARCHAR(100), -- For actor direction
    language VARCHAR(50) DEFAULT 'no', -- Norwegian, English, etc.
    translation TEXT, -- If multilingual
    audio_note TEXT, -- ADR notes, emphasis, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_dialogue_scene_id ON casting_dialogue(scene_id);
CREATE INDEX IF NOT EXISTS idx_casting_dialogue_manuscript_id ON casting_dialogue(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_casting_dialogue_role_id ON casting_dialogue(role_id);
CREATE INDEX IF NOT EXISTS idx_casting_dialogue_character_name ON casting_dialogue(character_name);

-- Triggers for updated_at
CREATE TRIGGER update_casting_manuscripts_updated_at BEFORE UPDATE ON casting_manuscripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_scenes_updated_at BEFORE UPDATE ON casting_scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_dialogue_updated_at BEFORE UPDATE ON casting_dialogue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_acts_updated_at BEFORE UPDATE ON casting_acts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Shot Details Enhancement - Link shots to scenes with production details
-- Note: casting_shot_lists already exists, we'll enhance it with scene linking
-- Add columns to existing shot structure for Kamera, Lys, Lyd, Notater

-- Shot Camera Settings
CREATE TABLE IF NOT EXISTS casting_shot_camera (
    id VARCHAR(255) PRIMARY KEY,
    shot_id VARCHAR(255) NOT NULL, -- Reference to shot in casting_shot_lists
    scene_id VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE CASCADE,
    camera_type VARCHAR(100), -- e.g., "Sony A7S III", "RED Komodo"
    lens VARCHAR(100), -- e.g., "24-70mm f/2.8", "50mm f/1.4"
    focal_length INTEGER, -- in mm
    aperture VARCHAR(20), -- e.g., "f/2.8", "f/5.6"
    iso INTEGER,
    shutter_speed VARCHAR(20), -- e.g., "1/50", "1/125"
    frame_rate INTEGER, -- fps
    resolution VARCHAR(50), -- e.g., "4K", "1080p", "6K"
    aspect_ratio VARCHAR(20), -- e.g., "16:9", "2.39:1"
    camera_movement VARCHAR(100), -- e.g., "dolly", "crane", "handheld", "static"
    gimbal_settings JSONB DEFAULT '{}'::jsonb,
    focus_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_shot_camera_shot_id ON casting_shot_camera(shot_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_camera_scene_id ON casting_shot_camera(scene_id);

-- Shot Lighting Setup
CREATE TABLE IF NOT EXISTS casting_shot_lighting (
    id VARCHAR(255) PRIMARY KEY,
    shot_id VARCHAR(255) NOT NULL,
    scene_id VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE CASCADE,
    lighting_setup_name VARCHAR(255), -- e.g., "3-Point Lighting", "Natural Window Light"
    key_light JSONB DEFAULT '{}'::jsonb, -- {type, power, position, color_temp, diffusion}
    fill_light JSONB DEFAULT '{}'::jsonb,
    back_light JSONB DEFAULT '{}'::jsonb,
    practical_lights JSONB DEFAULT '[]'::jsonb, -- Array of practical lights in scene
    light_diagram_url VARCHAR(1000), -- URL to lighting diagram image
    color_temperature INTEGER, -- Kelvin
    lighting_style VARCHAR(100), -- e.g., "high-key", "low-key", "natural"
    special_effects JSONB DEFAULT '[]'::jsonb, -- Fog, haze, etc.
    power_requirements TEXT,
    setup_time INTEGER, -- minutes
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_shot_lighting_shot_id ON casting_shot_lighting(shot_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_lighting_scene_id ON casting_shot_lighting(scene_id);

-- Shot Audio Setup
CREATE TABLE IF NOT EXISTS casting_shot_audio (
    id VARCHAR(255) PRIMARY KEY,
    shot_id VARCHAR(255) NOT NULL,
    scene_id VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE CASCADE,
    audio_type VARCHAR(50), -- "dialogue", "voiceover", "sound-effects", "music"
    microphone_setup JSONB DEFAULT '[]'::jsonb, -- Array of mics: {type, position, talent}
    boom_operator_needed BOOLEAN DEFAULT false,
    wireless_mics_count INTEGER DEFAULT 0,
    sound_blankets_needed BOOLEAN DEFAULT false,
    ambient_sound_notes TEXT,
    dialogue_notes TEXT,
    music_cue TEXT,
    sound_effects_needed JSONB DEFAULT '[]'::jsonb,
    adr_required BOOLEAN DEFAULT false,
    audio_format VARCHAR(50), -- e.g., "48kHz 24-bit"
    channels INTEGER DEFAULT 2, -- mono, stereo, 5.1, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_shot_audio_shot_id ON casting_shot_audio(shot_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_audio_scene_id ON casting_shot_audio(scene_id);

-- Shot Production Notes
CREATE TABLE IF NOT EXISTS casting_shot_notes (
    id VARCHAR(255) PRIMARY KEY,
    shot_id VARCHAR(255) NOT NULL,
    scene_id VARCHAR(255) REFERENCES casting_scenes(id) ON DELETE CASCADE,
    note_type VARCHAR(50) DEFAULT 'general', -- general, director, cinematographer, script, continuity
    content TEXT NOT NULL,
    author VARCHAR(255),
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, critical
    tags JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb, -- URLs to images, PDFs, etc.
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_casting_shot_notes_shot_id ON casting_shot_notes(shot_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_notes_scene_id ON casting_shot_notes(scene_id);
CREATE INDEX IF NOT EXISTS idx_casting_shot_notes_note_type ON casting_shot_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_casting_shot_notes_priority ON casting_shot_notes(priority);

-- Triggers for new tables
CREATE TRIGGER update_casting_shot_camera_updated_at BEFORE UPDATE ON casting_shot_camera
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_shot_lighting_updated_at BEFORE UPDATE ON casting_shot_lighting
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_shot_audio_updated_at BEFORE UPDATE ON casting_shot_audio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_shot_notes_updated_at BEFORE UPDATE ON casting_shot_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();










