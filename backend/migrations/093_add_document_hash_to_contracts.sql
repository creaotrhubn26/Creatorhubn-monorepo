-- Add document_hash column to contracts table for tamper detection
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS document_hash VARCHAR(64);

-- Add index for faster hash lookups
CREATE INDEX IF NOT EXISTS contracts_document_hash_idx ON contracts(document_hash);

-- Add comment for documentation
COMMENT ON COLUMN contracts.document_hash IS 'SHA-256 hash of contract content for tamper detection and verification';
