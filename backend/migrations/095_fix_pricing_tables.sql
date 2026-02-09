-- Fix pricing_categories table structure
ALTER TABLE pricing_categories 
  ADD COLUMN IF NOT EXISTS profession VARCHAR(100),
  ADD COLUMN IF NOT EXISTS category_name VARCHAR(255);

-- Migrate data from 'name' to 'category_name' if needed
UPDATE pricing_categories SET category_name = name WHERE category_name IS NULL;

-- Make category_name NOT NULL after migration
ALTER TABLE pricing_categories 
  ALTER COLUMN category_name SET NOT NULL;

-- Drop old pricing_packages table and recreate with correct structure
DROP TABLE IF EXISTS pricing_packages CASCADE;

CREATE TABLE pricing_packages (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100),
  package_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  included_services JSONB DEFAULT '[]'::jsonb,
  is_visible BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_packages_user_id ON pricing_packages(user_id);
CREATE INDEX idx_pricing_packages_profession ON pricing_packages(profession);

CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON pricing_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create customer_pricing table if it doesn't exist
CREATE TABLE IF NOT EXISTS customer_pricing (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100),
  client_id VARCHAR(255),
  pricing_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(255),
  item_name VARCHAR(255),
  discount_percentage DECIMAL(5, 2),
  fixed_price DECIMAL(10, 2),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_user_id ON customer_pricing(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_client_id ON customer_pricing(client_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_profession ON customer_pricing(profession);

DROP TRIGGER IF EXISTS update_customer_pricing_updated_at ON customer_pricing;
CREATE TRIGGER update_customer_pricing_updated_at BEFORE UPDATE ON customer_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
