-- Add businessType and profession columns to fiken_integrations
-- These fields enable automatic Norwegian account code mapping for invoices

-- Add businessType column (ENK, AS, ANS, DA, NUF, etc.)
ALTER TABLE fiken_integrations 
ADD COLUMN IF NOT EXISTS business_type VARCHAR(50);

-- Add profession column (photographer, videographer, music_producer, vendor)
ALTER TABLE fiken_integrations 
ADD COLUMN IF NOT EXISTS profession VARCHAR(100);

-- Add index for fast lookups by business type
CREATE INDEX IF NOT EXISTS idx_fiken_integrations_business_type 
  ON fiken_integrations(business_type);

-- Add index for fast lookups by profession
CREATE INDEX IF NOT EXISTS idx_fiken_integrations_profession 
  ON fiken_integrations(profession);

-- Comments for documentation
COMMENT ON COLUMN fiken_integrations.business_type IS 'Norwegian business legal form (ENK, AS, ANS, DA, NUF, etc.) from BRREG';
COMMENT ON COLUMN fiken_integrations.profession IS 'User profession for account code mapping (photographer, videographer, music_producer, vendor)';
