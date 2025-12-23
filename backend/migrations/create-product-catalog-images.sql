-- Create Product Catalog Images Table
-- Stores real manufacturer product photos for equipment catalog
-- Separate from user_equipment_images to avoid conflicts

CREATE TABLE IF NOT EXISTS product_catalog_images (
  id SERIAL PRIMARY KEY,
  brand VARCHAR NOT NULL,
  model VARCHAR NOT NULL,
  category VARCHAR, -- Kameraer, Objektiver, Blits, Lyd, Stativer
  
  -- Image Details
  image_url VARCHAR NOT NULL,
  title VARCHAR,
  source VARCHAR, -- Website where image was found
  width INTEGER DEFAULT 800,
  height INTEGER DEFAULT 600,
  
  -- Search Engine Information
  search_engine VARCHAR NOT NULL, -- "Google Custom Search Engine", "Workload Identity", etc.
  search_engine_id VARCHAR, -- For tracking which CSE was used
  
  -- Quality Control
  verified BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false, -- Primary image for this product
  is_official BOOLEAN DEFAULT false, -- From official manufacturer site
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_catalog_brand_model 
  ON product_catalog_images(brand, model);

CREATE INDEX IF NOT EXISTS idx_product_catalog_category 
  ON product_catalog_images(category);

CREATE INDEX IF NOT EXISTS idx_product_catalog_verified 
  ON product_catalog_images(verified);

CREATE INDEX IF NOT EXISTS idx_product_catalog_official 
  ON product_catalog_images(is_official);

-- Add unique constraint to prevent duplicate images
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_catalog_unique_image 
  ON product_catalog_images(brand, model, image_url);

-- Comments for documentation
COMMENT ON TABLE product_catalog_images IS 'Product catalog images for equipment selection in UniversalOnboarding. Separate from user_equipment_images.';
COMMENT ON COLUMN product_catalog_images.brand IS 'Equipment manufacturer (Canon, Sony, Godox, etc.)';
COMMENT ON COLUMN product_catalog_images.model IS 'Equipment model (EOS R5, FX30, V1, etc.)';
COMMENT ON COLUMN product_catalog_images.is_official IS 'True if image is from official manufacturer website';
COMMENT ON COLUMN product_catalog_images.search_engine IS 'Source of image (Google CSE, manufacturer site, etc.)';
