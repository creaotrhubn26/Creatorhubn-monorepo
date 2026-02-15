-- Add metadata column to casting_scenes if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'casting_scenes' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE casting_scenes ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;
