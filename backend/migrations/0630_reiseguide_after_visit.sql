-- 0630_reiseguide_after_visit.sql
-- SenseAid Explore (lydguide-POC), «etter besøket» (Daniel 18.09.2026):
--   * kort quiz om stedet man nettopp besøkte (guide_poi_quiz_questions)
--   * stjernerangering etter endt tur (guide_poi_ratings)
-- Liknende steder i nærheten regnes ut fra guide_pois (kategori + avstand),
-- deling bruker /api/guide/share/{slug}, og den personlige loggen over
-- besøkte steder ligger kun på telefonen (ingen konto i POC-en).
-- Bygger på 0629_reiseguide_poc.sql; leses av backend/server/reiseguide-routes.ts.

CREATE TABLE IF NOT EXISTS guide_poi_quiz_questions (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  lang TEXT NOT NULL
    CONSTRAINT guide_poi_quiz_questions_lang_chk CHECK (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  sort_order INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guide_poi_quiz_questions_sort_order_chk CHECK (sort_order >= 1),
  question TEXT NOT NULL,
  options JSONB NOT NULL
    CONSTRAINT guide_poi_quiz_questions_options_chk CHECK (
      jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6
    ),
  correct_index INTEGER NOT NULL
    CONSTRAINT guide_poi_quiz_questions_correct_index_chk CHECK (correct_index >= 0),
  explanation TEXT,
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_poi_quiz_questions_editorial_chk CHECK (editorial_status IN ('draft', 'approved', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_quiz_questions_poi_lang_order_key UNIQUE (poi_id, lang, sort_order),
  CONSTRAINT guide_poi_quiz_questions_correct_in_range_chk CHECK (correct_index < jsonb_array_length(options))
);
CREATE INDEX IF NOT EXISTS guide_poi_quiz_questions_poi_lang_idx
  ON guide_poi_quiz_questions (poi_id, lang, sort_order);

CREATE TABLE IF NOT EXISTS guide_poi_ratings (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL
    CONSTRAINT guide_poi_ratings_device_id_chk CHECK (device_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  stars SMALLINT NOT NULL
    CONSTRAINT guide_poi_ratings_stars_chk CHECK (stars BETWEEN 1 AND 5),
  lang TEXT
    CONSTRAINT guide_poi_ratings_lang_chk CHECK (lang IS NULL OR lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  comment TEXT
    CONSTRAINT guide_poi_ratings_comment_chk CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_ratings_poi_device_key UNIQUE (poi_id, device_id)
);
CREATE INDEX IF NOT EXISTS guide_poi_ratings_poi_idx ON guide_poi_ratings (poi_id);

COMMENT ON TABLE guide_poi_quiz_questions IS
  'Lydguide-POC: kort quiz per severdighet og språk, vist etter besøket. options = ["…", "…"], correct_index peker inn i options. Følger samme språkfallback som manusene.';
COMMENT ON TABLE guide_poi_ratings IS
  'Lydguide-POC: stjernerangering 1–5 per anonym enhet og severdighet (én rad per par, oppdateres ved ny vurdering). Snitt og antall vises i appen.';
