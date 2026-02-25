-- ═══════════════════════════════════════════════════════════════════
-- 098: Firmware Management System — Full Schema
-- ═══════════════════════════════════════════════════════════════════
-- Adds:
--   1. firmware_catalog — canonical firmware versions per manufacturer+model
--   2. firmware_match_results — per-equipment evaluation cache
--   3. Firmware tracking columns on user_equipment (firmware_current, etc.)
--   4. Indexes + upsert helper function
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Firmware Catalog ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS firmware_catalog (
    id SERIAL PRIMARY KEY,
    manufacturer VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL,
    release_date DATE,
    download_url TEXT,
    release_notes_url TEXT,
    checksum VARCHAR(128),
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('api', 'scrape', 'manual', 'builtin')),
    source_url TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT,
    importance VARCHAR(20) DEFAULT 'optional'
        CHECK (importance IN ('critical', 'important', 'recommended', 'optional')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (manufacturer, model, version)
);

CREATE INDEX IF NOT EXISTS idx_firmware_catalog_mfr_model
    ON firmware_catalog (LOWER(manufacturer), LOWER(model));

-- ── 2. Firmware Match Results ────────────────────────────────────

CREATE TABLE IF NOT EXISTS firmware_match_results (
    id SERIAL PRIMARY KEY,
    equipment_id VARCHAR(100) NOT NULL,
    latest_version VARCHAR(50),
    is_update_available BOOLEAN DEFAULT FALSE,
    severity VARCHAR(20) DEFAULT 'optional'
        CHECK (severity IN ('critical', 'important', 'recommended', 'optional')),
    download_url TEXT,
    release_notes_url TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    catalog_entry_id INTEGER REFERENCES firmware_catalog(id) ON DELETE SET NULL,

    UNIQUE (equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_firmware_match_equipment
    ON firmware_match_results (equipment_id);

-- ── 3. Add firmware tracking columns to user_equipment ───────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_equipment' AND column_name = 'firmware_current') THEN
        ALTER TABLE user_equipment ADD COLUMN firmware_current VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_equipment' AND column_name = 'firmware_track_key') THEN
        ALTER TABLE user_equipment ADD COLUMN firmware_track_key VARCHAR(200);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_equipment' AND column_name = 'firmware_auto_check_enabled') THEN
        ALTER TABLE user_equipment ADD COLUMN firmware_auto_check_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- ── 4. Upsert function for catalog entries ───────────────────────

CREATE OR REPLACE FUNCTION upsert_firmware_catalog(
    p_manufacturer VARCHAR,
    p_model VARCHAR,
    p_version VARCHAR,
    p_release_date DATE DEFAULT NULL,
    p_download_url TEXT DEFAULT NULL,
    p_release_notes_url TEXT DEFAULT NULL,
    p_checksum VARCHAR DEFAULT NULL,
    p_source_type VARCHAR DEFAULT 'manual',
    p_source_url TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_importance VARCHAR DEFAULT 'optional'
) RETURNS firmware_catalog AS $$
DECLARE
    result firmware_catalog;
BEGIN
    INSERT INTO firmware_catalog (
        manufacturer, model, version, release_date,
        download_url, release_notes_url, checksum,
        source_type, source_url, description, importance,
        fetched_at, updated_at
    ) VALUES (
        p_manufacturer, p_model, p_version, p_release_date,
        p_download_url, p_release_notes_url, p_checksum,
        p_source_type, p_source_url, p_description, p_importance,
        NOW(), NOW()
    )
    ON CONFLICT (manufacturer, model, version)
    DO UPDATE SET
        release_date = COALESCE(EXCLUDED.release_date, firmware_catalog.release_date),
        download_url = COALESCE(EXCLUDED.download_url, firmware_catalog.download_url),
        release_notes_url = COALESCE(EXCLUDED.release_notes_url, firmware_catalog.release_notes_url),
        checksum = COALESCE(EXCLUDED.checksum, firmware_catalog.checksum),
        source_type = EXCLUDED.source_type,
        source_url = COALESCE(EXCLUDED.source_url, firmware_catalog.source_url),
        description = COALESCE(EXCLUDED.description, firmware_catalog.description),
        importance = EXCLUDED.importance,
        fetched_at = NOW(),
        updated_at = NOW()
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;
