-- ============================================
-- Pricing System Tables
-- ============================================

-- Pricing Categories
CREATE TABLE IF NOT EXISTS pricing_categories (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100),
  category_name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_categories_user_id ON pricing_categories(user_id);
CREATE INDEX idx_pricing_categories_profession ON pricing_categories(profession);

-- Pricing Services
CREATE TABLE IF NOT EXISTS pricing_services (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100),
  category_id VARCHAR(255) REFERENCES pricing_categories(id) ON DELETE SET NULL,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2),
  price_type VARCHAR(50) DEFAULT 'fixed',
  unit VARCHAR(50),
  minimum_quantity INTEGER DEFAULT 1,
  maximum_quantity INTEGER,
  is_visible BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_services_user_id ON pricing_services(user_id);
CREATE INDEX idx_pricing_services_category_id ON pricing_services(category_id);
CREATE INDEX idx_pricing_services_profession ON pricing_services(profession);

-- Pricing Packages
CREATE TABLE IF NOT EXISTS pricing_packages (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL,
  profession VARCHAR(100),
  package_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2),
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  included_services JSONB DEFAULT '[]'::jsonb,
  is_visible BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_packages_user_id ON pricing_packages(user_id);
CREATE INDEX idx_pricing_packages_profession ON pricing_packages(profession);

-- Customer Pricing (custom pricing per client)
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

CREATE INDEX idx_customer_pricing_user_id ON customer_pricing(user_id);
CREATE INDEX idx_customer_pricing_client_id ON customer_pricing(client_id);
CREATE INDEX idx_customer_pricing_profession ON customer_pricing(profession);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pricing_categories_updated_at BEFORE UPDATE ON pricing_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_services_updated_at BEFORE UPDATE ON pricing_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON pricing_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_pricing_updated_at BEFORE UPDATE ON customer_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
