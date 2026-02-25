-- ─────────────────────────────────────────────────────────────
-- Migration 101: Role Room Learning Engine
--
-- Makes The Role Room understand users and teams over time.
-- Five tables that capture, aggregate, and surface intelligence:
--
--   1. roleroom_interaction_log        – raw event stream (every meaningful action)
--   2. roleroom_user_insights          – computed understanding of each user
--   3. roleroom_team_dynamics          – relationship intelligence between crew
--   4. roleroom_project_patterns       – recurring production habits
--   5. roleroom_learned_preferences    – specific auto-detected preferences
-- ─────────────────────────────────────────────────────────────

-- 1. Raw interaction log — the learning feed
CREATE TABLE IF NOT EXISTS roleroom_interaction_log (
  id            BIGSERIAL PRIMARY KEY,
  user_id       VARCHAR(255) NOT NULL,
  project_id    VARCHAR(255),
  event_type    VARCHAR(100) NOT NULL,      -- e.g. 'crew.assign', 'schedule.create', 'equipment.checkout', 'scene.edit'
  entity_type   VARCHAR(80),                -- e.g. 'crew', 'equipment', 'scene', 'candidate', 'schedule'
  entity_id     VARCHAR(255),
  context       JSONB DEFAULT '{}',         -- rich payload: { role: 'gaffer', department: 'lighting', scene_type: 'night', ... }
  session_id    VARCHAR(255),               -- group actions within a single session
  duration_ms   INTEGER,                    -- how long the action took (for effort tracking)
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_log_user    ON roleroom_interaction_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_log_project ON roleroom_interaction_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_log_type    ON roleroom_interaction_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interaction_log_entity  ON roleroom_interaction_log (entity_type, entity_id);

-- 2. Aggregated user insights — The Role Room's "understanding" of a person
CREATE TABLE IF NOT EXISTS roleroom_user_insights (
  user_id                VARCHAR(255) PRIMARY KEY,

  -- Creative DNA
  creative_dna           JSONB DEFAULT '{}',
  -- { preferred_genres: ['drama','documentary'], visual_signatures: ['backlit','handheld'],
  --   narrative_tendencies: ['nonlinear'], genre_comfort: { drama: 0.9, commercial: 0.6 } }

  -- Work patterns
  work_patterns          JSONB DEFAULT '{}',
  -- { avg_session_hours: 3.2, peak_hours: [9,10,14,15], preferred_day: 'Tuesday',
  --   sprint_tendency: 0.7, planning_to_execution_ratio: 0.4 }

  -- Decision style
  decision_patterns      JSONB DEFAULT '{}',
  -- { revision_frequency: 'low', delegation_tendency: 0.6,
  --   areas_of_focus: ['lighting','casting'], approval_speed: 'fast' }

  -- Communication signals
  communication_style    JSONB DEFAULT '{}',
  -- { response_time_avg_min: 12, detail_level: 'concise',
  --   preferred_channels: ['in-app'], notification_responsiveness: { equipment: 0.9, schedule: 0.7 } }

  -- Skill & growth tracking
  skill_trajectory       JSONB DEFAULT '{}',
  -- { project_complexity_trend: 'increasing', team_size_trend: 'growing',
  --   new_skills: ['drone_shots','multicam'], growth_rate: 0.15 }

  -- Role Room engagement
  engagement_metrics     JSONB DEFAULT '{}',
  -- { total_projects: 12, total_sessions: 234, avg_project_duration_days: 45,
  --   features_used: { equipment: 89, crew: 67, shotlists: 45 }, last_active: '...' }

  confidence_score       REAL DEFAULT 0,        -- overall confidence in insights (0–1)
  total_events_analyzed  INTEGER DEFAULT 0,
  computed_at            TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- 3. Team dynamics — relationship intelligence
CREATE TABLE IF NOT EXISTS roleroom_team_dynamics (
  id                  SERIAL PRIMARY KEY,
  user_a_id           VARCHAR(255) NOT NULL,    -- the "owner" / project creator
  user_b_id           VARCHAR(255),             -- crew member (can be null if tracking crew by name)
  crew_member_name    VARCHAR(255),             -- fallback when crew don't have user accounts
  crew_role           VARCHAR(100),             -- their typical role: 'gaffer', 'DP', 'sound'
  crew_department     VARCHAR(100),

  -- Collaboration metrics
  collaboration_count INTEGER DEFAULT 0,        -- number of times they've worked together
  project_ids         TEXT[] DEFAULT '{}',       -- which projects
  total_days_together INTEGER DEFAULT 0,
  avg_overlap_hours   REAL,

  -- Chemistry signals
  synergy_score       REAL DEFAULT 0.5,         -- 0–1, computed from project outcomes
  reliability_score   REAL DEFAULT 0.5,         -- 0–1, based on schedule adherence
  rehire_rate         REAL,                     -- how often this person is re-hired
  preferred_pairing   TEXT[],                   -- other crew they're often paired with

  -- Learned context
  notes_summary       TEXT,                     -- AI-summarized notes about this relationship
  strengths           TEXT[],                   -- e.g. ['night_shoots','steadicam','improv_friendly']
  context             JSONB DEFAULT '{}',

  computed_at         TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Unique index using expressions (COALESCE not allowed in UNIQUE constraints directly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_dynamics_unique_pair
  ON roleroom_team_dynamics (user_a_id, COALESCE(user_b_id, ''), COALESCE(crew_member_name, ''));

CREATE INDEX IF NOT EXISTS idx_team_dynamics_user_a ON roleroom_team_dynamics (user_a_id);
CREATE INDEX IF NOT EXISTS idx_team_dynamics_user_b ON roleroom_team_dynamics (user_b_id);
CREATE INDEX IF NOT EXISTS idx_team_dynamics_role   ON roleroom_team_dynamics (crew_role);

-- 4. Project patterns — production habits the system detects
CREATE TABLE IF NOT EXISTS roleroom_project_patterns (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL,
  pattern_type    VARCHAR(100) NOT NULL,
  -- Types: 'crew_preference', 'scheduling_habit', 'budget_pattern',
  --        'equipment_evolution', 'production_rhythm', 'genre_tendency',
  --        'team_composition', 'location_preference', 'workflow_habit'

  pattern_key     VARCHAR(255) NOT NULL,       -- unique identifier within type
  pattern_data    JSONB NOT NULL DEFAULT '{}',  -- the actual pattern data
  -- Examples:
  -- { type: 'crew_preference', key: 'night_gaffer',
  --   data: { name: 'Erik Hansen', role: 'gaffer', context: 'night_shoots',
  --           times_hired: 5, satisfaction: 'high' } }
  -- { type: 'scheduling_habit', key: 'day_length',
  --   data: { planned_avg_hours: 12, actual_avg_hours: 13.5, overrun_rate: 0.8 } }
  -- { type: 'budget_pattern', key: 'equipment_overrun',
  --   data: { avg_overrun_pct: 22, category: 'equipment', projects_analyzed: 6 } }

  description     TEXT,                         -- human-readable summary (Norwegian)
  confidence      REAL DEFAULT 0,               -- 0–1
  evidence_count  INTEGER DEFAULT 0,
  first_seen      TIMESTAMPTZ DEFAULT now(),
  last_seen       TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,

  UNIQUE (user_id, pattern_type, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_project_patterns_user ON roleroom_project_patterns (user_id, pattern_type);

-- 5. Learned preferences — specific auto-detected or confirmed preferences
CREATE TABLE IF NOT EXISTS roleroom_learned_preferences (
  id                 SERIAL PRIMARY KEY,
  user_id            VARCHAR(255) NOT NULL,
  preference_key     VARCHAR(255) NOT NULL,     -- e.g. 'default_call_time', 'preferred_aspect_ratio', 'budget_currency'
  preference_value   TEXT NOT NULL,
  preference_type    VARCHAR(50) DEFAULT 'auto', -- 'auto' (system-detected) or 'confirmed' (user validated)
  category           VARCHAR(100),               -- 'scheduling', 'visual', 'production', 'communication', 'team'
  confidence         REAL DEFAULT 0.5,
  evidence_count     INTEGER DEFAULT 1,
  source_context     JSONB DEFAULT '{}',         -- what actions led to this detection
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),

  UNIQUE (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_learned_prefs_user ON roleroom_learned_preferences (user_id, category);
