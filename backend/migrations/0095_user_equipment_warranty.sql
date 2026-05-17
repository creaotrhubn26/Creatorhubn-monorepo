-- 0095_user_equipment_warranty.sql
-- Utvider user_equipment med felter for norsk garanti + reklamasjonstid
-- og kobling til katalog-entry (slik at vi kan vise bilde, firmware-link,
-- modell-spesifikasjoner uten å lagre dem per bruker).
--
-- GARANTI (warranty_months): frivillig forpliktelse fra produsent/forhandler.
-- Canon Norge gir typisk 2 år EU-garanti på speilløse, Sony 1-2 år, etc.
-- Garanti kan IKKE redusere lovpålagte forbruker-rettigheter.
--
-- REKLAMASJONSRETT (reklamasjon_months): lovpålagt under Forbrukerkjøpsloven §27.
-- 2 år standard, 5 år hvis varen "skal vare vesentlig lengre". For
-- profesjonell kamera-utstyr regnes 5 år som normen (50k+ NOK, designed
-- for years of professional use). Defaulter 60 mnd = 5 år.

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS catalog_id VARCHAR(64);

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS reklamasjon_months INTEGER DEFAULT 60;

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS firmware_url VARCHAR(500);

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS latest_firmware_version VARCHAR(64);

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS retailer VARCHAR(128);

ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500);

CREATE INDEX IF NOT EXISTS user_equipment_catalog_idx
  ON user_equipment (catalog_id);

COMMENT ON COLUMN user_equipment.warranty_months IS
  'Antall måneder garanti fra purchase_date. Frivillig forpliktelse fra produsent/forhandler.';
COMMENT ON COLUMN user_equipment.reklamasjon_months IS
  'Antall måneder reklamasjonsrett fra purchase_date (Forbrukerkjøpsloven §27). Default 60 (5 år) for varer som skal vare lenge.';
COMMENT ON COLUMN user_equipment.catalog_id IS
  'Foreign key til equipment-katalog (seeded JSON). NULL for custom utstyr ikke i katalog.';
COMMENT ON COLUMN user_equipment.retailer IS
  'Hvor utstyret ble kjøpt — viktig for reklamasjon (krav fremmes mot forhandler, ikke produsent).';
