-- Migration 089: Comprehensive Vendor Management System
-- Adds inventory management, orders, timeline history, insights, and tasks tracking

-- ==========================================
-- VENDOR INVENTORY MANAGEMENT
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES vendor_showcase_products(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- SKU Management
  sku VARCHAR(100) UNIQUE NOT NULL,
  
  -- Stock Tracking
  current_stock INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 0,
  maximum_stock INTEGER,
  reorder_point INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER DEFAULT 50,
  unit VARCHAR(20) DEFAULT 'stk',
  track_inventory BOOLEAN DEFAULT true,
  
  -- Location
  location VARCHAR(255),
  
  -- Status (auto-calculated but stored for quick queries)
  status VARCHAR(20) DEFAULT 'in_stock', -- in_stock, low_stock, out_of_stock, overstocked
  
  -- Sales Analytics
  average_sales_per_week DECIMAL(10, 2),
  last_restocked_at TIMESTAMP,
  last_sold_at TIMESTAMP,
  
  -- Supplier Info
  supplier VARCHAR(255),
  cost_price DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  
  -- Shipping (Bring Integration)
  shipping_enabled BOOLEAN DEFAULT false,
  weight DECIMAL(10, 2), -- in kg
  length DECIMAL(10, 2), -- in cm
  width DECIMAL(10, 2), -- in cm
  height DECIMAL(10, 2), -- in cm
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT positive_stock CHECK (current_stock >= 0),
  CONSTRAINT positive_minimum CHECK (minimum_stock >= 0),
  CONSTRAINT valid_reorder_point CHECK (reorder_point >= minimum_stock)
);

CREATE INDEX idx_vendor_inventory_product ON vendor_inventory(product_id);
CREATE INDEX idx_vendor_inventory_vendor ON vendor_inventory(vendor_name, vendor_type);
CREATE INDEX idx_vendor_inventory_sku ON vendor_inventory(sku);
CREATE INDEX idx_vendor_inventory_status ON vendor_inventory(status);
CREATE INDEX idx_vendor_inventory_user ON vendor_inventory(user_id);

-- ==========================================
-- INVENTORY TIMELINE/HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_inventory_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES vendor_showcase_products(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES vendor_inventory(id) ON DELETE CASCADE,
  
  -- Event Details
  event_type VARCHAR(50) NOT NULL, -- sale, order, restock, added, removed, adjustment_up, adjustment_down, shipped, cancelled, adjustment
  title VARCHAR(255) NOT NULL,
  description TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Stock Changes
  quantity_change INTEGER NOT NULL, -- Positive or negative
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  
  -- Attribution
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  reason TEXT,
  
  -- References
  order_id UUID REFERENCES vendor_orders(id) ON DELETE SET NULL,
  order_number VARCHAR(50),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inventory_timeline_product ON vendor_inventory_timeline(product_id);
CREATE INDEX idx_inventory_timeline_inventory ON vendor_inventory_timeline(inventory_id);
CREATE INDEX idx_inventory_timeline_timestamp ON vendor_inventory_timeline(timestamp DESC);
CREATE INDEX idx_inventory_timeline_event_type ON vendor_inventory_timeline(event_type);
CREATE INDEX idx_inventory_timeline_user ON vendor_inventory_timeline(user_id);
CREATE INDEX idx_inventory_timeline_order ON vendor_inventory_timeline(order_id);

-- ==========================================
-- VENDOR ORDERS
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Vendor Info
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(50) NOT NULL,
  vendor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Customer Info
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50),
  
  -- Order Details
  total_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NOK',
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, shipped, delivered, cancelled
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, refunded
  
  -- Shipping
  fulfillment_method VARCHAR(50), -- physical_shipping, digital_delivery, pickup
  tracking_number VARCHAR(255),
  shipping_address JSONB,
  shipping_cost DECIMAL(10, 2),
  
  -- Bring Integration
  bring_service VARCHAR(100),
  bring_expected_delivery VARCHAR(50),
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX idx_vendor_orders_vendor ON vendor_orders(vendor_name, vendor_type);
CREATE INDEX idx_vendor_orders_vendor_user ON vendor_orders(vendor_user_id);
CREATE INDEX idx_vendor_orders_status ON vendor_orders(status);
CREATE INDEX idx_vendor_orders_payment_status ON vendor_orders(payment_status);
CREATE INDEX idx_vendor_orders_customer_email ON vendor_orders(customer_email);
CREATE INDEX idx_vendor_orders_order_number ON vendor_orders(order_number);
CREATE INDEX idx_vendor_orders_created_at ON vendor_orders(created_at DESC);

-- ==========================================
-- VENDOR ORDER ITEMS
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES vendor_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES vendor_showcase_products(id) ON DELETE RESTRICT,
  
  -- Product Info (snapshot at time of order)
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  
  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  
  -- Fulfillment
  fulfilled BOOLEAN DEFAULT false,
  fulfilled_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_unit_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_order_items_order ON vendor_order_items(order_id);
CREATE INDEX idx_order_items_product ON vendor_order_items(product_id);
CREATE INDEX idx_order_items_sku ON vendor_order_items(sku);

-- ==========================================
-- VENDOR INSIGHTS (AI-powered recommendations)
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Insight Details
  insight_type VARCHAR(50) NOT NULL, -- bestseller_low_stock, high_views_low_sales, poor_descriptions, shipping_optimization, pricing_opportunity, top_performance
  priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Metrics
  metrics JSONB, -- Dynamic metrics for each insight type
  
  -- Action
  action_handler VARCHAR(100),
  action_label VARCHAR(100),
  action_data JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_vendor_insights_vendor ON vendor_insights(vendor_name, vendor_type);
CREATE INDEX idx_vendor_insights_user ON vendor_insights(user_id);
CREATE INDEX idx_vendor_insights_type ON vendor_insights(insight_type);
CREATE INDEX idx_vendor_insights_priority ON vendor_insights(priority);
CREATE INDEX idx_vendor_insights_active ON vendor_insights(is_active);
CREATE INDEX idx_vendor_insights_created_at ON vendor_insights(created_at DESC);

-- ==========================================
-- VENDOR TASKS (Onboarding & Progress)
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Task Details
  task_id VARCHAR(100) NOT NULL, -- storefront_setup, first_products, payout_method, etc.
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'onboarding', -- onboarding, growth, optimization, maintenance
  
  -- Priority & Status
  priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
  completed BOOLEAN DEFAULT false,
  
  -- Progress Tracking
  current_progress INTEGER DEFAULT 0,
  target_progress INTEGER,
  
  -- Action
  action VARCHAR(100),
  action_label VARCHAR(100),
  
  -- Metadata
  estimated_time VARCHAR(50),
  benefits JSONB, -- Array of benefit strings
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(vendor_name, vendor_type, user_id, task_id)
);

CREATE INDEX idx_vendor_tasks_vendor ON vendor_tasks(vendor_name, vendor_type);
CREATE INDEX idx_vendor_tasks_user ON vendor_tasks(user_id);
CREATE INDEX idx_vendor_tasks_task_id ON vendor_tasks(task_id);
CREATE INDEX idx_vendor_tasks_completed ON vendor_tasks(completed);
CREATE INDEX idx_vendor_tasks_priority ON vendor_tasks(priority);
CREATE INDEX idx_vendor_tasks_category ON vendor_tasks(category);

-- ==========================================
-- VENDOR STATISTICS (Cached for Quick Stats)
-- ==========================================

CREATE TABLE IF NOT EXISTS vendor_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(255) NOT NULL,
  vendor_type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Product Stats
  total_products INTEGER DEFAULT 0,
  products_change INTEGER DEFAULT 0, -- Change this week
  
  -- Order Stats
  pending_orders INTEGER DEFAULT 0,
  processing_orders INTEGER DEFAULT 0,
  shipped_orders INTEGER DEFAULT 0,
  delivered_orders INTEGER DEFAULT 0,
  
  -- Inventory Stats
  low_stock_count INTEGER DEFAULT 0,
  out_of_stock_count INTEGER DEFAULT 0,
  
  -- Revenue
  revenue_30d DECIMAL(10, 2) DEFAULT 0,
  revenue_change DECIMAL(5, 2) DEFAULT 0, -- Percentage change
  
  -- Showcase
  showcase_views INTEGER DEFAULT 0,
  showcase_views_change INTEGER DEFAULT 0,
  
  -- Shipping
  shipped_today INTEGER DEFAULT 0,
  shipping_savings DECIMAL(10, 2),
  
  -- Downloads (digital products)
  downloads_30d INTEGER DEFAULT 0,
  downloads_change DECIMAL(5, 2) DEFAULT 0,
  
  -- Recent Activity
  recent_activity JSONB,
  
  -- Update Tracking
  last_calculated_at TIMESTAMP DEFAULT NOW(),
  calculation_duration_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(vendor_name, vendor_type, user_id)
);

CREATE INDEX idx_vendor_statistics_vendor ON vendor_statistics(vendor_name, vendor_type);
CREATE INDEX idx_vendor_statistics_user ON vendor_statistics(user_id);
CREATE INDEX idx_vendor_statistics_updated_at ON vendor_statistics(updated_at DESC);

-- ==========================================
-- FUNCTIONS: Auto-update inventory status
-- ==========================================

CREATE OR REPLACE FUNCTION update_inventory_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-calculate inventory status based on stock levels
  IF NEW.current_stock <= 0 THEN
    NEW.status = 'out_of_stock';
  ELSIF NEW.current_stock <= NEW.minimum_stock THEN
    NEW.status = 'low_stock';
  ELSIF NEW.maximum_stock IS NOT NULL AND NEW.current_stock >= NEW.maximum_stock THEN
    NEW.status = 'overstocked';
  ELSE
    NEW.status = 'in_stock';
  END IF;
  
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory_status
  BEFORE INSERT OR UPDATE OF current_stock, minimum_stock, maximum_stock
  ON vendor_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_status();

-- ==========================================
-- FUNCTIONS: Auto-create timeline events
-- ==========================================

CREATE OR REPLACE FUNCTION create_inventory_timeline_on_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create timeline event if stock actually changed
  IF (TG_OP = 'UPDATE' AND OLD.current_stock != NEW.current_stock) OR TG_OP = 'INSERT' THEN
    INSERT INTO vendor_inventory_timeline (
      product_id,
      inventory_id,
      event_type,
      title,
      description,
      quantity_change,
      stock_before,
      stock_after,
      user_id,
      timestamp
    ) VALUES (
      NEW.product_id,
      NEW.id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'added'
        WHEN NEW.current_stock > OLD.current_stock THEN 'adjustment_up'
        ELSE 'adjustment_down'
      END,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'Produkt lagt til i lager'
        WHEN NEW.current_stock > OLD.current_stock THEN 'Lager økt'
        ELSE 'Lager redusert'
      END,
      'Automatisk registrert lagerendring',
      CASE 
        WHEN TG_OP = 'INSERT' THEN NEW.current_stock
        ELSE NEW.current_stock - OLD.current_stock
      END,
      COALESCE(OLD.current_stock, 0),
      NEW.current_stock,
      NEW.user_id,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_inventory_timeline
  AFTER INSERT OR UPDATE OF current_stock
  ON vendor_inventory
  FOR EACH ROW
  EXECUTE FUNCTION create_inventory_timeline_on_stock_change();

-- ==========================================
-- FUNCTIONS: Auto-update order timestamps
-- ==========================================

CREATE OR REPLACE FUNCTION update_vendor_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Set shipped_at when status changes to shipped
  IF NEW.status = 'shipped' AND (OLD.status IS NULL OR OLD.status != 'shipped') THEN
    NEW.shipped_at = NOW();
  END IF;
  
  -- Set delivered_at when status changes to delivered
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    NEW.delivered_at = NOW();
  END IF;
  
  -- Set cancelled_at when status changes to cancelled
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    NEW.cancelled_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vendor_order_timestamps
  BEFORE UPDATE OF status
  ON vendor_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_order_timestamps();

-- ==========================================
-- COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON TABLE vendor_inventory IS 'Comprehensive inventory management for vendor products with SKU tracking, stock levels, and shipping integration';
COMMENT ON TABLE vendor_inventory_timeline IS 'Complete audit trail of all inventory movements with user attribution and reason tracking';
COMMENT ON TABLE vendor_orders IS 'Vendor order management with status tracking, shipping integration (Bring), and customer information';
COMMENT ON TABLE vendor_order_items IS 'Individual items in vendor orders with product snapshots and fulfillment tracking';
COMMENT ON TABLE vendor_insights IS 'AI-powered insights and recommendations for vendors (bestsellers, conversion, pricing, etc.)';
COMMENT ON TABLE vendor_tasks IS 'Onboarding and progress tasks for vendors with completion tracking';
COMMENT ON TABLE vendor_statistics IS 'Cached statistics for quick dashboard loading (updated periodically)';

-- ==========================================
-- SAMPLE DATA FOR TESTING (Optional)
-- ==========================================

-- Uncomment to insert sample data for development/testing
/*
INSERT INTO vendor_inventory (product_id, vendor_name, vendor_type, user_id, sku, current_stock, minimum_stock, reorder_point, unit)
SELECT 
  id,
  vendor_name,
  'print',
  (SELECT id FROM users LIMIT 1),
  'PROD-' || LPAD(ROW_NUMBER() OVER ()::TEXT, 4, '0'),
  FLOOR(RANDOM() * 100)::INTEGER,
  10,
  15,
  'stk'
FROM vendor_showcase_products
WHERE vendor_name IS NOT NULL
LIMIT 10;
*/

-- ==========================================
-- GRANT PERMISSIONS (adjust as needed)
-- ==========================================

-- Grant appropriate permissions to application role
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_inventory TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_inventory_timeline TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_orders TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_order_items TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_insights TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_tasks TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON vendor_statistics TO app_user;


