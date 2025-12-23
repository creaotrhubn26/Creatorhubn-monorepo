-- Migration: Enterprise Pricing Configuration
-- Description: Add table to store configurable enterprise pricing settings
-- Created: 2025-01-28

-- Create enterprise_pricing_config table
CREATE TABLE IF NOT EXISTS enterprise_pricing_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    base_price DECIMAL(10, 2) NOT NULL DEFAULT 1499.00,
    base_price_annual DECIMAL(10, 2) NOT NULL DEFAULT 14990.00,
    included_users INTEGER NOT NULL DEFAULT 3,
    price_per_user DECIMAL(10, 2) NOT NULL DEFAULT 299.00,
    price_per_user_annual DECIMAL(10, 2) NOT NULL DEFAULT 2990.00,
    volume_discounts JSONB NOT NULL DEFAULT '[
        {"minUsers": 10, "discount": 5},
        {"minUsers": 25, "discount": 10},
        {"minUsers": 50, "discount": 15}
    ]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Insert default pricing configuration
INSERT INTO enterprise_pricing_config (
    config_key,
    base_price,
    base_price_annual,
    included_users,
    price_per_user,
    price_per_user_annual,
    volume_discounts,
    is_active
) VALUES (
    'default',
    1499.00,
    14990.00,
    3,
    299.00,
    2990.00,
    '[
        {"minUsers": 10, "discount": 5},
        {"minUsers": 25, "discount": 10},
        {"minUsers": 50, "discount": 15}
    ]'::jsonb,
    true
) ON CONFLICT (config_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_enterprise_pricing_config_key ON enterprise_pricing_config(config_key);
CREATE INDEX IF NOT EXISTS idx_enterprise_pricing_active ON enterprise_pricing_config(is_active);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_enterprise_pricing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enterprise_pricing_updated ON enterprise_pricing_config;
CREATE TRIGGER trigger_enterprise_pricing_updated
    BEFORE UPDATE ON enterprise_pricing_config
    FOR EACH ROW
    EXECUTE FUNCTION update_enterprise_pricing_timestamp();

-- Add comments for documentation
COMMENT ON TABLE enterprise_pricing_config IS 'Stores configurable enterprise pricing settings managed from admin dashboard';
COMMENT ON COLUMN enterprise_pricing_config.config_key IS 'Unique key for pricing configuration (default is main config)';
COMMENT ON COLUMN enterprise_pricing_config.base_price IS 'Monthly base price in NOK';
COMMENT ON COLUMN enterprise_pricing_config.base_price_annual IS 'Annual base price in NOK';
COMMENT ON COLUMN enterprise_pricing_config.included_users IS 'Number of users included in base price';
COMMENT ON COLUMN enterprise_pricing_config.price_per_user IS 'Monthly price per additional user in NOK';
COMMENT ON COLUMN enterprise_pricing_config.price_per_user_annual IS 'Annual price per additional user in NOK';
COMMENT ON COLUMN enterprise_pricing_config.volume_discounts IS 'JSON array of volume discount tiers [{minUsers, discount}]';

