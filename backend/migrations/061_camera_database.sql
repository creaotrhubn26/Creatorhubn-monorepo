-- Camera Database Migration
-- Creates tables for camera database and user camera selections

-- ==================== CAMERA DATABASE ====================

CREATE TABLE IF NOT EXISTS cameras (
  id VARCHAR PRIMARY KEY,
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  image_url TEXT,
  release_year VARCHAR(4),
  
  -- Memory card compatibility
  supported_memory_card_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_card_slot VARCHAR(20),
  secondary_card_slot VARCHAR(20),
  
  -- Technical specifications
  specs JSONB,
  
  -- Professional categorization
  category VARCHAR(50),
  is_discontinued BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== USER CAMERAS ====================

CREATE TABLE IF NOT EXISTS user_cameras (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  camera_id VARCHAR REFERENCES cameras(id),
  is_primary BOOLEAN DEFAULT false,
  nickname VARCHAR(100),
  serial_number VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== MEMORY CARD TYPES ====================

CREATE TABLE IF NOT EXISTS memory_card_types (
  id VARCHAR PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  full_name VARCHAR(100),
  description TEXT,
  max_capacity VARCHAR(20),
  speed_class VARCHAR(50),
  icon_name VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_cameras_brand ON cameras(brand);
CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras(category);
CREATE INDEX IF NOT EXISTS idx_cameras_release_year ON cameras(release_year);
CREATE INDEX IF NOT EXISTS idx_user_cameras_user_id ON user_cameras(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cameras_camera_id ON user_cameras(camera_id);
CREATE INDEX IF NOT EXISTS idx_user_cameras_is_primary ON user_cameras(is_primary);

-- ==================== SAMPLE DATA ====================

-- Insert sample cameras (Sony)
INSERT INTO cameras (id, brand, model, full_name, image_url, release_year, category, specs, supported_memory_card_types) VALUES
('sony-a7iv', 'Sony', 'A7 IV', 'Sony Alpha 7 IV', NULL, '2021', 'Mirrorless', '{"resolution": "33MP", "videoCapabilities": ["4K 60p", "10-bit 4:2:2"], "iso": "100-51200", "autofocus": "759-point AF"}', '["SD UHS-II", "CFexpress Type A"]'),
('sony-a7siii', 'Sony', 'A7S III', 'Sony Alpha 7S III', NULL, '2020', 'Mirrorless', '{"resolution": "12MP", "videoCapabilities": ["4K 120p", "10-bit 4:2:2"], "iso": "80-102400", "autofocus": "759-point AF"}', '["SD UHS-II", "CFexpress Type A"]'),
('sony-fx3', 'Sony', 'FX3', 'Sony FX3 Cinema Line', NULL, '2021', 'Cinema', '{"resolution": "12MP", "videoCapabilities": ["4K 120p", "10-bit 4:2:2"], "iso": "80-102400", "autofocus": "627-point AF"}', '["SD UHS-II", "CFexpress Type A"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample cameras (Canon)
INSERT INTO cameras (id, brand, model, full_name, image_url, release_year, category, specs, supported_memory_card_types) VALUES
('canon-r5', 'Canon', 'EOS R5', 'Canon EOS R5', NULL, '2020', 'Mirrorless', '{"resolution": "45MP", "videoCapabilities": ["8K 30p", "4K 120p"], "iso": "100-51200", "autofocus": "1053-point AF"}', '["SD UHS-II", "CFexpress Type B"]'),
('canon-r6ii', 'Canon', 'EOS R6 Mark II', 'Canon EOS R6 Mark II', NULL, '2022', 'Mirrorless', '{"resolution": "24MP", "videoCapabilities": ["4K 60p", "6K oversampled"], "iso": "100-102400", "autofocus": "1053-point AF"}', '["SD UHS-II"]'),
('canon-c70', 'Canon', 'EOS C70', 'Canon EOS C70 Cinema', NULL, '2020', 'Cinema', '{"resolution": "4K Super 35mm", "videoCapabilities": ["4K 120p", "10-bit 4:2:2"], "iso": "160-25600", "autofocus": "Dual Pixel AF"}', '["CFexpress Type B", "SD UHS-II"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample cameras (Panasonic)
INSERT INTO cameras (id, brand, model, full_name, image_url, release_year, category, specs, supported_memory_card_types) VALUES
('panasonic-s5ii', 'Panasonic', 'LUMIX S5 II', 'Panasonic LUMIX S5 II', NULL, '2023', 'Mirrorless', '{"resolution": "24MP", "videoCapabilities": ["6K 30p", "4K 60p"], "iso": "100-51200", "autofocus": "Phase Detection AF"}', '["SD UHS-II"]'),
('panasonic-gh6', 'Panasonic', 'LUMIX GH6', 'Panasonic LUMIX GH6', NULL, '2022', 'Mirrorless', '{"resolution": "25MP", "videoCapabilities": ["5.7K 60p", "4K 120p"], "iso": "100-25600", "autofocus": "DFD AF"}', '["SD UHS-II", "CFexpress Type B"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample cameras (Blackmagic)
INSERT INTO cameras (id, brand, model, full_name, image_url, release_year, category, specs, supported_memory_card_types) VALUES
('blackmagic-pocket-6k-pro', 'Blackmagic Design', 'Pocket Cinema Camera 6K Pro', 'Blackmagic Pocket Cinema Camera 6K Pro', NULL, '2021', 'Cinema', '{"resolution": "6K Super 35mm", "videoCapabilities": ["6K 50p", "4K 120p"], "iso": "400-25600", "autofocus": "Manual Focus"}', '["CFast 2.0", "SD UHS-II"]'),
('blackmagic-ursa-12k', 'Blackmagic Design', 'URSA Mini Pro 12K', 'Blackmagic URSA Mini Pro 12K', NULL, '2020', 'Cinema', '{"resolution": "12K Super 35mm", "videoCapabilities": ["12K 60p", "8K 120p"], "iso": "400-25600", "autofocus": "Manual Focus"}', '["CFast 2.0"]')
ON CONFLICT (id) DO NOTHING;

-- Insert sample cameras (RED)
INSERT INTO cameras (id, brand, model, full_name, image_url, release_year, category, specs, supported_memory_card_types) VALUES
('red-komodo-6k', 'RED Digital Cinema', 'KOMODO 6K', 'RED KOMODO 6K', NULL, '2020', 'Cinema', '{"resolution": "6K Super 35mm", "videoCapabilities": ["6K 40p", "4K 60p"], "iso": "800-102400", "autofocus": "Manual Focus"}', '["CFast 2.0"]'),
('red-v-raptor-8k', 'RED Digital Cinema', 'V-RAPTOR 8K VV', 'RED V-RAPTOR 8K VV', NULL, '2021', 'Cinema', '{"resolution": "8K Full Frame", "videoCapabilities": ["8K 120p"], "iso": "800-102400", "autofocus": "Manual Focus"}', '["CFexpress Type B"]')
ON CONFLICT (id) DO NOTHING;

-- Insert memory card types
INSERT INTO memory_card_types (id, name, full_name, description, max_capacity, speed_class, icon_name) VALUES
('sd-uhs-ii', 'SD UHS-II', 'SD UHS-II Card', 'High-speed SD card with UHS-II interface', '512GB', 'V90', 'sd_card'),
('cfexpress-type-a', 'CFexpress Type A', 'CFexpress Type A Card', 'Compact CFexpress card for Sony cameras', '160GB', '800MB/s', 'memory'),
('cfexpress-type-b', 'CFexpress Type B', 'CFexpress Type B Card', 'High-performance CFexpress card', '2TB', '1700MB/s', 'memory'),
('cfast-2', 'CFast 2.0', 'CFast 2.0 Card', 'Professional CFast card for cinema cameras', '512GB', '530MB/s', 'memory'),
('xqd', 'XQD', 'XQD Card', 'Professional XQD card for Nikon cameras', '440GB', '440MB/s', 'memory')
ON CONFLICT (id) DO NOTHING;

-- ==================== COMMENTS ====================

COMMENT ON TABLE cameras IS 'Camera database with detailed specs and memory card compatibility';
COMMENT ON TABLE user_cameras IS 'User''s selected cameras for onboarding and preferences';
COMMENT ON TABLE memory_card_types IS 'Memory card types and specifications';

