-- Migration 099: Equipment System Improvements
-- 1. Clean junk "Default-*" rows from equipment_library
-- 2. Add missing equipment categories (stabilizer, monitor, media, power, wireless_video)
-- 3. Add equipment_library search index
-- 4. Clean junk "Default" rows from equipment table

-- ============================================================
-- STEP 1: Clean junk rows
-- ============================================================

-- Remove Default-xxx garbage categories from equipment_library
DELETE FROM equipment_library WHERE category LIKE 'Default-%';

-- Remove Default placeholder rows from equipment table
DELETE FROM equipment WHERE name = 'Default' OR brand = 'Default' OR model = 'Default';

-- Remove Default/null junk from market_equipment 
DELETE FROM market_equipment WHERE name = 'Default' OR brand IS NULL;

-- ============================================================
-- STEP 2: Expand equipment_library with missing categories
-- ============================================================

-- Stabilizers / Gimbals
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('DJI RS 4 Pro', 'stabilizer', 'DJI', 'RS 4 Pro', 'gimbal'),
  ('DJI RS 4', 'stabilizer', 'DJI', 'RS 4', 'gimbal'),
  ('DJI RS 3 Pro', 'stabilizer', 'DJI', 'RS 3 Pro', 'gimbal'),
  ('DJI RS 3 Mini', 'stabilizer', 'DJI', 'RS 3 Mini', 'gimbal'),
  ('DJI RS 5', 'stabilizer', 'DJI', 'RS 5', 'gimbal'),
  ('DJI RS 5 Pro', 'stabilizer', 'DJI', 'RS 5 Pro', 'gimbal'),
  ('DJI Ronin 4D', 'stabilizer', 'DJI', 'Ronin 4D', 'integrated_gimbal'),
  ('DJI Ronin 4D-8K', 'stabilizer', 'DJI', 'Ronin 4D-8K', 'integrated_gimbal'),
  ('Zhiyun Crane 4', 'stabilizer', 'Zhiyun', 'Crane 4', 'gimbal'),
  ('Zhiyun Crane 4E', 'stabilizer', 'Zhiyun', 'Crane 4E', 'gimbal'),
  ('Zhiyun Weebill 3S', 'stabilizer', 'Zhiyun', 'Weebill 3S', 'gimbal'),
  ('Zhiyun Crane M3S', 'stabilizer', 'Zhiyun', 'Crane M3S', 'gimbal'),
  ('Tilta Float System', 'stabilizer', 'Tilta', 'Float System', 'support'),
  ('Tilta Gravity G2X', 'stabilizer', 'Tilta', 'Gravity G2X', 'gimbal'),
  ('Moza Air 2S', 'stabilizer', 'Moza', 'Air 2S', 'gimbal'),
  ('FeiyuTech Scorp 2', 'stabilizer', 'FeiyuTech', 'Scorp 2', 'gimbal')
ON CONFLICT DO NOTHING;

-- Monitors
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('Atomos Ninja Ultra', 'monitor', 'Atomos', 'Ninja Ultra', 'recorder_monitor'),
  ('Atomos Ninja V+', 'monitor', 'Atomos', 'Ninja V+', 'recorder_monitor'),
  ('Atomos Shogun Ultra', 'monitor', 'Atomos', 'Shogun Ultra', 'recorder_monitor'),
  ('SmallHD Indie 7', 'monitor', 'SmallHD', 'Indie 7', 'on_camera'),
  ('SmallHD Ultra 7', 'monitor', 'SmallHD', 'Ultra 7', 'on_camera'),
  ('SmallHD Cine 13', 'monitor', 'SmallHD', 'Cine 13', 'director'),
  ('SmallHD Cine 24', 'monitor', 'SmallHD', 'Cine 24', 'director'),
  ('TVLogic F-7H Mk2', 'monitor', 'TVLogic', 'F-7H Mk2', 'on_camera'),
  ('Blackmagic Video Assist 5" 12G', 'monitor', 'Blackmagic Design', 'Video Assist 5" 12G', 'recorder_monitor'),
  ('Blackmagic Video Assist 7" 12G', 'monitor', 'Blackmagic Design', 'Video Assist 7" 12G', 'recorder_monitor'),
  ('Portkeys BM5 III', 'monitor', 'Portkeys', 'BM5 III', 'on_camera'),
  ('Feelworld LUT7S', 'monitor', 'Feelworld', 'LUT7S', 'on_camera'),
  ('ARRI Transvideo StarliteHD', 'monitor', 'ARRI', 'Transvideo StarliteHD', 'on_camera')
ON CONFLICT DO NOTHING;

-- Media / Storage
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('CFexpress Type B 512GB', 'media', 'SanDisk', 'Extreme Pro CFexpress B 512GB', 'cfexpress_b'),
  ('CFexpress Type A 160GB', 'media', 'Sony', 'CEA-G160T', 'cfexpress_a'),
  ('CFexpress Type A 320GB', 'media', 'Sony', 'CEA-G320T', 'cfexpress_a'),
  ('Samsung T9 Portable SSD 4TB', 'media', 'Samsung', 'T9 4TB', 'portable_ssd'),
  ('SanDisk Professional G-DRIVE', 'media', 'SanDisk', 'G-DRIVE ArmorATD', 'portable_hdd'),
  ('OWC Envoy Pro FX 2TB', 'media', 'OWC', 'Envoy Pro FX 2TB', 'portable_ssd'),
  ('Angelbird AV Pro CFexpress MK2', 'media', 'Angelbird', 'AV Pro CFexpress MK2', 'cfexpress_b'),
  ('ProGrade Digital CFexpress 4.0 Type B', 'media', 'ProGrade Digital', 'CFexpress 4.0 Type B 1.3TB', 'cfexpress_b'),
  ('Blackmagic MultiDock 10G', 'media', 'Blackmagic Design', 'MultiDock 10G', 'dock'),
  ('Nexto DI NPS-10', 'media', 'Nexto DI', 'NPS-10', 'field_backup'),
  ('RED Mini-Mag 960GB', 'media', 'RED Digital Cinema', 'Mini-Mag 960GB', 'proprietary'),
  ('ARRI Codex Compact Drive 2TB', 'media', 'ARRI', 'Codex Compact Drive 2TB', 'proprietary')
ON CONFLICT DO NOTHING;

-- Power / Batteries
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('Anton Bauer Titon SL 150', 'power', 'Anton Bauer', 'Titon SL 150', 'v_mount'),
  ('Anton Bauer Titon SL 240', 'power', 'Anton Bauer', 'Titon SL 240', 'v_mount'),
  ('Core SWX Hypercore NEO 150 Mini', 'power', 'Core SWX', 'Hypercore NEO 150 Mini', 'v_mount'),
  ('Core SWX Helix Max 98', 'power', 'Core SWX', 'Helix Max 98', 'gold_mount'),
  ('SmallRig VB99 Mini V Battery', 'power', 'SmallRig', 'VB99 Mini', 'v_mount'),
  ('Bebob Vmicro 98', 'power', 'Bebob', 'Vmicro 98', 'v_mount'),
  ('IDX DUO-C198', 'power', 'IDX', 'DUO-C198', 'v_mount'),
  ('Tilta V-Mount Battery 160Wh', 'power', 'Tilta', 'BP-V160', 'v_mount'),
  ('NP-F970 Battery', 'power', 'Sony', 'NP-F970', 'np_f'),
  ('Canon LP-E6NH', 'power', 'Canon', 'LP-E6NH', 'proprietary'),
  ('Sony NP-FZ100', 'power', 'Sony', 'NP-FZ100', 'proprietary'),
  ('Block Battery Dual 28V', 'power', 'Block Battery', 'Dual 28V', 'block'),
  ('Nanlite BT-BA-V Grip', 'power', 'Nanlite', 'BT-BA-V', 'v_mount_adapter')
ON CONFLICT DO NOTHING;

-- Wireless Video
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('Teradek Bolt 6 LT 750', 'wireless_video', 'Teradek', 'Bolt 6 LT 750', 'tx_rx'),
  ('Teradek Bolt 6 LT 1500', 'wireless_video', 'Teradek', 'Bolt 6 LT 1500', 'tx_rx'),
  ('Teradek Bolt 4K LT 750', 'wireless_video', 'Teradek', 'Bolt 4K LT 750', 'tx_rx'),
  ('Teradek Bolt 4K MAX', 'wireless_video', 'Teradek', 'Bolt 4K MAX', 'tx_rx'),
  ('Hollyland Mars 4K', 'wireless_video', 'Hollyland', 'Mars 4K', 'tx_rx'),
  ('Hollyland Pyro S', 'wireless_video', 'Hollyland', 'Pyro S', 'tx_rx'),
  ('Hollyland Cosmo C2', 'wireless_video', 'Hollyland', 'Cosmo C2', 'tx_rx'),
  ('Accsoon CineView Quad', 'wireless_video', 'Accsoon', 'CineView Quad', 'tx_rx'),
  ('Accsoon CineView SE', 'wireless_video', 'Accsoon', 'CineView SE', 'tx_rx'),
  ('Vaxis Storm 3000', 'wireless_video', 'Vaxis', 'Storm 3000', 'tx_rx'),
  ('Paralinx Tomahawk 2', 'wireless_video', 'Paralinx', 'Tomahawk 2', 'tx_rx'),
  ('DJI Video Transmitter', 'wireless_video', 'DJI', 'Video Transmitter', 'tx')
ON CONFLICT DO NOTHING;

-- Tripods / Support (augmenting existing categories)
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('Sachtler aktiv10T', 'support', 'Sachtler', 'aktiv10T', 'fluid_head_tripod'),
  ('Sachtler flowtech 100', 'support', 'Sachtler', 'flowtech 100', 'tripod_legs'),
  ('OConnor 2575D', 'support', 'OConnor', '2575D', 'fluid_head'),
  ('OConnor flowtech 75', 'support', 'OConnor', 'flowtech 75', 'tripod_legs'),
  ('Manfrotto 504X', 'support', 'Manfrotto', '504X', 'fluid_head'),
  ('Manfrotto 645 Carbon Fast Twin', 'support', 'Manfrotto', '645 Fast Twin', 'tripod_legs'),
  ('Benro Mach3 TMA47CL', 'support', 'Benro', 'Mach3 TMA47CL', 'tripod_legs'),
  ('Edelkrone SliderPLUS v5', 'support', 'Edelkrone', 'SliderPLUS v5', 'slider'),
  ('Edelkrone HeadPLUS v2', 'support', 'Edelkrone', 'HeadPLUS v2', 'motion_control'),
  ('Rhino Camera Gear ROV Pro', 'support', 'Rhino', 'ROV Pro', 'slider'),
  ('Dana Dolly Universal', 'support', 'Dana Dolly', 'Universal', 'dolly'),
  ('Matthews Doorway Dolly', 'support', 'Matthews', 'Doorway Dolly', 'dolly'),
  ('Proaim Flyking Precision Jib', 'support', 'Proaim', 'Flyking Precision Jib', 'jib')
ON CONFLICT DO NOTHING;

-- Wireless Audio (supplement existing audio category)
INSERT INTO equipment_library (name, category, brand, model, type) VALUES
  ('DJI Mic 2', 'audio', 'DJI', 'Mic 2', 'wireless_mic'),
  ('Rode Wireless PRO', 'audio', 'Rode', 'Wireless PRO', 'wireless_mic'),
  ('Rode Wireless ME', 'audio', 'Rode', 'Wireless ME', 'wireless_mic'),
  ('Sennheiser EW-DX', 'audio', 'Sennheiser', 'EW-DX', 'wireless_mic'),
  ('Sennheiser MKE 600', 'audio', 'Sennheiser', 'MKE 600', 'shotgun_mic'),
  ('Deity S-Mic 2 Location Kit', 'audio', 'Deity', 'S-Mic 2 Location Kit', 'shotgun_mic'),
  ('Deity Theos', 'audio', 'Deity', 'Theos', 'wireless_mic'),
  ('Sound Devices MixPre 6 III', 'audio', 'Sound Devices', 'MixPre 6 III', 'recorder'),
  ('Sound Devices 888', 'audio', 'Sound Devices', 'Scorpio 888', 'recorder'),
  ('Zoom F8n Pro', 'audio', 'Zoom', 'F8n Pro', 'recorder'),
  ('Tentacle Sync E mkII', 'audio', 'Tentacle Sync', 'Sync E mkII', 'timecode'),
  ('Deity TC-1', 'audio', 'Deity', 'TC-1', 'timecode')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 3: Search indexes for autocomplete
-- ============================================================

-- GIN trigram index for fuzzy search on equipment_library
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_equipment_library_name_trgm ON equipment_library USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_equipment_library_brand ON equipment_library (brand);
CREATE INDEX IF NOT EXISTS idx_equipment_library_category ON equipment_library (category);

-- Index on user_equipment for user lookups 
CREATE INDEX IF NOT EXISTS idx_user_equipment_user_id ON user_equipment (user_id);
CREATE INDEX IF NOT EXISTS idx_user_equipment_category ON user_equipment (category);
