-- Create photo_presets table for Lightroom-style presets
CREATE TABLE IF NOT EXISTS photo_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  preview_image_url TEXT,
  
  -- Preset adjustments (Lightroom-style)
  adjustments JSONB,
  
  -- Tone curve adjustments
  tone_curves JSONB,
  
  -- HSL adjustments
  hsl_adjustments JSONB,
  
  -- Transform adjustments
  transform JSONB,
  
  -- Masks (for selective adjustments)
  masks JSONB,
  
  -- Metadata
  is_favorite BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_photo_presets_user_id ON photo_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_presets_category ON photo_presets(category);
CREATE INDEX IF NOT EXISTS idx_photo_presets_is_favorite ON photo_presets(is_favorite);

-- Add some default presets for common use cases
INSERT INTO photo_presets (user_id, name, category, description, adjustments, is_favorite) VALUES
  ('00000000-0000-0000-0000-000000000000', 'Portrait - Soft', 'Portrait', 'Soft, flattering portrait preset with reduced clarity and warm tones', 
   '{"exposure": 0.2, "contrast": -10, "highlights": -20, "shadows": 15, "clarity": -15, "vibrance": 5, "saturation": -5}'::jsonb, true),
  ('00000000-0000-0000-0000-000000000000', 'Landscape - Vibrant', 'Landscape', 'Vibrant landscape preset with enhanced colors and clarity', 
   '{"exposure": 0.1, "contrast": 15, "highlights": -10, "shadows": 20, "clarity": 25, "vibrance": 20, "saturation": 10}'::jsonb, true),
  ('00000000-0000-0000-0000-000000000000', 'Wedding - Classic', 'Wedding', 'Classic wedding preset with soft, romantic tones', 
   '{"exposure": 0.15, "contrast": 5, "highlights": -15, "shadows": 10, "clarity": -5, "vibrance": 8, "saturation": -3}'::jsonb, true),
  ('00000000-0000-0000-0000-000000000000', 'Commercial - Clean', 'Commercial', 'Clean, professional commercial preset', 
   '{"exposure": 0, "contrast": 20, "highlights": -5, "shadows": 10, "clarity": 15, "vibrance": 5, "saturation": 0}'::jsonb, true),
  ('00000000-0000-0000-0000-000000000000', 'Vintage - Film', 'Vintage', 'Vintage film look with desaturated colors and faded blacks', 
   '{"exposure": 0.1, "contrast": -5, "highlights": -25, "shadows": 5, "blacks": -10, "clarity": -10, "vibrance": -15, "saturation": -20}'::jsonb, false),
  ('00000000-0000-0000-0000-000000000000', 'Cinematic - Moody', 'Cinematic', 'Moody cinematic preset with dark shadows and rich tones', 
   '{"exposure": -0.2, "contrast": 25, "highlights": -30, "shadows": -10, "blacks": -15, "clarity": 10, "vibrance": 15, "saturation": 5}'::jsonb, false)
ON CONFLICT DO NOTHING;

