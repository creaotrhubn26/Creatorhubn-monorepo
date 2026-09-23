-- 0662_reiseguide_chapter_prompts.sql
-- SenseAid Explore (lydguide-POC), pakke 3 «spørsmål underveis» (Daniel 23.09.2026):
-- korte innslag som dukker opp midt i et kapittel av fortellingen.
--   * look  = «Se opp: …», et kort med haptikk; fortellingen spiller videre.
--   * guess = et gjettespørsmål; fortellingen pauser, brukeren velger et svar,
--             får fasit (reveal_text) og trykker «Fortsett».
-- Innslagene hører til fortellingen (kind = narration i guide_poi_scripts) for
-- samme (poi_id, lang, chapter_no). Synstolking får ingen innslag.
--
-- at_fraction er posisjonen i kapittelet (0 ≤ x < 1), ikke sekunder, fordi
-- ekte lydlengder ikke er generert ennå; appen regner ut tidspunktet som
-- at_fraction × kapittelets varighet (lyd, ellers manusets anslag).
-- Innholdet skal bare bygge på det som står i manuset for kapittelet.
-- Følger samme språk som fortellingen API-et valgte (samme fallback som manusene).
-- Additiv; bygger på 0640_reiseguide_poc.sql og leses av backend/server/reiseguide-routes.ts.

CREATE TABLE IF NOT EXISTS guide_poi_chapter_prompts (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  lang TEXT NOT NULL
    CONSTRAINT guide_poi_chapter_prompts_lang_chk CHECK (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  chapter_no INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guide_poi_chapter_prompts_chapter_no_chk CHECK (chapter_no >= 1),
  kind TEXT NOT NULL
    CONSTRAINT guide_poi_chapter_prompts_kind_chk CHECK (kind IN ('look', 'guess')),
  at_fraction NUMERIC(5, 4) NOT NULL
    CONSTRAINT guide_poi_chapter_prompts_at_fraction_chk CHECK (at_fraction >= 0 AND at_fraction < 1),
  prompt_text TEXT NOT NULL
    CONSTRAINT guide_poi_chapter_prompts_prompt_text_chk CHECK (char_length(btrim(prompt_text)) > 0),
  options JSONB,
  answer_index INTEGER,
  reveal_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guide_poi_chapter_prompts_sort_order_chk CHECK (sort_order >= 1),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_poi_chapter_prompts_editorial_chk CHECK (editorial_status IN ('draft', 'approved', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_chapter_prompts_poi_lang_chapter_order_key UNIQUE (poi_id, lang, chapter_no, sort_order),
  -- guess krever 2–4 svaralternativer og en fasit som peker inn i dem.
  CONSTRAINT guide_poi_chapter_prompts_guess_chk CHECK (
    kind <> 'guess' OR (
      options IS NOT NULL
      AND jsonb_typeof(options) = 'array'
      AND jsonb_array_length(options) BETWEEN 2 AND 4
      AND answer_index IS NOT NULL
      AND answer_index >= 0
      AND answer_index < jsonb_array_length(options)
    )
  ),
  -- look har verken alternativer eller fasit.
  CONSTRAINT guide_poi_chapter_prompts_look_chk CHECK (
    kind <> 'look' OR (options IS NULL AND answer_index IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS guide_poi_chapter_prompts_poi_lang_idx
  ON guide_poi_chapter_prompts (poi_id, lang, chapter_no, sort_order);

COMMENT ON TABLE guide_poi_chapter_prompts IS
  'Lydguide-POC: spørsmål underveis i fortellingen per (sted, språk, kapittel). kind look = «Se opp»-kort (avspillingen fortsetter), guess = gjettespørsmål (avspillingen pauser til «Fortsett»). at_fraction = posisjon i kapittelet (0 ≤ x < 1). options = ["…", "…"] (2–4) og answer_index kun for guess; reveal_text vises etter svaret. Innhold kun fra kapittelets manus.';
COMMENT ON COLUMN guide_poi_chapter_prompts.at_fraction IS
  'Andel av kapittelets varighet der innslaget vises; appen ganger med faktisk lydlengde (eller manusets anslag når lyd mangler).';
