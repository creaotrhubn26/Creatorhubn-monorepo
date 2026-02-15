-- Migration script to add missing columns to split_sheets table
-- Run this to update the database schema

-- Add missing columns to split_sheets table
ALTER TABLE split_sheets 
ADD COLUMN IF NOT EXISTS songflow_project_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS songflow_track_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add FOREIGN KEY constraint to split_sheet_contributors if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'split_sheet_contributors_split_sheet_id_fkey'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE split_sheet_contributors
        ADD CONSTRAINT split_sheet_contributors_split_sheet_id_fkey 
        FOREIGN KEY (split_sheet_id) 
        REFERENCES split_sheets(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add missing indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_project_id ON split_sheets(songflow_project_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_songflow_track_id ON split_sheets(songflow_track_id);
CREATE INDEX IF NOT EXISTS idx_split_sheets_status ON split_sheets(status);
CREATE INDEX IF NOT EXISTS idx_split_sheets_updated_at ON split_sheets(updated_at);

CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_split_sheet_id ON split_sheet_contributors(split_sheet_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_email ON split_sheet_contributors(email);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_user_id ON split_sheet_contributors(user_id);
CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_order_index ON split_sheet_contributors(split_sheet_id, order_index);





