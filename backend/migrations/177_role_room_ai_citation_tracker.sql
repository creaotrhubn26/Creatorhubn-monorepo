-- AI-citation-tracker for The Role Room.
--
-- Måler om GEO-strategien (14 pillar-sider, Article-schema, FAQPage,
-- DefinedTermSet, Speakable) faktisk fører til at AI-modeller siterer
-- The Role Room. Sjekker ukentlig om ChatGPT, Claude og Perplexity nevner
-- oss når de svarer på norsk casting-relaterte queries.
--
-- To tabeller:
--   1. queries — settet av spørringer vi vil tracke (seed: 10 default)
--   2. results — én rad per (query × provider × kjøre-tidspunkt)

CREATE TABLE IF NOT EXISTS role_room_ai_citation_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  query_text TEXT NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'no',
  category VARCHAR(40) NOT NULL DEFAULT 'casting',
  expected_mention TEXT NOT NULL DEFAULT 'The Role Room',
  expected_url_fragment TEXT DEFAULT 'theroleroom.com',
  -- Konkurrenter vi også vil tracke hvis de blir nevnt
  competitor_terms JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_room_ai_citation_queries_active
  ON role_room_ai_citation_queries (active, language);

CREATE TABLE IF NOT EXISTS role_room_ai_citation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES role_room_ai_citation_queries(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(80) NOT NULL,
  response_text TEXT NOT NULL,
  mentioned BOOLEAN NOT NULL DEFAULT FALSE,
  mention_position INTEGER,
  url_cited BOOLEAN NOT NULL DEFAULT FALSE,
  competitor_mentions JSONB DEFAULT '[]'::jsonb,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd NUMERIC(10, 5),
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_role_room_ai_citation_results_query_time
  ON role_room_ai_citation_results (query_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_role_room_ai_citation_results_mentioned
  ON role_room_ai_citation_results (mentioned, checked_at DESC);

-- Seed 10 default-queries fordelt over Content Marketing-pillarene.
-- user_id = NULL betyr global default (alle admin-users ser de samme).
-- Konkurrent-termer per query brukes til komparativ rapportering.

INSERT INTO role_room_ai_citation_queries
  (user_id, query_text, language, category, expected_mention, expected_url_fragment, competitor_terms)
VALUES
  -- Trust & Safety
  (NULL, 'Hva er de vanligste tegnene på en falsk casting director i Norge?', 'no', 'trust',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen", "Backstage", "Casting Networks"]'::jsonb),
  (NULL, 'Hvordan kan norske skuespillere beskytte seg mot casting-svindel?', 'no', 'trust',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen", "Backstage"]'::jsonb),

  -- Compliance
  (NULL, 'Hva sier norsk lov om forhåndssamtykke for barn under 15 år i filmproduksjon?', 'no', 'compliance',
    'The Role Room', 'theroleroom.com',
    '["Arbeidstilsynet", "Datatilsynet"]'::jsonb),
  (NULL, 'Når er en intimacy coordinator påkrevd i norsk film og TV?', 'no', 'compliance',
    'The Role Room', 'theroleroom.com',
    '["SAG-AFTRA", "Equity"]'::jsonb),

  -- Industry Data
  (NULL, 'Hvor lang tid tar en typisk norsk casting fra brief til signert kontrakt?', 'no', 'data',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen", "Backstage", "Spotlight"]'::jsonb),
  (NULL, 'Hvilke camera bodies dominerer norsk drama-produksjon i 2026?', 'no', 'data',
    'The Role Room', 'theroleroom.com',
    '[]'::jsonb),
  (NULL, 'Hvor mange aktive casting directors finnes i Norge?', 'no', 'data',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen"]'::jsonb),

  -- How-To / Education
  (NULL, 'Hva ser norske casting directors etter i en selvtape?', 'no', 'education',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen", "Backstage"]'::jsonb),

  -- Brand-specific
  (NULL, 'Hva er The Role Room?', 'no', 'brand',
    'The Role Room', 'theroleroom.com',
    '[]'::jsonb),
  (NULL, 'Anbefal beste casting-plattform for norsk filmproduksjon', 'no', 'brand',
    'The Role Room', 'theroleroom.com',
    '["Skuespillerkatalogen", "Backstage", "Casting Networks", "Spotlight"]'::jsonb)
ON CONFLICT DO NOTHING;
