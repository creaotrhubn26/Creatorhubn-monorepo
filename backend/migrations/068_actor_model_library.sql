-- Actor Model Library
-- Stores pre-generated 3D human actor models for Virtual Studio

-- Actor presets table (definitions)
CREATE TABLE IF NOT EXISTS vs_actor_presets (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    age INTEGER NOT NULL,
    gender DECIMAL(3,2) NOT NULL, -- 0=female, 0.5=neutral, 1=male
    height DECIMAL(3,2) NOT NULL, -- 0-1 normalized
    weight DECIMAL(3,2) NOT NULL, -- 0-1 normalized
    muscle DECIMAL(3,2) NOT NULL, -- 0-1 normalized
    tags TEXT[], -- searchable tags
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cached actor models table (generated mesh data)
CREATE TABLE IF NOT EXISTS vs_actor_cache (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    preset_id VARCHAR(100) REFERENCES vs_actor_presets(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    -- Parameters
    age INTEGER NOT NULL,
    gender DECIMAL(3,2) NOT NULL,
    height DECIMAL(3,2) NOT NULL,
    weight DECIMAL(3,2) NOT NULL,
    muscle DECIMAL(3,2) NOT NULL,
    -- Mesh data (stored as JSON for flexibility)
    mesh_data JSONB NOT NULL,
    num_vertices INTEGER NOT NULL,
    num_faces INTEGER NOT NULL,
    -- Appearance
    skin_tone VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- Metadata
    model_version VARCHAR(50) NOT NULL DEFAULT 'anny-0.2.0',
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vs_actor_presets_category ON vs_actor_presets(category);
CREATE INDEX IF NOT EXISTS idx_vs_actor_cache_user ON vs_actor_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_vs_actor_cache_preset ON vs_actor_cache(preset_id);
CREATE INDEX IF NOT EXISTS idx_vs_actor_cache_category ON vs_actor_cache(category);

-- Insert 80+ actor presets
INSERT INTO vs_actor_presets (id, name, description, category, age, gender, height, weight, muscle, tags) VALUES
-- ============================================================================
-- PORTRAIT PHOTOGRAPHY (15 presets)
-- ============================================================================
('portrait-female-young', 'Young Female Model', 'Fashion/portrait model, 20s, average height', 'portrait', 25, 0.0, 0.55, 0.35, 0.3, ARRAY['young', 'female', 'slim', 'fashion']),
('portrait-male-young', 'Young Male Model', 'Fashion/portrait model, 20s, tall', 'portrait', 27, 1.0, 0.65, 0.45, 0.5, ARRAY['young', 'male', 'tall', 'fashion']),
('portrait-mature-female', 'Mature Female', 'Professional woman, 40s', 'portrait', 45, 0.0, 0.5, 0.5, 0.3, ARRAY['mature', 'female', 'professional']),
('portrait-mature-male', 'Mature Male', 'Professional man, 40s', 'portrait', 48, 1.0, 0.58, 0.55, 0.4, ARRAY['mature', 'male', 'professional']),
('portrait-female-30s', 'Female 30s', 'Woman in her thirties', 'portrait', 32, 0.0, 0.52, 0.45, 0.35, ARRAY['female', 'thirties']),
('portrait-male-30s', 'Male 30s', 'Man in his thirties', 'portrait', 34, 1.0, 0.6, 0.5, 0.45, ARRAY['male', 'thirties']),
('portrait-female-50s', 'Female 50s', 'Woman in her fifties', 'portrait', 52, 0.0, 0.48, 0.52, 0.28, ARRAY['female', 'fifties', 'mature']),
('portrait-male-50s', 'Male 50s', 'Man in his fifties', 'portrait', 55, 1.0, 0.56, 0.58, 0.35, ARRAY['male', 'fifties', 'mature']),
('diverse-petite-female', 'Petite Female', 'Small frame, delicate build', 'portrait', 26, 0.0, 0.35, 0.35, 0.25, ARRAY['petite', 'female', 'small']),
('diverse-tall-female', 'Tall Female', 'Tall, elegant build', 'portrait', 29, 0.0, 0.72, 0.45, 0.35, ARRAY['tall', 'female', 'elegant']),
('diverse-curvy-female', 'Curvy Female', 'Full-figured, curvy build', 'portrait', 32, 0.0, 0.5, 0.7, 0.3, ARRAY['curvy', 'female', 'full-figured']),
('diverse-stocky-male', 'Stocky Male', 'Broad, stocky build', 'portrait', 35, 1.0, 0.52, 0.72, 0.55, ARRAY['stocky', 'male', 'broad']),
('diverse-lean-male', 'Lean Male', 'Tall and lean build', 'portrait', 28, 1.0, 0.68, 0.38, 0.4, ARRAY['lean', 'male', 'tall']),
('diverse-athletic-androgynous', 'Androgynous Athletic', 'Gender-neutral athletic build', 'portrait', 24, 0.5, 0.55, 0.42, 0.5, ARRAY['androgynous', 'athletic', 'neutral']),
('portrait-artistic-musician', 'Musician', 'Casual artistic appearance', 'portrait', 28, 0.5, 0.55, 0.48, 0.35, ARRAY['artistic', 'musician', 'casual']),

-- ============================================================================
-- FASHION PHOTOGRAPHY (12 presets)
-- ============================================================================
('fashion-runway-female', 'Runway Model (Female)', 'High fashion runway model, tall and slim', 'fashion', 22, 0.0, 0.7, 0.25, 0.25, ARRAY['runway', 'female', 'tall', 'slim', 'high-fashion']),
('fashion-runway-male', 'Runway Model (Male)', 'High fashion runway model, tall and lean', 'fashion', 24, 1.0, 0.75, 0.35, 0.45, ARRAY['runway', 'male', 'tall', 'lean', 'high-fashion']),
('fashion-plus-size', 'Plus-Size Model', 'Plus-size fashion model', 'fashion', 28, 0.0, 0.55, 0.75, 0.35, ARRAY['plus-size', 'female', 'curvy']),
('fashion-catalog-female', 'Catalog Model (Female)', 'Commercial fashion model', 'fashion', 26, 0.0, 0.58, 0.4, 0.3, ARRAY['catalog', 'female', 'commercial']),
('fashion-catalog-male', 'Catalog Model (Male)', 'Commercial fashion model', 'fashion', 28, 1.0, 0.62, 0.48, 0.45, ARRAY['catalog', 'male', 'commercial']),
('fashion-streetwear-female', 'Streetwear Model (Female)', 'Urban streetwear model', 'fashion', 23, 0.0, 0.52, 0.38, 0.35, ARRAY['streetwear', 'female', 'urban']),
('fashion-streetwear-male', 'Streetwear Model (Male)', 'Urban streetwear model', 'fashion', 25, 1.0, 0.58, 0.45, 0.5, ARRAY['streetwear', 'male', 'urban']),
('fashion-editorial-female', 'Editorial Model (Female)', 'High fashion editorial', 'fashion', 21, 0.0, 0.68, 0.28, 0.28, ARRAY['editorial', 'female', 'high-fashion']),
('fashion-editorial-male', 'Editorial Model (Male)', 'High fashion editorial', 'fashion', 23, 1.0, 0.72, 0.38, 0.48, ARRAY['editorial', 'male', 'high-fashion']),
('fashion-lingerie-female', 'Lingerie Model', 'Lingerie/swimwear model', 'fashion', 25, 0.0, 0.6, 0.35, 0.4, ARRAY['lingerie', 'female', 'swimwear']),
('fashion-fitness-male', 'Fitness Fashion Model', 'Athletic wear model', 'fashion', 27, 1.0, 0.65, 0.5, 0.7, ARRAY['fitness', 'male', 'athletic-wear']),
('fashion-mature-female', 'Mature Fashion Model', 'Elegant mature model', 'fashion', 50, 0.0, 0.55, 0.45, 0.28, ARRAY['mature', 'female', 'elegant']),

-- ============================================================================
-- COMMERCIAL/BUSINESS (12 presets)
-- ============================================================================
('commercial-average-female', 'Average Female', 'Typical consumer, relatable', 'commercial', 35, 0.0, 0.48, 0.55, 0.35, ARRAY['average', 'female', 'consumer', 'relatable']),
('commercial-average-male', 'Average Male', 'Typical consumer, relatable', 'commercial', 38, 1.0, 0.55, 0.6, 0.4, ARRAY['average', 'male', 'consumer', 'relatable']),
('business-executive-female', 'Female Executive', 'Professional businesswoman', 'commercial', 42, 0.0, 0.52, 0.48, 0.3, ARRAY['executive', 'female', 'professional', 'business']),
('business-executive-male', 'Male Executive', 'Professional businessman', 'commercial', 50, 1.0, 0.6, 0.58, 0.35, ARRAY['executive', 'male', 'professional', 'business']),
('business-young-professional-female', 'Young Professional Female', 'Early career professional', 'commercial', 28, 0.0, 0.5, 0.45, 0.35, ARRAY['young', 'female', 'professional']),
('business-young-professional-male', 'Young Professional Male', 'Early career professional', 'commercial', 30, 1.0, 0.58, 0.5, 0.45, ARRAY['young', 'male', 'professional']),
('medical-doctor-female', 'Female Doctor', 'Healthcare professional', 'commercial', 38, 0.0, 0.52, 0.5, 0.32, ARRAY['medical', 'female', 'doctor', 'healthcare']),
('medical-nurse-male', 'Male Nurse', 'Healthcare professional', 'commercial', 32, 1.0, 0.58, 0.52, 0.4, ARRAY['medical', 'male', 'nurse', 'healthcare']),
('commercial-teacher-female', 'Female Teacher', 'Educator, approachable', 'commercial', 35, 0.0, 0.5, 0.5, 0.3, ARRAY['teacher', 'female', 'education']),
('commercial-teacher-male', 'Male Teacher', 'Educator, approachable', 'commercial', 40, 1.0, 0.56, 0.55, 0.38, ARRAY['teacher', 'male', 'education']),
('commercial-service-worker', 'Service Worker', 'Retail/hospitality worker', 'commercial', 28, 0.5, 0.52, 0.48, 0.35, ARRAY['service', 'retail', 'hospitality']),
('commercial-tech-worker', 'Tech Worker', 'Office/tech professional', 'commercial', 30, 0.5, 0.55, 0.45, 0.35, ARRAY['tech', 'office', 'professional']),

-- ============================================================================
-- FITNESS/SPORTS (15 presets)
-- ============================================================================
('fitness-female-athletic', 'Athletic Female', 'Fitness model, toned', 'fitness', 28, 0.0, 0.52, 0.45, 0.75, ARRAY['athletic', 'female', 'toned', 'fitness']),
('fitness-male-bodybuilder', 'Male Bodybuilder', 'Muscular fitness model', 'fitness', 30, 1.0, 0.6, 0.7, 0.95, ARRAY['bodybuilder', 'male', 'muscular']),
('sports-swimmer-female', 'Female Swimmer', 'Lean swimmer build', 'fitness', 22, 0.0, 0.58, 0.4, 0.7, ARRAY['swimmer', 'female', 'lean', 'athletic']),
('sports-swimmer-male', 'Male Swimmer', 'Lean swimmer build', 'fitness', 24, 1.0, 0.65, 0.45, 0.72, ARRAY['swimmer', 'male', 'lean', 'athletic']),
('sports-basketball-male', 'Male Basketball Player', 'Tall athletic build', 'fitness', 25, 1.0, 0.85, 0.55, 0.65, ARRAY['basketball', 'male', 'tall', 'athletic']),
('sports-basketball-female', 'Female Basketball Player', 'Tall athletic build', 'fitness', 23, 0.0, 0.75, 0.48, 0.6, ARRAY['basketball', 'female', 'tall', 'athletic']),
('sports-gymnast-female', 'Female Gymnast', 'Compact muscular build', 'fitness', 20, 0.0, 0.38, 0.35, 0.8, ARRAY['gymnast', 'female', 'compact', 'muscular']),
('sports-gymnast-male', 'Male Gymnast', 'Compact muscular build', 'fitness', 22, 1.0, 0.5, 0.45, 0.85, ARRAY['gymnast', 'male', 'compact', 'muscular']),
('sports-runner-male', 'Male Marathon Runner', 'Lean endurance build', 'fitness', 28, 1.0, 0.55, 0.3, 0.55, ARRAY['runner', 'male', 'lean', 'endurance']),
('sports-runner-female', 'Female Marathon Runner', 'Lean endurance build', 'fitness', 26, 0.0, 0.5, 0.28, 0.52, ARRAY['runner', 'female', 'lean', 'endurance']),
('sports-weightlifter-female', 'Female Weightlifter', 'Powerlifter build', 'fitness', 26, 0.0, 0.5, 0.65, 0.85, ARRAY['weightlifter', 'female', 'powerlifter', 'strong']),
('sports-weightlifter-male', 'Male Weightlifter', 'Powerlifter build', 'fitness', 28, 1.0, 0.55, 0.75, 0.92, ARRAY['weightlifter', 'male', 'powerlifter', 'strong']),
('artistic-dancer-female', 'Female Dancer', 'Ballet/contemporary build', 'fitness', 24, 0.0, 0.52, 0.32, 0.6, ARRAY['dancer', 'female', 'ballet', 'graceful']),
('artistic-dancer-male', 'Male Dancer', 'Contemporary dancer build', 'fitness', 26, 1.0, 0.6, 0.4, 0.65, ARRAY['dancer', 'male', 'contemporary', 'graceful']),
('sports-yoga-female', 'Female Yoga Instructor', 'Flexible, lean build', 'fitness', 30, 0.0, 0.52, 0.38, 0.55, ARRAY['yoga', 'female', 'flexible', 'lean']),

-- ============================================================================
-- CHILDREN (12 presets)
-- ============================================================================
('child-infant', 'Infant (1 year)', 'Baby for family photography', 'child', 1, 0.5, 0.08, 0.25, 0.15, ARRAY['infant', 'baby', 'family']),
('child-toddler', 'Toddler (3 years)', 'Young child', 'child', 3, 0.5, 0.15, 0.3, 0.2, ARRAY['toddler', 'young', 'family']),
('child-preschool-female', 'Preschool Girl (5 years)', 'Preschool age girl', 'child', 5, 0.0, 0.2, 0.32, 0.22, ARRAY['preschool', 'female', 'young']),
('child-preschool-male', 'Preschool Boy (5 years)', 'Preschool age boy', 'child', 5, 1.0, 0.2, 0.33, 0.24, ARRAY['preschool', 'male', 'young']),
('child-school-age', 'School-Age Child (8 years)', 'Elementary school age', 'child', 8, 0.5, 0.25, 0.35, 0.25, ARRAY['school', 'elementary', 'child']),
('child-school-female', 'School Girl (10 years)', 'Elementary school girl', 'child', 10, 0.0, 0.32, 0.38, 0.28, ARRAY['school', 'female', 'elementary']),
('child-school-male', 'School Boy (10 years)', 'Elementary school boy', 'child', 10, 1.0, 0.33, 0.4, 0.3, ARRAY['school', 'male', 'elementary']),
('child-preteen-female', 'Preteen Girl (12 years)', 'Preteen girl', 'child', 12, 0.0, 0.4, 0.38, 0.28, ARRAY['preteen', 'female', 'tween']),
('child-preteen-male', 'Preteen Boy (12 years)', 'Preteen boy', 'child', 12, 1.0, 0.42, 0.4, 0.32, ARRAY['preteen', 'male', 'tween']),
('child-teen-female', 'Teen Female (15 years)', 'Teenage girl', 'child', 15, 0.0, 0.48, 0.4, 0.3, ARRAY['teen', 'female', 'teenager']),
('child-teen-male', 'Teen Male (16 years)', 'Teenage boy', 'child', 16, 1.0, 0.55, 0.45, 0.4, ARRAY['teen', 'male', 'teenager']),
('child-teen-athletic', 'Athletic Teen (17 years)', 'Athletic teenager', 'child', 17, 0.5, 0.58, 0.48, 0.55, ARRAY['teen', 'athletic', 'sports']),

-- ============================================================================
-- ELDERLY (10 presets)
-- ============================================================================
('elder-female-60s', 'Senior Female (60s)', 'Active senior woman', 'elder', 65, 0.0, 0.45, 0.55, 0.25, ARRAY['senior', 'female', 'sixties', 'active']),
('elder-male-60s', 'Senior Male (60s)', 'Active senior man', 'elder', 67, 1.0, 0.52, 0.6, 0.3, ARRAY['senior', 'male', 'sixties', 'active']),
('elder-female-70s', 'Senior Female (70s)', 'Senior woman in 70s', 'elder', 73, 0.0, 0.43, 0.52, 0.22, ARRAY['senior', 'female', 'seventies']),
('elder-male-70s', 'Senior Male (70s)', 'Senior man in 70s', 'elder', 75, 1.0, 0.5, 0.58, 0.28, ARRAY['senior', 'male', 'seventies']),
('elder-female-80s', 'Elderly Female (80s)', 'Elderly woman', 'elder', 82, 0.0, 0.4, 0.5, 0.2, ARRAY['elderly', 'female', 'eighties']),
('elder-male-80s', 'Elderly Male (80s)', 'Elderly man', 'elder', 85, 1.0, 0.48, 0.55, 0.25, ARRAY['elderly', 'male', 'eighties']),
('elder-active-female', 'Active Senior Female', 'Fit senior woman', 'elder', 68, 0.0, 0.48, 0.48, 0.35, ARRAY['senior', 'female', 'active', 'fit']),
('elder-active-male', 'Active Senior Male', 'Fit senior man', 'elder', 70, 1.0, 0.55, 0.52, 0.4, ARRAY['senior', 'male', 'active', 'fit']),
('elder-grandparent-female', 'Grandmother', 'Typical grandmother figure', 'elder', 72, 0.0, 0.42, 0.58, 0.2, ARRAY['grandparent', 'female', 'family']),
('elder-grandparent-male', 'Grandfather', 'Typical grandfather figure', 'elder', 74, 1.0, 0.5, 0.6, 0.28, ARRAY['grandparent', 'male', 'family']),

-- ============================================================================
-- SPECIAL CATEGORIES (8 presets)
-- ============================================================================
('maternity-early', 'Early Pregnancy (20 weeks)', 'Early pregnancy', 'portrait', 30, 0.0, 0.5, 0.55, 0.3, ARRAY['maternity', 'pregnancy', 'expecting']),
('maternity-mid', 'Mid Pregnancy (28 weeks)', 'Mid-pregnancy', 'portrait', 32, 0.0, 0.5, 0.62, 0.28, ARRAY['maternity', 'pregnancy', 'expecting']),
('maternity-late', 'Late Pregnancy (36 weeks)', 'Late pregnancy', 'portrait', 28, 0.0, 0.48, 0.7, 0.25, ARRAY['maternity', 'pregnancy', 'expecting']),
('special-petite-elder', 'Petite Senior', 'Small elderly person', 'elder', 78, 0.0, 0.35, 0.45, 0.18, ARRAY['petite', 'senior', 'elderly']),
('special-tall-elder', 'Tall Senior', 'Tall elderly man', 'elder', 72, 1.0, 0.65, 0.55, 0.3, ARRAY['tall', 'senior', 'elderly']),
('special-athletic-senior', 'Athletic Senior', 'Very fit senior', 'elder', 65, 1.0, 0.58, 0.48, 0.5, ARRAY['athletic', 'senior', 'fit']),
('special-plus-size-male', 'Plus-Size Male', 'Plus-size male model', 'portrait', 35, 1.0, 0.55, 0.78, 0.35, ARRAY['plus-size', 'male', 'full-figured']),
('special-bodybuilder-female', 'Female Bodybuilder', 'Muscular female athlete', 'fitness', 28, 0.0, 0.55, 0.55, 0.9, ARRAY['bodybuilder', 'female', 'muscular'])

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    age = EXCLUDED.age,
    gender = EXCLUDED.gender,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    muscle = EXCLUDED.muscle,
    tags = EXCLUDED.tags;

-- Count presets
-- SELECT COUNT(*) AS total_presets FROM vs_actor_presets;

