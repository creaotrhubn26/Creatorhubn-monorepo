-- Migration: Add full schema to vendor_showcase_products table
-- This migration adds all necessary columns for the UniversalVendorShowcase

-- First, create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS vendor_showcase_products (
  id SERIAL PRIMARY KEY,
  vendor_id VARCHAR NOT NULL,
  vendor_name VARCHAR,
  product_name VARCHAR NOT NULL,
  product_type VARCHAR NOT NULL,
  price INTEGER DEFAULT 0,
  description TEXT,
  image_url VARCHAR,
  audio_samples TEXT[] DEFAULT '{}',
  video_samples TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'name') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN name VARCHAR;
    UPDATE vendor_showcase_products SET name = product_name WHERE name IS NULL;
    ALTER TABLE vendor_showcase_products ALTER COLUMN name SET NOT NULL;
  END IF;

  -- category column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'category') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN category VARCHAR NOT NULL DEFAULT 'all';
  END IF;

  -- version column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'version') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN version VARCHAR DEFAULT '1.0.0';
  END IF;

  -- currency column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'currency') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN currency VARCHAR DEFAULT 'NOK';
  END IF;

  -- download_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'download_url') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN download_url VARCHAR;
  END IF;

  -- demo_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'demo_url') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN demo_url VARCHAR;
  END IF;

  -- model_3d_url column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'model_3d_url') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN model_3d_url VARCHAR;
  END IF;

  -- screenshots column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'screenshots') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN screenshots TEXT[] DEFAULT '{}';
  END IF;

  -- requirements column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'requirements') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN requirements TEXT[] DEFAULT '{}';
  END IF;

  -- tags column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'tags') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN tags TEXT[] DEFAULT '{}';
  END IF;

  -- download_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'download_count') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN download_count INTEGER DEFAULT 0;
  END IF;

  -- average_rating column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'average_rating') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN average_rating DECIMAL(3,2) DEFAULT 0;
  END IF;

  -- review_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'review_count') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN review_count INTEGER DEFAULT 0;
  END IF;

  -- featured column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'featured') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN featured BOOLEAN DEFAULT FALSE;
  END IF;

  -- status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'status') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN status VARCHAR DEFAULT 'active';
  END IF;

  -- release_date column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_showcase_products' AND column_name = 'release_date') THEN
    ALTER TABLE vendor_showcase_products ADD COLUMN release_date TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_vendor_id ON vendor_showcase_products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_vendor_name ON vendor_showcase_products(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_product_type ON vendor_showcase_products(product_type);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_category ON vendor_showcase_products(category);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_featured ON vendor_showcase_products(featured);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_status ON vendor_showcase_products(status);

-- Create vendor_showcase_stats table if not exists
CREATE TABLE IF NOT EXISTS vendor_showcase_stats (
  id VARCHAR PRIMARY KEY,
  vendor_id VARCHAR NOT NULL,
  total_products INTEGER DEFAULT 0,
  total_downloads INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  average_rating INTEGER DEFAULT 0,
  featured_products INTEGER DEFAULT 0,
  active_products INTEGER DEFAULT 0,
  popularity_score INTEGER DEFAULT 0,
  last_calculated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_showcase_stats_vendor_id ON vendor_showcase_stats(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_stats_score ON vendor_showcase_stats(popularity_score);
CREATE INDEX IF NOT EXISTS idx_vendor_showcase_stats_revenue ON vendor_showcase_stats(total_revenue);

-- Create vendor_product_reviews table if not exists
CREATE TABLE IF NOT EXISTS vendor_product_reviews (
  id VARCHAR PRIMARY KEY,
  product_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  rating INTEGER NOT NULL,
  title VARCHAR,
  comment TEXT,
  verified BOOLEAN DEFAULT FALSE,
  helpful INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_product_id ON vendor_product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_user_id ON vendor_product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_rating ON vendor_product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_verified ON vendor_product_reviews(verified);

-- Create vendor_product_downloads table if not exists
CREATE TABLE IF NOT EXISTS vendor_product_downloads (
  id VARCHAR PRIMARY KEY,
  product_id VARCHAR NOT NULL,
  user_id VARCHAR,
  ip_address VARCHAR,
  user_agent TEXT,
  download_date TIMESTAMP DEFAULT NOW(),
  file_size INTEGER,
  download_duration INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_downloads_product_id ON vendor_product_downloads(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_downloads_user_id ON vendor_product_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_downloads_date ON vendor_product_downloads(download_date);
CREATE INDEX IF NOT EXISTS idx_vendor_downloads_completed ON vendor_product_downloads(completed);

-- Done
SELECT 'Migration 050_vendor_showcase_products_full_schema completed successfully' AS status;

