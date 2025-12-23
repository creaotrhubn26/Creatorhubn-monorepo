-- Norwegian Legal Data Migration
-- Creates tables for Norwegian laws, legal references, and AI-generated suggestions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== NORWEGIAN LAWS TABLE ====================

-- Norwegian Laws Table
CREATE TABLE IF NOT EXISTS norwegian_laws (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  law_name VARCHAR(255) NOT NULL,
  law_code VARCHAR(100), -- e.g., 'LOV-2018-06-15-40' for Åndsverkloven
  chapter VARCHAR(100),
  paragraph VARCHAR(50),
  paragraph_number INTEGER,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL CHECK (category IN ('copyright', 'music_industry', 'contracts', 'royalties', 'performer_rights', 'publishing', 'other')),
  keywords TEXT[], -- Array of keywords for search
  related_laws UUID[], -- Array of related law IDs
  external_source VARCHAR(255), -- e.g., 'lovdata.no'
  external_id VARCHAR(255), -- ID from external source
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_norwegian_laws_category ON norwegian_laws(category);
CREATE INDEX idx_norwegian_laws_law_name ON norwegian_laws(law_name);
CREATE INDEX idx_norwegian_laws_keywords ON norwegian_laws USING GIN(keywords);
CREATE INDEX idx_norwegian_laws_paragraph ON norwegian_laws(paragraph_number);
CREATE INDEX idx_norwegian_laws_external_id ON norwegian_laws(external_id);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_norwegian_laws_content_search ON norwegian_laws USING GIN(to_tsvector('norwegian', content));

-- ==================== SPLIT SHEET LEGAL REFERENCES TABLE ====================

-- Legal References Table (links split sheets to legal paragraphs)
CREATE TABLE IF NOT EXISTS split_sheet_legal_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  law_id UUID NOT NULL REFERENCES norwegian_laws(id) ON DELETE CASCADE,
  section_type VARCHAR(100), -- e.g., 'contributors', 'percentages', 'revenue', 'signatures'
  relevance_score DECIMAL(3,2) DEFAULT 1.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  notes TEXT,
  added_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_split_sheet_legal_refs_split_sheet_id ON split_sheet_legal_references(split_sheet_id);
CREATE INDEX idx_split_sheet_legal_refs_law_id ON split_sheet_legal_references(law_id);
CREATE INDEX idx_split_sheet_legal_refs_section_type ON split_sheet_legal_references(section_type);

-- ==================== LEGAL SUGGESTIONS TABLE ====================

-- AI-Generated Legal Suggestions Table
CREATE TABLE IF NOT EXISTS legal_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_sheet_id UUID NOT NULL REFERENCES split_sheets(id) ON DELETE CASCADE,
  law_id UUID NOT NULL REFERENCES norwegian_laws(id) ON DELETE CASCADE,
  suggestion_type VARCHAR(100) NOT NULL CHECK (suggestion_type IN ('compliance_warning', 'recommendation', 'requirement', 'best_practice')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  explanation TEXT, -- Why this suggestion is relevant
  section_type VARCHAR(100), -- Which part of split sheet this relates to
  confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'dismissed')),
  accepted_at TIMESTAMP,
  accepted_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_legal_suggestions_split_sheet_id ON legal_suggestions(split_sheet_id);
CREATE INDEX idx_legal_suggestions_law_id ON legal_suggestions(law_id);
CREATE INDEX idx_legal_suggestions_status ON legal_suggestions(status);
CREATE INDEX idx_legal_suggestions_type ON legal_suggestions(suggestion_type);

-- ==================== TRIGGERS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_legal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for all legal tables
CREATE TRIGGER update_norwegian_laws_updated_at 
BEFORE UPDATE ON norwegian_laws
FOR EACH ROW EXECUTE FUNCTION update_legal_updated_at();

CREATE TRIGGER update_split_sheet_legal_refs_updated_at 
BEFORE UPDATE ON split_sheet_legal_references
FOR EACH ROW EXECUTE FUNCTION update_legal_updated_at();

CREATE TRIGGER update_legal_suggestions_updated_at 
BEFORE UPDATE ON legal_suggestions
FOR EACH ROW EXECUTE FUNCTION update_legal_updated_at();

-- ==================== INITIAL DATA ====================

-- Insert some initial Norwegian music industry laws
-- Note: These are placeholder entries. Real law content should be added from official sources.

INSERT INTO norwegian_laws (id, law_name, law_code, chapter, paragraph, paragraph_number, content, category, keywords) VALUES
(
  uuid_generate_v4(),
  'Åndsverkloven',
  'LOV-2018-06-15-40',
  'Kapittel 2',
  '§ 2',
  2,
  'Opphavsmann er den som skaper verket. For samarbeidsverk er opphavsmenn alle som har deltatt i skapelsen av verket.',
  'copyright',
  ARRAY['opphavsmann', 'samarbeidsverk', 'skapelse', 'rettigheter']
),
(
  uuid_generate_v4(),
  'Åndsverkloven',
  'LOV-2018-06-15-40',
  'Kapittel 4',
  '§ 40',
  40,
  'Ved samarbeidsverk tilhører opphavsretten alle opphavsmennene i fellesskap. Hver av dem kan kreve at verket ikke gjøres tilgjengelig for allmenheten uten samtykke fra alle.',
  'copyright',
  ARRAY['samarbeidsverk', 'opphavsrett', 'samtykke', 'musikk']
),
(
  uuid_generate_v4(),
  'Åndsverkloven',
  'LOV-2018-06-15-40',
  'Kapittel 5',
  '§ 45',
  45,
  'Opphavsmann har enerett til å bestemme om og hvordan verket skal gjøres tilgjengelig for allmenheten.',
  'copyright',
  ARRAY['enerett', 'tilgjengeliggjøring', 'opphavsmann']
),
(
  uuid_generate_v4(),
  'Åndsverkloven',
  'LOV-2018-06-15-40',
  'Kapittel 6',
  '§ 50',
  50,
  'Ved samarbeidsverk kan hver opphavsmann kreve sin andel av inntektene fra verket, med mindre annet er avtalt.',
  'royalties',
  ARRAY['samarbeidsverk', 'inntekter', 'andel', 'royalties', 'avtale']
),
(
  uuid_generate_v4(),
  'Åndsverkloven',
  'LOV-2018-06-15-40',
  'Kapittel 7',
  '§ 60',
  60,
  'Avtaler om overføring av opphavsrett må være skriftlig for å være gyldig.',
  'contracts',
  ARRAY['avtale', 'overføring', 'opphavsrett', 'skriftlig', 'gyldig']
)
ON CONFLICT DO NOTHING;























