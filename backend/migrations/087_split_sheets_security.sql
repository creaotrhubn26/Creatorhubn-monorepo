-- ============================================================================
-- SPLIT SHEETS SECURITY MIGRATION
-- ============================================================================
-- Adds PIN/password protection for split sheet client portal access
-- Similar to wedding timeline security implementation
-- ============================================================================

-- Add security columns to split_sheets table
ALTER TABLE split_sheets
ADD COLUMN IF NOT EXISTS access_code VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS pin VARCHAR(255), -- Hashed PIN (4 digits)
ADD COLUMN IF NOT EXISTS password VARCHAR(255), -- Hashed password
ADD COLUMN IF NOT EXISTS security_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS require_pin_for_signature BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS require_password_for_signature BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_split_sheets_access_code ON split_sheets(access_code);
CREATE INDEX IF NOT EXISTS idx_split_sheets_security_enabled ON split_sheets(security_enabled);

-- Add security columns to split_sheet_contributors for individual contributor security
ALTER TABLE split_sheet_contributors
ADD COLUMN IF NOT EXISTS contributor_pin VARCHAR(255), -- Individual PIN for this contributor
ADD COLUMN IF NOT EXISTS contributor_password VARCHAR(255); -- Individual password for this contributor

-- Function to generate access code
CREATE OR REPLACE FUNCTION generate_split_sheet_access_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  code VARCHAR(50);
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate random alphanumeric code (similar to wedding timeline)
    code := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 3) ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 3) ||
      SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 3)
    );
    
    -- Check if code already exists
    SELECT COUNT(*) INTO exists_check
    FROM split_sheets
    WHERE access_code = code;
    
    -- Exit loop if code is unique
    EXIT WHEN exists_check = 0;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to hash PIN/password (for use in application layer)
-- Note: Actual hashing should be done in application code using bcrypt
-- This is just a placeholder function
COMMENT ON COLUMN split_sheets.pin IS 'Hashed PIN (4 digits) - use bcrypt in application';
COMMENT ON COLUMN split_sheets.password IS 'Hashed password - use bcrypt in application';
COMMENT ON COLUMN split_sheet_contributors.contributor_pin IS 'Individual contributor PIN (hashed)';
COMMENT ON COLUMN split_sheet_contributors.contributor_password IS 'Individual contributor password (hashed)';























