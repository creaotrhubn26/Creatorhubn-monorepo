-- 0459_admin_workspace_cv_profiles.sql
--
-- Sporbar CV-bygging for Admin Workspace. En profil oppstår fra en
-- prosjektfil, fakta verifiseres enkeltvis, og manglende informasjon samles
-- som eksplisitte spørsmål før det genereres et vanlig workspace-dokument.

ALTER TABLE admin_documents
  DROP CONSTRAINT IF EXISTS admin_documents_type_check;

ALTER TABLE admin_documents
  ADD CONSTRAINT admin_documents_type_check
  CHECK (document_type IN (
    'funding_application',
    'strategy_memo',
    'decision_note',
    'meeting_note',
    'market_analysis',
    'sales_proposal',
    'partnership_proposal',
    'agreement',
    'report',
    'playbook',
    'cv',
    'other'
  ));

CREATE TABLE IF NOT EXISTS admin_cv_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  source_project_file_id UUID NOT NULL,
  person_name VARCHAR(180) NOT NULL,
  headline VARCHAR(240),
  professional_summary TEXT,
  source_url TEXT,
  import_status VARCHAR(20) NOT NULL DEFAULT 'draft',
  source_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_document_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_cv_profiles_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_cv_profiles_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_cv_profiles_source_file_fk
    FOREIGN KEY (source_project_file_id, user_id)
    REFERENCES admin_workspace_project_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_cv_profiles_project_person_unique UNIQUE (project_id, person_name),
  CONSTRAINT admin_cv_profiles_name_check CHECK (char_length(trim(person_name)) BETWEEN 2 AND 180),
  CONSTRAINT admin_cv_profiles_status_check
    CHECK (import_status IN ('draft', 'review', 'verified'))
);

CREATE INDEX IF NOT EXISTS idx_admin_cv_profiles_project
  ON admin_cv_profiles (user_id, project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS admin_cv_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  category VARCHAR(30) NOT NULL,
  label VARCHAR(300) NOT NULL,
  organization VARCHAR(240),
  role_title VARCHAR(240),
  start_value VARCHAR(40),
  end_value VARCHAR(40),
  description TEXT,
  evidence_text TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'needs_confirmation',
  sort_order INTEGER NOT NULL DEFAULT 100,
  fingerprint VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_cv_claims_profile_fk
    FOREIGN KEY (profile_id, user_id)
    REFERENCES admin_cv_profiles (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_cv_claims_category_check
    CHECK (category IN (
      'identity', 'experience', 'education', 'certification', 'project',
      'skill', 'language', 'award', 'other'
    )),
  CONSTRAINT admin_cv_claims_verification_check
    CHECK (verification_status IN (
      'source_supported', 'user_confirmed', 'needs_confirmation', 'rejected'
    )),
  CONSTRAINT admin_cv_claims_confidence_check CHECK (confidence BETWEEN 0 AND 1),
  CONSTRAINT admin_cv_claims_sort_check CHECK (sort_order >= 0),
  CONSTRAINT admin_cv_claims_fingerprint_unique UNIQUE (profile_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_admin_cv_claims_profile
  ON admin_cv_claims (user_id, profile_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS admin_cv_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  field_key VARCHAR(80) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_cv_questions_profile_fk
    FOREIGN KEY (profile_id, user_id)
    REFERENCES admin_cv_profiles (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_cv_questions_status_check CHECK (status IN ('open', 'answered')),
  CONSTRAINT admin_cv_questions_sort_check CHECK (sort_order >= 0),
  CONSTRAINT admin_cv_questions_profile_field_unique UNIQUE (profile_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_cv_questions_profile
  ON admin_cv_questions (user_id, profile_id, status, sort_order);

COMMENT ON TABLE admin_cv_profiles IS
  'Prosjektbundne CV-profiler med tydelig kilde, kontrolltidspunkt og generert workspace-dokument.';

COMMENT ON TABLE admin_cv_claims IS
  'Enkeltfakta fra CV-kilden med evidens, konfidens og eksplisitt verifiseringsstatus.';

COMMENT ON TABLE admin_cv_questions IS
  'Manglende CV-opplysninger som brukeren må svare på før dokumentet kan regnes som verifisert.';
