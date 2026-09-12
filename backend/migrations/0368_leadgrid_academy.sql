-- 0368: Leadgrid Academy — org-scopet opplæring (kurs → kapitler → progresjon).
--
-- «Sett en standard i organisasjonen. Lær opp ansatte og utvikle dem til
-- bedre og mer effektive leads-jaktere.»
--
-- To synligheter:
--   scope='leadgrid_official'  → Leadgrids egne kurs, synlige for ALLE org-er
--                                (organization_id IS NULL)
--   scope='org'                → organisasjonens egne kurs, kun synlige for
--                                medlemmer (organization_id satt)
--
-- Bevisst egne leadgrid_academy_*-tabeller (IKKE gjenbruk av academy_courses/
-- learning_courses): de systemene er globale, Stripe-koblede og drifter i eget
-- tempo — samme lærdom som protools_companion_*.
--
-- Video: R2-nøkkel (video_r2_key) → presignert GET via backend. video_r2_key
-- NULL = tekst/poster-kapittel (iPad-spilleren simulerer som i dag).

CREATE TABLE IF NOT EXISTS leadgrid_academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(24) NOT NULL DEFAULT 'org'
    CHECK (scope IN ('leadgrid_official', 'org')),
  organization_id VARCHAR(64),           -- NULL for leadgrid_official
  slug VARCHAR(80) NOT NULL,             -- stabil nøkkel for seed/idempotens
  title TEXT NOT NULL,
  description TEXT,
  poster_icon VARCHAR(64),               -- SF Symbol (iPad)
  poster_tint VARCHAR(16),               -- hex
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_academy_courses_scope_org CHECK (
    (scope = 'leadgrid_official' AND organization_id IS NULL)
    OR (scope = 'org' AND organization_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS leadgrid_academy_courses_slug_org
  ON leadgrid_academy_courses (slug, COALESCE(organization_id, ''));
CREATE INDEX IF NOT EXISTS leadgrid_academy_courses_org
  ON leadgrid_academy_courses (organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_academy_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES leadgrid_academy_courses(id) ON DELETE CASCADE,
  number INT NOT NULL,
  section VARCHAR(48) NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  summary TEXT,
  instructor VARCHAR(120),
  duration_seconds INT NOT NULL DEFAULT 0,
  poster_icon VARCHAR(64),
  poster_tint VARCHAR(16),
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  transcript_snippet TEXT,
  video_r2_key TEXT,                     -- NULL = ikke-video-kapittel
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, number)
);
CREATE INDEX IF NOT EXISTS leadgrid_academy_chapters_course
  ON leadgrid_academy_chapters (course_id, number);

CREATE TABLE IF NOT EXISTS leadgrid_academy_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64) NOT NULL,
  chapter_id UUID NOT NULL REFERENCES leadgrid_academy_chapters(id) ON DELETE CASCADE,
  organization_id VARCHAR(64),
  watched BOOLEAN NOT NULL DEFAULT FALSE,
  position_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS leadgrid_academy_progress_user
  ON leadgrid_academy_progress (user_id);
