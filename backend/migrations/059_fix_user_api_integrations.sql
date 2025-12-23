-- Migration 059: Fix user_api_integrations table schema
-- This migration adds missing columns to the user_api_integrations table
-- to match the Drizzle schema in shared/api-integrations-schema.ts

-- First, check if columns already exist and add them if not
DO $$
BEGIN
    -- Add user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'user_id') THEN
        ALTER TABLE user_api_integrations ADD COLUMN user_id VARCHAR(255) NOT NULL DEFAULT 'system';
    END IF;

    -- Add provider_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'provider_id') THEN
        ALTER TABLE user_api_integrations ADD COLUMN provider_id VARCHAR(255) NOT NULL DEFAULT 'unknown';
    END IF;

    -- Add display_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'display_name') THEN
        ALTER TABLE user_api_integrations ADD COLUMN display_name VARCHAR(255);
    END IF;

    -- Add configuration column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'configuration') THEN
        ALTER TABLE user_api_integrations ADD COLUMN configuration JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Add client_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'client_id') THEN
        ALTER TABLE user_api_integrations ADD COLUMN client_id TEXT;
    END IF;

    -- Add client_secret column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'client_secret') THEN
        ALTER TABLE user_api_integrations ADD COLUMN client_secret TEXT;
    END IF;

    -- Add api_key column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'api_key') THEN
        ALTER TABLE user_api_integrations ADD COLUMN api_key TEXT;
    END IF;

    -- Add access_token column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'access_token') THEN
        ALTER TABLE user_api_integrations ADD COLUMN access_token TEXT;
    END IF;

    -- Add refresh_token column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'refresh_token') THEN
        ALTER TABLE user_api_integrations ADD COLUMN refresh_token TEXT;
    END IF;

    -- Add token_expires_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'token_expires_at') THEN
        ALTER TABLE user_api_integrations ADD COLUMN token_expires_at TIMESTAMP;
    END IF;

    -- Add is_active column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'is_active') THEN
        ALTER TABLE user_api_integrations ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- Add is_enabled column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'is_enabled') THEN
        ALTER TABLE user_api_integrations ADD COLUMN is_enabled BOOLEAN DEFAULT false;
    END IF;

    -- Add last_sync_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'last_sync_at') THEN
        ALTER TABLE user_api_integrations ADD COLUMN last_sync_at TIMESTAMP;
    END IF;

    -- Add sync_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'sync_status') THEN
        ALTER TABLE user_api_integrations ADD COLUMN sync_status VARCHAR(50) DEFAULT 'pending';
    END IF;

    -- Add error_message column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'error_message') THEN
        ALTER TABLE user_api_integrations ADD COLUMN error_message TEXT;
    END IF;

    -- Add sync_frequency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'sync_frequency') THEN
        ALTER TABLE user_api_integrations ADD COLUMN sync_frequency VARCHAR(50) DEFAULT 'manual';
    END IF;

    -- Add webhook_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'webhook_url') THEN
        ALTER TABLE user_api_integrations ADD COLUMN webhook_url TEXT;
    END IF;

    -- Add environment column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'environment') THEN
        ALTER TABLE user_api_integrations ADD COLUMN environment VARCHAR(50) DEFAULT 'production';
    END IF;

    -- Add created_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'created_at') THEN
        ALTER TABLE user_api_integrations ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_api_integrations' AND column_name = 'updated_at') THEN
        ALTER TABLE user_api_integrations ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_api_integrations_user_id_idx ON user_api_integrations(user_id);
CREATE INDEX IF NOT EXISTS user_api_integrations_provider_id_idx ON user_api_integrations(provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_api_integrations_user_provider_unique ON user_api_integrations(user_id, provider_id);

-- Remove NOT NULL constraint default values (now that columns exist)
ALTER TABLE user_api_integrations ALTER COLUMN user_id DROP DEFAULT;
ALTER TABLE user_api_integrations ALTER COLUMN provider_id DROP DEFAULT;

-- Show final table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_api_integrations' 
ORDER BY ordinal_position;

