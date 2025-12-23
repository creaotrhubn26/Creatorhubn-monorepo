-- Migration 060: Fix Equipment Management Tables
-- Fixes schema mismatch between Drizzle schema and actual database tables
-- Tables affected: market_equipment, software_database, software_updates

-- ============================================================================
-- 1. FIX market_equipment TABLE
-- ============================================================================

-- Add missing columns to market_equipment
DO $$ BEGIN
    -- Add current_price column (Drizzle expects this, DB has current_market_price)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'current_price') THEN
        ALTER TABLE market_equipment ADD COLUMN current_price numeric(10, 2);
        -- Copy data from current_market_price if it exists
        UPDATE market_equipment SET current_price = current_market_price WHERE current_market_price IS NOT NULL;
    END IF;
    
    -- Add currency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'currency') THEN
        ALTER TABLE market_equipment ADD COLUMN currency varchar(3) DEFAULT 'NOK';
    END IF;
    
    -- Add availability column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'availability') THEN
        ALTER TABLE market_equipment ADD COLUMN availability varchar DEFAULT 'available';
    END IF;
    
    -- Add compatibility column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'compatibility') THEN
        ALTER TABLE market_equipment ADD COLUMN compatibility jsonb;
    END IF;
    
    -- Add release_year column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'release_year') THEN
        ALTER TABLE market_equipment ADD COLUMN release_year integer;
    END IF;
    
    -- Add last_updated column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'last_updated') THEN
        ALTER TABLE market_equipment ADD COLUMN last_updated timestamp;
    END IF;
    
    -- Add source_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'source_url') THEN
        ALTER TABLE market_equipment ADD COLUMN source_url varchar;
    END IF;
    
    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'market_equipment' AND column_name = 'updated_at') THEN
        ALTER TABLE market_equipment ADD COLUMN updated_at timestamp DEFAULT NOW();
    END IF;
END $$;

-- ============================================================================
-- 2. FIX software_database TABLE
-- ============================================================================

DO $$ BEGIN
    -- Add developer column (Drizzle expects this, DB has vendor)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'developer') THEN
        ALTER TABLE software_database ADD COLUMN developer varchar;
        -- Copy data from vendor if it exists
        UPDATE software_database SET developer = vendor WHERE vendor IS NOT NULL;
    END IF;
    
    -- Add last_updated column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'last_updated') THEN
        ALTER TABLE software_database ADD COLUMN last_updated timestamp DEFAULT NOW();
    END IF;
    
    -- Add free_trial_available column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'free_trial_available') THEN
        ALTER TABLE software_database ADD COLUMN free_trial_available boolean DEFAULT false;
    END IF;
    
    -- Add free_trial_days column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'free_trial_days') THEN
        ALTER TABLE software_database ADD COLUMN free_trial_days integer;
    END IF;
    
    -- Add music_producer_rating column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'music_producer_rating') THEN
        ALTER TABLE software_database ADD COLUMN music_producer_rating numeric(3, 2);
    END IF;
    
    -- Add features column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'features') THEN
        ALTER TABLE software_database ADD COLUMN features jsonb;
    END IF;
    
    -- Add photographer_benefits column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'photographer_benefits') THEN
        ALTER TABLE software_database ADD COLUMN photographer_benefits jsonb;
    END IF;
    
    -- Add videographer_benefits column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'videographer_benefits') THEN
        ALTER TABLE software_database ADD COLUMN videographer_benefits jsonb;
    END IF;
    
    -- Add music_producer_benefits column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'music_producer_benefits') THEN
        ALTER TABLE software_database ADD COLUMN music_producer_benefits jsonb;
    END IF;
    
    -- Add website column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'website') THEN
        ALTER TABLE software_database ADD COLUMN website varchar;
    END IF;
    
    -- Add documentation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'documentation') THEN
        ALTER TABLE software_database ADD COLUMN documentation varchar;
    END IF;
    
    -- Add support column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'support') THEN
        ALTER TABLE software_database ADD COLUMN support varchar;
    END IF;
    
    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_database' AND column_name = 'updated_at') THEN
        ALTER TABLE software_database ADD COLUMN updated_at timestamp DEFAULT NOW();
    END IF;
END $$;

-- ============================================================================
-- 3. FIX software_updates TABLE
-- ============================================================================

DO $$ BEGIN
    -- Add software_name column (Drizzle expects this, DB has software)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'software_name') THEN
        ALTER TABLE software_updates ADD COLUMN software_name varchar;
        -- Copy data from software column if it exists
        UPDATE software_updates SET software_name = software WHERE software IS NOT NULL;
    END IF;

    -- Add is_critical column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'is_critical') THEN
        ALTER TABLE software_updates ADD COLUMN is_critical boolean DEFAULT false;
    END IF;

    -- Add download_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'download_url') THEN
        ALTER TABLE software_updates ADD COLUMN download_url varchar;
    END IF;

    -- Add installation_time column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'installation_time') THEN
        ALTER TABLE software_updates ADD COLUMN installation_time varchar;
    END IF;

    -- Add videographer_benefits column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'videographer_benefits') THEN
        ALTER TABLE software_updates ADD COLUMN videographer_benefits jsonb;
    END IF;

    -- Add music_producer_benefits column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'music_producer_benefits') THEN
        ALTER TABLE software_updates ADD COLUMN music_producer_benefits jsonb;
    END IF;

    -- Add general_improvements column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'general_improvements') THEN
        ALTER TABLE software_updates ADD COLUMN general_improvements jsonb;
    END IF;

    -- Add requirements column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'requirements') THEN
        ALTER TABLE software_updates ADD COLUMN requirements jsonb;
    END IF;

    -- Add compatibility column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'compatibility') THEN
        ALTER TABLE software_updates ADD COLUMN compatibility jsonb;
    END IF;

    -- Add known_issues column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'known_issues') THEN
        ALTER TABLE software_updates ADD COLUMN known_issues jsonb;
    END IF;

    -- Add installation_steps column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'installation_steps') THEN
        ALTER TABLE software_updates ADD COLUMN installation_steps jsonb;
    END IF;

    -- Add rollback_instructions column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'rollback_instructions') THEN
        ALTER TABLE software_updates ADD COLUMN rollback_instructions jsonb;
    END IF;

    -- Add videographer_recommendation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'videographer_recommendation') THEN
        ALTER TABLE software_updates ADD COLUMN videographer_recommendation varchar;
    END IF;

    -- Add music_producer_recommendation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'music_producer_recommendation') THEN
        ALTER TABLE software_updates ADD COLUMN music_producer_recommendation varchar;
    END IF;

    -- Add risk_level column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'risk_level') THEN
        ALTER TABLE software_updates ADD COLUMN risk_level varchar;
    END IF;

    -- Add last_verified column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'last_verified') THEN
        ALTER TABLE software_updates ADD COLUMN last_verified timestamp;
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'software_updates' AND column_name = 'updated_at') THEN
        ALTER TABLE software_updates ADD COLUMN updated_at timestamp DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_equipment_category ON market_equipment(category);
CREATE INDEX IF NOT EXISTS idx_market_equipment_brand ON market_equipment(brand);
CREATE INDEX IF NOT EXISTS idx_software_database_category ON software_database(category);
CREATE INDEX IF NOT EXISTS idx_software_updates_is_latest ON software_updates(is_latest);
CREATE INDEX IF NOT EXISTS idx_software_updates_release_date ON software_updates(release_date);

