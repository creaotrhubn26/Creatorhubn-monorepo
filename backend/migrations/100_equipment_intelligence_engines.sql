-- Migration 100: Equipment Intelligence Engines
-- Predictive Failure, Gear Compatibility, Weight Simulation,
-- Scene Continuity, Equipment Memory, Style Memory

-- ═══════════════════════════════════════════════════════════════
-- 1. Equipment Usage Log — records every shoot usage for memory engines
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS equipment_usage_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar NOT NULL,
  equipment_id    varchar NOT NULL,          -- can be int (user_equipment) or uuid (casting)
  project_id      varchar,
  scene_type      varchar(50),               -- e.g. 'dialogue', 'action', 'interview'
  scene_label     varchar(200),              -- free-text scene name
  category        varchar(100),
  brand           varchar(100),
  model           varchar(200),
  lens_mm         integer,                   -- focal length used (if lens)
  duration_hours  numeric(6,2) DEFAULT 0,
  ambient_temp_c  numeric(5,1),              -- recorded temperature
  notes           text,
  shoot_date      date DEFAULT CURRENT_DATE,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_log_user     ON equipment_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_equip    ON equipment_usage_log(equipment_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_scene    ON equipment_usage_log(user_id, scene_type);

-- ═══════════════════════════════════════════════════════════════
-- 2. Equipment Health Metrics — telemetry for predictive failure
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS equipment_health_metrics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id    varchar NOT NULL,
  user_id         varchar NOT NULL,

  -- Battery
  battery_cycles          integer DEFAULT 0,
  battery_health_pct      numeric(5,1),         -- 0-100

  -- Thermal
  max_recorded_temp_c     numeric(5,1),
  overheating_events      integer DEFAULT 0,

  -- Shutter / usage
  shutter_count           integer DEFAULT 0,
  total_runtime_hours     numeric(8,1) DEFAULT 0,
  total_power_on_cycles   integer DEFAULT 0,

  -- Repair history
  repair_count            integer DEFAULT 0,
  last_repair_date        date,
  last_repair_notes       text,

  -- Condition tracking
  condition_history       jsonb DEFAULT '[]',   -- [{date, condition, notes}]

  updated_at              timestamptz DEFAULT now(),
  UNIQUE(equipment_id)
);
CREATE INDEX IF NOT EXISTS idx_health_user ON equipment_health_metrics(user_id);

-- ═══════════════════════════════════════════════════════════════
-- 3. Gear Compatibility Graph — mount/voltage/battery relations
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gear_compatibility_specs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand           varchar(100) NOT NULL,
  model           varchar(200) NOT NULL,
  category        varchar(100) NOT NULL,

  -- Mount system
  lens_mount      varchar(50),               -- RF, EF, E, L, PL, MFT, Z, X, etc.

  -- Power
  battery_type    varchar(50),               -- NP-F970, V-Mount, LP-E6, etc.
  voltage         numeric(5,1),              -- operating voltage
  wattage         numeric(6,1),              -- max power draw

  -- Physical
  weight_g        numeric(8,1),              -- weight in grams
  max_payload_g   numeric(8,1),              -- max supported payload (for gimbals, drones, etc.)

  -- Connectivity
  inputs          jsonb DEFAULT '[]',        -- ["XLR", "3.5mm", "HDMI", "SDI"]
  outputs         jsonb DEFAULT '[]',        -- ["HDMI", "SDI", "USB-C"]
  media_slots     jsonb DEFAULT '[]',        -- ["CFexpress Type B", "SD UHS-II"]

  -- Mounting
  mounting_standard varchar(50),             -- Bowens, Arri, NATO, etc.
  thread_size     varchar(20),               -- 1/4-20, 3/8-16, etc.

  UNIQUE(brand, model)
);

-- ═══════════════════════════════════════════════════════════════
-- 4. Scene Gear Tracking — exact gear used per scene
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scene_gear_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      varchar NOT NULL,
  user_id         varchar NOT NULL,
  scene_number    integer,
  scene_label     varchar(200),
  scene_type      varchar(50),

  -- Equipment used
  equipment_ids   text[] DEFAULT '{}',       -- array of equipment IDs
  gear_setup      jsonb DEFAULT '{}',        -- {camera: {id, brand, model}, lens: {...}, ...}
  lighting_setup  jsonb,                     -- {key: {...}, fill: {...}, back: {...}}
  audio_setup     jsonb,                     -- {boom: {...}, lavs: [...]}

  notes           text,
  shoot_date      date DEFAULT CURRENT_DATE,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scene_gear_project ON scene_gear_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_gear_user    ON scene_gear_assignments(user_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. User Style Profile — aggregated creative patterns
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_style_profile (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar NOT NULL UNIQUE,

  -- Aggregated patterns (recomputed periodically)
  total_projects          integer DEFAULT 0,
  total_scenes_logged     integer DEFAULT 0,

  -- Top gear preferences per scene type
  -- { "dialogue": { "lens": "50mm", "camera": "Sony FX6", ... }, ... }
  scene_preferences       jsonb DEFAULT '{}',

  -- Overall style signals
  -- { "lighting_style": "naturalistic", "lens_preference": "prime_wide", ... }
  style_signals           jsonb DEFAULT '{}',

  -- Raw pattern data for explanation engine
  -- [{ "pattern": "...", "confidence": 0.85, "evidence_count": 12, "explanation": "..." }]
  discovered_patterns     jsonb DEFAULT '[]',

  computed_at             timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Seed some common gear compatibility specs (production cameras, lenses, gimbals, drones)
INSERT INTO gear_compatibility_specs (brand, model, category, lens_mount, battery_type, voltage, wattage, weight_g, max_payload_g, inputs, outputs, media_slots, mounting_standard) VALUES
  -- Cameras
  ('Sony', 'FX6', 'camera', 'E', 'BP-U35', 14.4, 47, 890, NULL, '["XLR x2", "3.5mm"]', '["HDMI", "SDI"]', '["CFexpress Type A", "SD UHS-II"]', NULL),
  ('Sony', 'FX3', 'camera', 'E', 'NP-FZ100', 7.2, 15, 640, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type A", "SD UHS-II"]', NULL),
  ('Sony', 'A7S III', 'camera', 'E', 'NP-FZ100', 7.2, 15, 614, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type A", "SD UHS-II"]', NULL),
  ('Sony', 'A7 IV', 'camera', 'E', 'NP-FZ100', 7.2, 15, 658, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type A", "SD UHS-II"]', NULL),
  ('Canon', 'EOS R5', 'camera', 'RF', 'LP-E6NH', 7.2, 23, 738, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type B", "SD UHS-II"]', NULL),
  ('Canon', 'EOS R5 C', 'camera', 'RF', 'LP-E6NH', 7.2, 38, 770, NULL, '["XLR x2", "3.5mm"]', '["HDMI", "SDI"]', '["CFexpress Type B", "SD UHS-II"]', NULL),
  ('Canon', 'EOS C70', 'camera', 'RF', 'BP-A30', 14.4, 28, 1190, NULL, '["XLR x2"]', '["HDMI", "SDI"]', '["SD UHS-II x2"]', NULL),
  ('Blackmagic', 'BMPCC 6K G2', 'camera', 'EF', 'NP-F570', 7.4, 30, 900, NULL, '["3.5mm"]', '["HDMI"]', '["CFast 2.0", "SD UHS-II"]', NULL),
  ('Blackmagic', 'URSA Mini Pro 12K', 'camera', 'PL', 'V-Mount', 14.4, 75, 2650, NULL, '["XLR x2"]', '["SDI x2", "HDMI"]', '["CFast 2.0", "SD UHS-II"]', NULL),
  ('RED', 'V-RAPTOR', 'camera', 'RF', 'V-Mount', 14.4, 85, 1830, NULL, '[]', '["SDI", "USB-C"]', '["CFexpress Type B x2"]', NULL),
  ('Panasonic', 'GH6', 'camera', 'MFT', 'DMW-BLK22', 7.2, 20, 739, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type B", "SD UHS-II"]', NULL),
  ('Fujifilm', 'X-H2S', 'camera', 'X', 'NP-W235', 7.2, 18, 660, NULL, '["3.5mm"]', '["HDMI", "USB-C"]', '["CFexpress Type B", "SD UHS-II"]', NULL),
  -- Lenses (Canon RF)
  ('Canon', 'RF 50mm f/1.2L', 'lens', 'RF', NULL, NULL, NULL, 950, NULL, '[]', '[]', '[]', NULL),
  ('Canon', 'RF 85mm f/1.2L', 'lens', 'RF', NULL, NULL, NULL, 1195, NULL, '[]', '[]', '[]', NULL),
  ('Canon', 'RF 24-70mm f/2.8L', 'lens', 'RF', NULL, NULL, NULL, 900, NULL, '[]', '[]', '[]', NULL),
  ('Canon', 'RF 70-200mm f/2.8L', 'lens', 'RF', NULL, NULL, NULL, 1070, NULL, '[]', '[]', '[]', NULL),
  -- Lenses (Sony E)
  ('Sony', 'FE 50mm f/1.2 GM', 'lens', 'E', NULL, NULL, NULL, 778, NULL, '[]', '[]', '[]', NULL),
  ('Sony', 'FE 85mm f/1.4 GM', 'lens', 'E', NULL, NULL, NULL, 820, NULL, '[]', '[]', '[]', NULL),
  ('Sony', 'FE 24-70mm f/2.8 GM II', 'lens', 'E', NULL, NULL, NULL, 695, NULL, '[]', '[]', '[]', NULL),
  ('Sony', 'FE 70-200mm f/2.8 GM II', 'lens', 'E', NULL, NULL, NULL, 1045, NULL, '[]', '[]', '[]', NULL),
  -- Stabilizers / Gimbals
  ('DJI', 'RS 3 Pro', 'stabilizer', NULL, 'BG30 grip', 14.4, NULL, 1500, 4500, '[]', '[]', '[]', 'NATO'),
  ('DJI', 'RS 4 Pro', 'stabilizer', NULL, 'BG30 grip', 14.4, NULL, 1520, 4500, '[]', '[]', '[]', 'NATO'),
  ('Zhiyun', 'Crane 4', 'stabilizer', NULL, 'Built-in', 14.4, NULL, 1138, 3200, '[]', '[]', '[]', NULL),
  ('Tilta', 'Gravity G2X', 'stabilizer', NULL, 'V-Mount', 14.4, NULL, 1600, 3400, '[]', '[]', '[]', 'NATO'),
  -- Drones
  ('DJI', 'Mavic 3 Pro Cine', 'drone', NULL, 'DJI Intelligent', 17.6, NULL, 958, NULL, '[]', '[]', '["1TB SSD"]', NULL),
  ('DJI', 'Inspire 3', 'drone', NULL, 'TB51', 44.4, NULL, 3950, NULL, '[]', '[]', '["DJI PROSSD"]', NULL),
  ('DJI', 'Air 3', 'drone', NULL, 'DJI Intelligent', 11.55, NULL, 720, NULL, '[]', '[]', '[]', NULL),
  -- Lighting
  ('Aputure', '600d Pro', 'lighting', NULL, NULL, NULL, 600, 7200, NULL, '[]', '[]', '[]', 'Bowens'),
  ('Aputure', '300d II', 'lighting', NULL, NULL, NULL, 350, 3100, NULL, '[]', '[]', '[]', 'Bowens'),
  ('Aputure', 'MC Pro', 'lighting', NULL, 'Built-in', NULL, 15, 405, NULL, '[]', '[]', '[]', NULL),
  ('Nanlite', 'Forza 500 II', 'lighting', NULL, NULL, NULL, 500, 5300, NULL, '[]', '[]', '[]', 'Bowens'),
  -- Audio
  ('Sennheiser', 'MKE 600', 'audio', NULL, 'AA x1', 1.5, NULL, 128, NULL, '["XLR"]', '["XLR", "3.5mm"]', '[]', NULL),
  ('Rode', 'Wireless PRO', 'audio', NULL, 'Built-in Li-Ion', 3.7, NULL, 32, NULL, '["USB-C"]', '["3.5mm"]', '[]', NULL),
  ('Sound Devices', 'MixPre-6 II', 'audio', NULL, 'L-Mount x4', 7.2, 15, 555, NULL, '["XLR x4", "3.5mm"]', '["USB-C", "3.5mm"]', '["SD UHS-II"]', NULL),
  ('Zoom', 'F6', 'audio', NULL, 'AA x4', 1.5, NULL, 340, NULL, '["XLR x6"]', '["3.5mm"]', '["SD x2"]', NULL),
  -- Monitors
  ('Atomos', 'Ninja V', 'monitor', NULL, 'NP-F570', 7.4, 15, 360, NULL, '["HDMI"]', '["HDMI"]', '["SSD"]', NULL),
  ('SmallHD', 'Indie 7', 'monitor', NULL, 'L-Series', 7.4, 18, 595, NULL, '["SDI", "HDMI"]', '["SDI", "HDMI"]', '[]', NULL),
  ('Atomos', 'Shogun 7', 'monitor', NULL, 'V-Mount', 14.4, 42, 980, NULL, '["SDI x4", "HDMI"]', '["SDI x4", "HDMI"]', '["SSD"]', NULL)
ON CONFLICT (brand, model) DO NOTHING;
