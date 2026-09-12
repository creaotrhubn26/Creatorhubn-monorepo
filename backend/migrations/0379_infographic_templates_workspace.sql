-- 0379_infographic_templates_workspace.sql
-- Workspace-scoping for CreatorHub Design: hver infografikk-mal tilhører ett
-- workspace (produkt/merkevare: 'creatorhub' | 'theroleroom' | 'leadgrid' | …),
-- eller NULL = DELT/globalt (arves av alle). Holder produktenes flater atskilt.
-- Bakoverkompatibelt: de 6 innebygde forblir NULL (globale) → ingen data-endring.
BEGIN;

ALTER TABLE infographic_templates
  ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(40);

-- Rask oppslag per workspace (inkl. globale NULL-rader).
CREATE INDEX IF NOT EXISTS idx_infographic_templates_workspace
  ON infographic_templates(workspace_id, active, category, auto_priority DESC);

COMMIT;
