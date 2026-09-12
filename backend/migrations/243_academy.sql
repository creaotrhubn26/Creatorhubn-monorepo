-- Migration 243: utvider academy_* med felter for admin-revenue/payout-flow.
--
-- Driver bak AdminDashboard → Academy-fanen. Tidligere viste UI'en
-- hardkodede tall (5 000 kr / 25 000 kr / 80–20-split). Disse endringene
-- gir admin-endepunktene (admin-academy-routes.ts) ekte data å
-- aggregere fra.
--
-- NB: academy_courses og academy_instructors finnes fra før, men mangler
-- felter for slug, pris (NOK), publiserings-status og revenue-share.
-- Vi bruker ADD COLUMN IF NOT EXISTS slik at migrasjonen er idempotent
-- og ikke ødelegger eksisterende data.
--
-- academy_enrollments lager vi nytt — det finnes ingen tabell for å
-- spore betalte påmeldinger enda. user_id holdes som VARCHAR for å
-- matche den eksisterende konvensjonen i academy_instructors.user_id.
--
-- Modell:
--   academy_courses      — kurset. price_nok = listepris i hele kroner.
--                          status='draft'|'published'|'archived' (UI-filter).
--   academy_instructors  — instruktør-profil. revenue_share = prosent av
--                          kursinntekt som tilfaller instruktør (default 80 %).
--   academy_enrollments  — én rad pr. (course_id, user_id). amount_paid_nok
--                          er hva studenten faktisk betalte.
--
-- Inntekts-/payout-beregning skjer i app-laget basert på
-- SUM(amount_paid_nok) JOIN'et med instructor.revenue_share.

-- ── academy_courses: nye felter for slug, pris, status, instruktør-kobling
ALTER TABLE academy_courses
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS instructor_id UUID,
  ADD COLUMN IF NOT EXISTS price_nok INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'published' | 'archived'
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Sikre UNIQUE-constraint på slug uten å feile hvis kolonnen er NULL
-- på eksisterende rader (UNIQUE index tillater NULL i Postgres).
CREATE UNIQUE INDEX IF NOT EXISTS academy_courses_slug_uniq
  ON academy_courses (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS academy_courses_status_idx
  ON academy_courses (status, created_at DESC);
CREATE INDEX IF NOT EXISTS academy_courses_instructor_idx
  ON academy_courses (instructor_id);

-- ── academy_instructors: revenue-share + email + payout-aggregater
ALTER TABLE academy_instructors
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS revenue_share NUMERIC(5,2) NOT NULL DEFAULT 80.00,
    -- Prosent av kursinntekt som tilfaller instruktør (default 80 %).
    -- Plattform-andel = 100 - revenue_share.
  ADD COLUMN IF NOT EXISTS total_revenue_nok INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_payouts_nok INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS academy_instructors_active_idx
  ON academy_instructors (is_active, display_name);

-- ── academy_enrollments: NY tabell. Sporer betalte påmeldinger.
-- user_id som VARCHAR matcher academy_instructors.user_id-konvensjonen.
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  amount_paid_nok INTEGER NOT NULL DEFAULT 0,
    -- Hva studenten faktisk betalte (kan avvike fra price_nok ved
    -- kampanje/voucher/refund).
  status TEXT NOT NULL DEFAULT 'active',
    -- 'active' | 'completed' | 'refunded'
  UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS academy_enrollments_course_idx
  ON academy_enrollments (course_id, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS academy_enrollments_user_idx
  ON academy_enrollments (user_id, enrolled_at DESC);
CREATE INDEX IF NOT EXISTS academy_enrollments_status_idx
  ON academy_enrollments (status);

-- Seed: 2 demo-instruktører hvis de ikke finnes (matcher display_name).
-- NB: user_id er NOT NULL i den eksisterende skjemaet, så vi gir
-- placeholder-IDer ('system-seed-daniel' / 'system-seed-demo'). Ingen
-- courses/enrollments seedes — tallene skal være 0 til reelle kurs
-- opprettes.
INSERT INTO academy_instructors (user_id, display_name, email, revenue_share, is_active)
SELECT 'system-seed-daniel', 'Daniel Qazi', 'daniel@creatorhubn.com', 80.00, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM academy_instructors WHERE display_name = 'Daniel Qazi'
);

INSERT INTO academy_instructors (user_id, display_name, email, revenue_share, is_active)
SELECT 'system-seed-demo', 'Demo Instructor', 'demo@creatorhubn.com', 70.00, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM academy_instructors WHERE display_name = 'Demo Instructor'
);
