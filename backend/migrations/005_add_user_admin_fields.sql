-- Migration: Add admin and role fields to users table
-- Date: 2025-01-28

-- Add role column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';

-- Add is_administrator column  
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_administrator BOOLEAN DEFAULT FALSE;

-- Add admin_level column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_level VARCHAR(50);

-- Add admin_permissions column (JSONB for flexible permission structure)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS admin_permissions JSONB;

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Create index on is_administrator for faster admin checks
CREATE INDEX IF NOT EXISTS users_is_administrator_idx ON users(is_administrator);

COMMENT ON COLUMN users.role IS 'User role: user, admin, super_admin, etc.';
COMMENT ON COLUMN users.is_administrator IS 'Whether user has administrator privileges';
COMMENT ON COLUMN users.admin_level IS 'Level of admin access: super_admin, admin, moderator';
COMMENT ON COLUMN users.admin_permissions IS 'JSON object containing detailed admin permissions';
