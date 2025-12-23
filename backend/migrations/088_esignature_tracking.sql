-- Migration: E-Signature Tracking Tables
-- Adds tables and columns for tracking Google Docs e-signatures across all document types
-- Created: 2024

-- Quote Signatures Table
CREATE TABLE IF NOT EXISTS quote_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_name VARCHAR(255) NOT NULL,
    signer_role VARCHAR(100),
    google_doc_id VARCHAR(255),
    google_doc_url TEXT,
    signed_at TIMESTAMP,
    signature_status VARCHAR(50) DEFAULT 'pending', -- pending, signed, rejected
    signature_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quote_signatures_quote_id ON quote_signatures(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_signatures_signer_email ON quote_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_quote_signatures_status ON quote_signatures(signature_status);

-- Wedding Timeline Contracts Table
CREATE TABLE IF NOT EXISTS wedding_timeline_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timeline_id VARCHAR(255) NOT NULL,
    google_doc_id VARCHAR(255),
    google_doc_url TEXT,
    contract_status VARCHAR(50) DEFAULT 'pending', -- pending, signed, rejected
    client_signed_at TIMESTAMP,
    photographer_signed_at TIMESTAMP,
    signature_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wedding_timeline_contracts_timeline_id ON wedding_timeline_contracts(timeline_id);
CREATE INDEX IF NOT EXISTS idx_wedding_timeline_contracts_status ON wedding_timeline_contracts(contract_status);

-- Photo Enhancement Contract Signatures Table
CREATE TABLE IF NOT EXISTS enhancement_contract_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    user_id UUID NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_name VARCHAR(255) NOT NULL,
    google_doc_id VARCHAR(255),
    google_doc_url TEXT,
    signed_at TIMESTAMP,
    signature_status VARCHAR(50) DEFAULT 'pending', -- pending, signed, rejected
    signature_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enhancement_contract_signatures_job_id ON enhancement_contract_signatures(job_id);
CREATE INDEX IF NOT EXISTS idx_enhancement_contract_signatures_user_id ON enhancement_contract_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_enhancement_contract_signatures_status ON enhancement_contract_signatures(signature_status);

-- Add e-signature columns to quotes table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quotes' AND column_name = 'google_doc_id'
    ) THEN
        ALTER TABLE quotes ADD COLUMN google_doc_id VARCHAR(255);
        ALTER TABLE quotes ADD COLUMN google_doc_url TEXT;
        ALTER TABLE quotes ADD COLUMN signature_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;

-- Add e-signature columns to wedding_timelines table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'wedding_timelines' AND column_name = 'google_doc_id'
    ) THEN
        ALTER TABLE wedding_timelines ADD COLUMN google_doc_id VARCHAR(255);
        ALTER TABLE wedding_timelines ADD COLUMN google_doc_url TEXT;
        ALTER TABLE wedding_timelines ADD COLUMN contract_signature_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;

-- Add e-signature columns to split_sheet_invoices table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'split_sheet_invoices' AND column_name = 'google_doc_id'
    ) THEN
        ALTER TABLE split_sheet_invoices ADD COLUMN google_doc_id VARCHAR(255);
        ALTER TABLE split_sheet_invoices ADD COLUMN google_doc_url TEXT;
        ALTER TABLE split_sheet_invoices ADD COLUMN signature_status VARCHAR(50) DEFAULT 'pending';
        ALTER TABLE split_sheet_invoices ADD COLUMN require_signature BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add e-signature columns to photo enhancement jobs table (if exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'enhancement_jobs'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'enhancement_jobs' AND column_name = 'contract_signed'
        ) THEN
            ALTER TABLE enhancement_jobs ADD COLUMN contract_signed BOOLEAN DEFAULT FALSE;
            ALTER TABLE enhancement_jobs ADD COLUMN contract_google_doc_id VARCHAR(255);
            ALTER TABLE enhancement_jobs ADD COLUMN contract_google_doc_url TEXT;
        END IF;
    END IF;
END $$;

-- Add e-signature columns to contracts table (if not exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'contracts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'contracts' AND column_name = 'google_doc_id'
        ) THEN
            ALTER TABLE contracts ADD COLUMN google_doc_id VARCHAR(255);
            ALTER TABLE contracts ADD COLUMN google_doc_url TEXT;
            ALTER TABLE contracts ADD COLUMN signature_status VARCHAR(50) DEFAULT 'pending';
        END IF;
    END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_quote_signatures_updated_at ON quote_signatures;
CREATE TRIGGER update_quote_signatures_updated_at
    BEFORE UPDATE ON quote_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wedding_timeline_contracts_updated_at ON wedding_timeline_contracts;
CREATE TRIGGER update_wedding_timeline_contracts_updated_at
    BEFORE UPDATE ON wedding_timeline_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_enhancement_contract_signatures_updated_at ON enhancement_contract_signatures;
CREATE TRIGGER update_enhancement_contract_signatures_updated_at
    BEFORE UPDATE ON enhancement_contract_signatures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE quote_signatures IS 'Tracks e-signatures for quotes/proposals';
COMMENT ON TABLE wedding_timeline_contracts IS 'Tracks e-signatures for wedding timeline contracts';
COMMENT ON TABLE enhancement_contract_signatures IS 'Tracks e-signatures for photo enhancement service contracts';

COMMENT ON COLUMN quote_signatures.signature_status IS 'Status: pending, signed, rejected';
COMMENT ON COLUMN wedding_timeline_contracts.contract_status IS 'Status: pending, signed, rejected';
COMMENT ON COLUMN enhancement_contract_signatures.signature_status IS 'Status: pending, signed, rejected';























