-- Add new fields to contracts table for branding and business information
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS contract_title VARCHAR(500),
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'private',
ADD COLUMN IF NOT EXISTS organization_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100);

-- Add index for faster lookups by organization number
CREATE INDEX IF NOT EXISTS contracts_organization_number_idx ON contracts(organization_number);

-- Add comment for documentation
COMMENT ON COLUMN contracts.contract_title IS 'Custom title for the contract';
COMMENT ON COLUMN contracts.logo_url IS 'Logo image URL or base64 data';
COMMENT ON COLUMN contracts.customer_type IS 'Type of customer: private or business';
COMMENT ON COLUMN contracts.organization_number IS 'Norwegian organization number (9 digits)';
COMMENT ON COLUMN contracts.organization_name IS 'Official business name from Brreg';
COMMENT ON COLUMN contracts.business_address IS 'Business address from Brreg';
COMMENT ON COLUMN contracts.contract_type IS 'Type of contract: wedding_photography, portrait_photography, etc';
