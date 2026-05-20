-- 0128 — ResumeBuilder fullstendig persistens
--
-- Realiserer skjemaet definert i frontend/shared/resume-schema.ts mot
-- Postgres. Frem til denne migrasjonen var tabellene kun definert i TS;
-- alle /api/resumes* og /api/job-applications-endepunkter feilet med 404.
--
-- Idempotent: bruker IF NOT EXISTS. Trygg å re-kjøre.
--
-- 10 tabeller:
--   resumes, resume_experiences, resume_education, resume_skills,
--   resume_certifications, resume_projects, resume_templates,
--   job_applications, job_sources, resume_exports, resume_ai_analyses
--
-- Tids-/dato-felter bruker TIMESTAMPTZ (ikke TIMESTAMP) for å unngå
-- tidssone-bugs ved server-/klient-rendering på tvers av NO/UTC.

-- ── resumes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           VARCHAR(255) NOT NULL,

  title             VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) NOT NULL,

  personal_info     JSONB NOT NULL DEFAULT '{}'::jsonb,

  template_id       VARCHAR(64)  NOT NULL DEFAULT 'modern-ats',
  color_scheme      VARCHAR(50)  DEFAULT 'professional-blue',
  custom_colors     JSONB,

  ats_score         INT DEFAULT 0,
  ats_optimized     BOOLEAN DEFAULT FALSE,
  keywords          TEXT[],
  target_job_title  VARCHAR(255),
  target_industry   VARCHAR(255),

  ai_generated      BOOLEAN DEFAULT FALSE,
  ai_suggestions    JSONB,
  last_ai_analysis  TIMESTAMPTZ,

  status            VARCHAR(20) DEFAULT 'draft',
  is_public         BOOLEAN DEFAULT FALSE,
  public_url        VARCHAR(255),

  language          VARCHAR(10) DEFAULT 'no',
  version           INT DEFAULT 1,
  last_exported     TIMESTAMPTZ,
  export_count      INT DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resumes_user_slug_unique UNIQUE (user_id, slug),
  CONSTRAINT resumes_status_chk CHECK (status IN ('draft','active','archived'))
);
CREATE INDEX IF NOT EXISTS resumes_user_id_idx ON resumes (user_id);
CREATE INDEX IF NOT EXISTS resumes_slug_idx    ON resumes (slug);
CREATE INDEX IF NOT EXISTS resumes_status_idx  ON resumes (status);


-- ── resume_experiences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_experiences (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  job_title         VARCHAR(255) NOT NULL,
  company           VARCHAR(255) NOT NULL,
  location          VARCHAR(255),
  employment_type   VARCHAR(20),

  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ,
  is_current        BOOLEAN DEFAULT FALSE,

  description       TEXT,
  achievements      TEXT[],
  skills            TEXT[],

  project_id        VARCHAR(64),
  auto_generated    BOOLEAN DEFAULT FALSE,

  display_order     INT DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_exp_employment_chk CHECK (
    employment_type IS NULL OR employment_type IN
      ('full-time','part-time','contract','freelance','self-employed','internship')
  )
);
CREATE INDEX IF NOT EXISTS resume_experiences_resume_id_idx  ON resume_experiences (resume_id);
CREATE INDEX IF NOT EXISTS resume_experiences_project_id_idx ON resume_experiences (project_id);


-- ── resume_education ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_education (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  degree            VARCHAR(255) NOT NULL,
  field_of_study    VARCHAR(255),
  institution       VARCHAR(255) NOT NULL,
  location          VARCHAR(255),

  start_date        TIMESTAMPTZ NOT NULL,
  end_date          TIMESTAMPTZ,
  is_current        BOOLEAN DEFAULT FALSE,

  grade             VARCHAR(50),
  description       TEXT,
  achievements      TEXT[],

  display_order     INT DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resume_education_resume_id_idx ON resume_education (resume_id);


-- ── resume_skills ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_skills (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  name              VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  proficiency_level INT DEFAULT 50,
  years_of_experience INT,

  is_endorsed       BOOLEAN DEFAULT FALSE,
  endorsement_count INT DEFAULT 0,

  display_order     INT DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_skills_prof_chk CHECK (proficiency_level BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS resume_skills_resume_id_idx ON resume_skills (resume_id);
CREATE INDEX IF NOT EXISTS resume_skills_category_idx  ON resume_skills (category);


-- ── resume_certifications ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_certifications (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  name              VARCHAR(255) NOT NULL,
  issuer            VARCHAR(255) NOT NULL,
  issue_date        TIMESTAMPTZ NOT NULL,
  expiry_date       TIMESTAMPTZ,
  credential_id     VARCHAR(255),
  credential_url    VARCHAR(500),

  description       TEXT,

  display_order     INT DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resume_certifications_resume_id_idx ON resume_certifications (resume_id);


-- ── resume_projects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_projects (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  title             VARCHAR(255) NOT NULL,
  description       TEXT,
  role              VARCHAR(255),

  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,

  technologies      TEXT[],
  achievements      TEXT[],

  project_url       VARCHAR(500),
  images            TEXT[],

  project_id        VARCHAR(64),
  auto_generated    BOOLEAN DEFAULT FALSE,

  display_order     INT DEFAULT 0,
  is_visible        BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS resume_projects_resume_id_idx  ON resume_projects (resume_id);
CREATE INDEX IF NOT EXISTS resume_projects_project_id_idx ON resume_projects (project_id);


-- ── resume_templates (global, ikke per bruker) ──────────────────────
CREATE TABLE IF NOT EXISTS resume_templates (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,

  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  category          VARCHAR(100),

  ats_score         INT DEFAULT 100,
  is_ats_optimized  BOOLEAN DEFAULT TRUE,

  layout            VARCHAR(50),
  sections          JSONB,

  preview_image     VARCHAR(500),
  color_schemes     JSONB,
  fonts             JSONB,

  is_premium        BOOLEAN DEFAULT FALSE,
  usage_count       INT DEFAULT 0,
  rating            INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_templates_layout_chk CHECK (
    layout IS NULL OR layout IN ('single-column','two-column','modern-split')
  )
);
CREATE INDEX IF NOT EXISTS resume_templates_category_idx  ON resume_templates (category);
CREATE INDEX IF NOT EXISTS resume_templates_is_active_idx ON resume_templates (is_active);

-- Seed grunnsett (idempotent via ON CONFLICT DO NOTHING; templates har
-- ikke unique-constraint på name så vi seeder kun hvis tabellen er tom).
INSERT INTO resume_templates (id, name, description, category, ats_score, layout, sections, is_active)
SELECT * FROM (VALUES
  ('modern-ats',    'Modern ATS',    'ATS-optimalisert moderne mal — best for søknader gjennom screening-systemer.', 'professional', 100, 'single-column', '["personal","summary","experience","education","skills","certifications","projects"]'::jsonb, TRUE),
  ('simple-classic','Simple Classic','Tradisjonell enkel mal med tydelig hierarki — fungerer i alle bransjer.', 'professional',  95, 'single-column', '["personal","summary","experience","education","skills"]'::jsonb, TRUE),
  ('tech-modern',   'Tech Modern',   'Moderne to-spaltet layout for utviklere og tech-roller.', 'creative',  92, 'two-column',    '["personal","summary","skills","experience","projects","education"]'::jsonb, TRUE)
) AS v(id,name,description,category,ats_score,layout,sections,is_active)
WHERE NOT EXISTS (SELECT 1 FROM resume_templates LIMIT 1);


-- ── job_applications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_applications (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id           VARCHAR(255) NOT NULL,
  resume_id         VARCHAR(64) REFERENCES resumes(id) ON DELETE SET NULL,

  job_title         VARCHAR(255) NOT NULL,
  company           VARCHAR(255) NOT NULL,
  location          VARCHAR(255),
  job_url           VARCHAR(500),

  source            VARCHAR(100),
  job_id            VARCHAR(255),

  status            VARCHAR(20) DEFAULT 'saved',

  applied_date      TIMESTAMPTZ,
  response_date     TIMESTAMPTZ,
  interview_date    TIMESTAMPTZ,
  offer_date        TIMESTAMPTZ,

  cover_letter      TEXT,
  notes             TEXT,
  salary            VARCHAR(100),

  follow_up_date    TIMESTAMPTZ,
  reminder_sent     BOOLEAN DEFAULT FALSE,

  priority          VARCHAR(10) DEFAULT 'medium',
  tags              TEXT[],

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_applications_status_chk CHECK (
    status IN ('saved','applied','interviewing','offer','rejected','accepted','withdrawn')
  ),
  CONSTRAINT job_applications_priority_chk CHECK (
    priority IN ('low','medium','high')
  )
);
CREATE INDEX IF NOT EXISTS job_applications_user_id_idx ON job_applications (user_id);
CREATE INDEX IF NOT EXISTS job_applications_status_idx  ON job_applications (status);
CREATE INDEX IF NOT EXISTS job_applications_source_idx  ON job_applications (source);


-- ── job_sources (global config) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_sources (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              VARCHAR(255) NOT NULL,
  url               VARCHAR(500) NOT NULL,
  country           VARCHAR(50) DEFAULT 'Norway',
  is_active         BOOLEAN DEFAULT TRUE,
  scraping_enabled  BOOLEAN DEFAULT FALSE,
  api_enabled       BOOLEAN DEFAULT FALSE,
  api_key           VARCHAR(500),
  job_count         INT DEFAULT 0,
  last_scraped      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed kjente norske kilder (kun hvis tabellen er tom).
INSERT INTO job_sources (name, url, country, is_active)
SELECT * FROM (VALUES
  ('Finn.no',      'https://www.finn.no/job',         'Norway', TRUE),
  ('NAV',          'https://arbeidsplassen.nav.no',   'Norway', TRUE),
  ('LinkedIn',     'https://www.linkedin.com/jobs',   'Global', TRUE),
  ('Jobbnorge',    'https://www.jobbnorge.no',        'Norway', TRUE)
) AS v(name, url, country, is_active)
WHERE NOT EXISTS (SELECT 1 FROM job_sources LIMIT 1);


-- ── resume_exports (audit log) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_exports (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,
  format            VARCHAR(10) NOT NULL,
  file_url          VARCHAR(500),
  file_size         INT,
  exported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_exports_format_chk CHECK (format IN ('pdf','docx','txt','json','html'))
);
CREATE INDEX IF NOT EXISTS resume_exports_resume_id_idx ON resume_exports (resume_id);
CREATE INDEX IF NOT EXISTS resume_exports_format_idx    ON resume_exports (format);


-- ── resume_ai_analyses (AI history) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS resume_ai_analyses (
  id                VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  resume_id         VARCHAR(64) NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id           VARCHAR(255) NOT NULL,

  analysis_type     VARCHAR(40) NOT NULL,
  score             INT,
  suggestions       JSONB,

  matched_keywords  TEXT[],
  missing_keywords  TEXT[],

  job_description   TEXT,
  match_score       INT,

  analyzed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_ai_analyses_type_chk CHECK (
    analysis_type IN ('ats_optimization','keyword_match','content_improvement','grammar_check')
  )
);
CREATE INDEX IF NOT EXISTS resume_ai_analyses_resume_id_idx ON resume_ai_analyses (resume_id);
CREATE INDEX IF NOT EXISTS resume_ai_analyses_type_idx      ON resume_ai_analyses (analysis_type);
