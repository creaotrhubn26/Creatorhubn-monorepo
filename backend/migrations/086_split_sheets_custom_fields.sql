-- ============================================================================
-- SPLIT SHEETS CUSTOM FIELDS & ENHANCED ROLES MIGRATION
-- ============================================================================
-- Adds custom fields support and additional contributor roles
-- ============================================================================

-- Add custom_fields JSONB column to split_sheet_contributors
ALTER TABLE split_sheet_contributors
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_split_sheet_contributors_custom_fields 
ON split_sheet_contributors USING GIN (custom_fields);

-- Expand contributor roles to include more options
-- First, drop the existing check constraint
ALTER TABLE split_sheet_contributors
DROP CONSTRAINT IF EXISTS split_sheet_contributors_role_check;

-- Add new check constraint with expanded roles
ALTER TABLE split_sheet_contributors
ADD CONSTRAINT split_sheet_contributors_role_check 
CHECK (role IN (
  'producer',
  'artist',
  'songwriter',
  'composer',
  'lyricist',
  'vocalist',
  'instrumentalist',
  'mix_engineer',
  'mastering_engineer',
  'arranger',
  'featured_artist',
  'backing_vocalist',
  'session_musician',
  'collaborator',
  'publisher',
  'label',
  'other'
));

-- Add validation function for percentage calculations
CREATE OR REPLACE FUNCTION validate_split_sheet_percentages()
RETURNS TRIGGER AS $$
DECLARE
  total_perc DECIMAL(5,2);
  sheet_id UUID;
BEGIN
  -- Get the split_sheet_id
  sheet_id := COALESCE(NEW.split_sheet_id, OLD.split_sheet_id);
  
  -- Calculate total percentage
  SELECT COALESCE(SUM(percentage), 0) INTO total_perc
  FROM split_sheet_contributors
  WHERE split_sheet_id = sheet_id;
  
  -- Update total_percentage in split_sheets
  UPDATE split_sheets
  SET total_percentage = total_perc
  WHERE id = sheet_id;
  
  -- Validate that total doesn't exceed 100%
  IF total_perc > 100.01 THEN
    RAISE EXCEPTION 'Total percentage cannot exceed 100%%. Current total: %%%', total_perc;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Replace the existing trigger with the enhanced validation
DROP TRIGGER IF EXISTS update_split_sheet_total_percentage ON split_sheet_contributors;
CREATE TRIGGER update_split_sheet_total_percentage
  AFTER INSERT OR UPDATE OR DELETE ON split_sheet_contributors
  FOR EACH ROW 
  EXECUTE FUNCTION validate_split_sheet_percentages();

-- Add function to check and fix percentage calculations
CREATE OR REPLACE FUNCTION check_split_sheet_percentages(sheet_uuid UUID)
RETURNS TABLE(
  is_valid BOOLEAN,
  total_percentage DECIMAL(5,2),
  expected_total DECIMAL(5,2),
  difference DECIMAL(5,2),
  message TEXT
) AS $$
DECLARE
  total_perc DECIMAL(5,2);
  expected_total DECIMAL(5,2) := 100.00;
BEGIN
  -- Calculate current total
  SELECT COALESCE(SUM(percentage), 0) INTO total_perc
  FROM split_sheet_contributors
  WHERE split_sheet_id = sheet_uuid;
  
  -- Return validation result
  RETURN QUERY SELECT
    (ABS(total_perc - expected_total) < 0.01)::BOOLEAN as is_valid,
    total_perc as total_percentage,
    expected_total,
    (total_perc - expected_total) as difference,
    CASE
      WHEN ABS(total_perc - expected_total) < 0.01 THEN 'Percentages are valid (total = 100%)'
      WHEN total_perc > 100.01 THEN 'ERROR: Total percentage exceeds 100%'
      WHEN total_perc < 99.99 THEN 'WARNING: Total percentage is less than 100%'
      ELSE 'Percentages need adjustment'
    END as message;
END;
$$ LANGUAGE plpgsql;

-- Add helper function to auto-adjust percentages to 100%
CREATE OR REPLACE FUNCTION auto_adjust_percentages_to_100(sheet_uuid UUID)
RETURNS TABLE(
  adjusted_count INTEGER,
  message TEXT
) AS $$
DECLARE
  total_perc DECIMAL(5,2);
  adjustment_factor DECIMAL(10,6);
  adjusted INTEGER := 0;
BEGIN
  -- Calculate current total
  SELECT COALESCE(SUM(percentage), 0) INTO total_perc
  FROM split_sheet_contributors
  WHERE split_sheet_id = sheet_uuid;
  
  -- Only adjust if total is not zero and not already 100%
  IF total_perc > 0 AND ABS(total_perc - 100.00) >= 0.01 THEN
    -- Calculate adjustment factor
    adjustment_factor := 100.00 / total_perc;
    
    -- Update all percentages proportionally
    UPDATE split_sheet_contributors
    SET percentage = ROUND((percentage * adjustment_factor)::NUMERIC, 2)
    WHERE split_sheet_id = sheet_uuid;
    
    GET DIAGNOSTICS adjusted = ROW_COUNT;
    
    -- Update total_percentage in split_sheets
    UPDATE split_sheets
    SET total_percentage = 100.00
    WHERE id = sheet_uuid;
  END IF;
  
  RETURN QUERY SELECT
    adjusted,
    CASE
      WHEN adjusted > 0 THEN format('Adjusted %s contributor(s) to total 100%%', adjusted)
      WHEN total_perc = 0 THEN 'No contributors to adjust'
      ELSE 'Percentages already total 100%'
    END as message;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the custom_fields column
COMMENT ON COLUMN split_sheet_contributors.custom_fields IS 
'JSONB field for storing custom contributor fields like phone, address, PRO affiliation, IPI number, etc.';























