-- 0379: Leadbook Eksempler EKTE (2026-07-17) — org-egne salgssamtale-caser
-- + leder-tilbakemeldinger.
--
-- Erstatter mock-casene i Eksempler-fanen med organisasjonens egne vunnede/
-- tapte samtaler. Fylles via «Flagg som eksempel» i Kvalitet-verdikt-flyten
-- (source_verification_id) eller opprettes manuelt av leder; kurateres som
-- draft → published. Salgssjef/teamleder gir tilbakemelding per eksempel
-- (valgfritt knagget på Pondus-dimensjon).

CREATE TABLE IF NOT EXISTS leadbook_examples (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',            -- draft|published|archived
  title TEXT NOT NULL DEFAULT '',
  customer_label TEXT NOT NULL DEFAULT '',         -- kan anonymiseres («byggfirma, Østlandet»)
  industry TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT 'won',             -- won|lost|ongoing
  channel TEXT NOT NULL DEFAULT 'telephone',       -- speiler pondus VALID_KINDS
  duration_sec INT,
  seller_user_id TEXT,
  seller_name TEXT NOT NULL DEFAULT '',
  happened_on DATE,
  pondus_score INT,
  featured_dimension TEXT,                         -- autoritet|klarhet|troverdighet|trygghet|fremdrift
  dimension_scores JSONB NOT NULL DEFAULT '{}',    -- {autoritet: 82, …}
  key_learnings JSONB NOT NULL DEFAULT '[]',       -- [string]
  alternative_phrasings JSONB NOT NULL DEFAULT '[]',
  transcript JSONB NOT NULL DEFAULT '[]',          -- [{speaker, text, at_sec}]
  key_moments JSONB NOT NULL DEFAULT '[]',         -- [{at_sec, label, dimension}]
  deal_value_nok BIGINT,
  summary TEXT NOT NULL DEFAULT '',
  source_verification_id UUID,                     -- satt når flagget fra Kvalitet
  created_by TEXT,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lb_examples_org_status
  ON leadbook_examples (organization_id, status, created_at DESC);
-- Ett eksempel per kvalitet-verifisering (flagg to ganger = samme utkast).
CREATE UNIQUE INDEX IF NOT EXISTS uq_lb_examples_source_verif
  ON leadbook_examples (source_verification_id)
  WHERE source_verification_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadbook_example_feedback (
  id UUID PRIMARY KEY,
  example_id UUID NOT NULL REFERENCES leadbook_examples(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  author_role TEXT NOT NULL DEFAULT '',            -- admin|salgssjef|teamleder|kvalitet
  dimension TEXT,                                  -- valgfri Pondus-knagg
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lb_exfb_example
  ON leadbook_example_feedback (example_id, created_at ASC);
