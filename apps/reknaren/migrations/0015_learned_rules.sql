-- Lærende regnskapsmodell per virksomhet.
-- Systemet lærer bedriftens egen praksis (leverandør→konto, kunde→prosjekt,
-- godkjenningskrav) UTEN å gjøre den til universell regel: alt er scopet til én
-- virksomhet eller ett konsern, aldri global. Full åpenhet — hver regel viser
-- hva den har lært, hvilke eksempler den bygger på, hvem som godkjente den, når
-- den sist ble endret, og om den gjelder én bedrift eller hele konsernet.
--
-- Skilt fra det versjonerte, universelle regelregisteret (src/rules/no/), som
-- holder norsk skatte-/MVA-lov. Dette er bedriftens PRAKSIS, ikke lovverk.

-- Konsern: en gruppe virksomheter som kan dele lærte regler.
CREATE TABLE organization_groups (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organizations ADD COLUMN group_id UUID REFERENCES organization_groups(id);

CREATE TABLE learned_rules (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  -- Konsern-regler settes med group_id + scope='group' og gjelder alle
  -- virksomheter i konsernet. Virksomhets-regler har scope='organization'.
  group_id UUID REFERENCES organization_groups(id),
  scope TEXT NOT NULL DEFAULT 'organization' CHECK (scope IN ('organization','group')),
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'account_mapping',     -- leverandør → konto (+ mva-kode)
    'project_mapping',     -- kunde/leverandør → prosjekt
    'approver_requirement',-- leverandør → må godkjennes av rolle
    'threshold_approval'   -- beløp over grense → må godkjennes av rolle
  )),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('vendor','customer','amount')),
  subject_key TEXT,            -- normalisert nøkkel (org.nr eller lower(navn); NULL for beløp)
  subject_label TEXT NOT NULL, -- menneskelesbart (f.eks. «Telia», «Adobe»)
  target JSONB NOT NULL,       -- utfallet: {accountNumber,vatCode} | {project} | {requiredRole} | {thresholdMinor,requiredRole}
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','active','dismissed','superseded')),
  support_count INT NOT NULL DEFAULT 0,  -- antall eksempler regelen bygger på
  observation_count INT NOT NULL DEFAULT 0, -- totalt antall observasjoner for subjektet
  rationale TEXT NOT NULL,     -- «Telia gikk til telefon (6900) i 8 av 9 bilag»
  created_by UUID,             -- NULL = systemforeslått; ellers bruker som opprettet manuelt
  approved_by UUID,            -- hvem som godkjente regelen
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- når regelen sist ble endret
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Én regel per (scope-eier, type, subjekt). Konsern-regler eies av group_id,
-- virksomhets-regler av organization_id.
CREATE UNIQUE INDEX learned_rules_subject_uniq
  ON learned_rules ((COALESCE(group_id, organization_id)), rule_type, subject_type, COALESCE(subject_key, ''));
CREATE INDEX learned_rules_lookup_idx ON learned_rules (organization_id, rule_type, status);
CREATE INDEX learned_rules_group_idx ON learned_rules (group_id, rule_type, status) WHERE group_id IS NOT NULL;

-- Eksemplene en lært regel bygger på — «hvilke eksempler den bygger på».
CREATE TABLE learned_rule_examples (
  id UUID PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES learned_rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  document_id UUID REFERENCES source_documents(id),
  entry_number BIGINT,
  description TEXT NOT NULL,
  occurred_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX learned_rule_examples_rule_idx ON learned_rule_examples (rule_id);
