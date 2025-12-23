-- Migration: Add payment tracking fields to invite_requests table
-- Date: 2025-11-21
-- Description: Add subscription plan and payment information to invite requests

-- Add payment tracking columns to invite_requests table
ALTER TABLE invite_requests 
ADD COLUMN IF NOT EXISTS selected_plan VARCHAR(255),
ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS plan_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS payment_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS payment_timestamp TIMESTAMP;

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS invite_requests_payment_completed_idx ON invite_requests(payment_completed);
CREATE INDEX IF NOT EXISTS invite_requests_selected_plan_idx ON invite_requests(selected_plan);

-- Add comment to document the purpose
COMMENT ON COLUMN invite_requests.selected_plan IS 'Subscription plan ID selected by user';
COMMENT ON COLUMN invite_requests.plan_name IS 'Human-readable subscription plan name';
COMMENT ON COLUMN invite_requests.plan_price IS 'Price of selected plan in NOK';
COMMENT ON COLUMN invite_requests.payment_completed IS 'Whether payment has been completed';
COMMENT ON COLUMN invite_requests.payment_transaction_id IS 'Google Pay transaction ID';
COMMENT ON COLUMN invite_requests.payment_amount IS 'Actual amount paid in NOK';
COMMENT ON COLUMN invite_requests.payment_timestamp IS 'When payment was completed';

