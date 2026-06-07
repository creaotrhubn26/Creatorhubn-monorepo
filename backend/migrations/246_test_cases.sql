-- Migration 243: test_suites + test_cases
--
-- Bakgrunn: AutomatedTestCaseGenerator.tsx kaller
--   GET  /api/admin/test-cases
--   GET  /api/admin/test-suites
--   POST /api/admin/generate-test-cases
-- Disse endepunktene trenger persistens for Claude-genererte test-cases.
--
-- En suite samler relaterte test-cases (typisk pr. target_component eller
-- profesjon). En test-case har strukturerte steg (JSONB) og en kategori
-- som matcher hva Claude blir bedt om å generere.

CREATE TABLE IF NOT EXISTS test_suites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_component TEXT,
    -- Hvilken komponent/feature suiten dekker
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id UUID REFERENCES test_suites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{action: '...', expected: '...'}, ...]
  expected_result TEXT,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'critical'
  category TEXT,
    -- 'happy-path' | 'edge-case' | 'error-handling' | 'integration'
  generated_by TEXT,
    -- 'claude' | 'human' | 'imported'
  source_prompt TEXT,
    -- Hvis generated_by='claude': originalt prompt
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_cases_suite_idx
  ON test_cases (suite_id, created_at DESC);
CREATE INDEX IF NOT EXISTS test_cases_priority_idx
  ON test_cases (priority, status);
