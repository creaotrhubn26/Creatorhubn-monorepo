-- =====================================================================
-- 310_delivery_playbooks.sql
--
-- Oppsett-system for markedsføreren: hver need_type har en
-- standardisert «delivery playbook» — en steg-for-steg-plan som gjør
-- at enhver markedsfører kan utføre oppsettet på samme måte hver gang.
--
-- Playbook-anatomien (DOSE-prinsippet — Detect / Origin / Setup / Evidence):
--   - Detect:   hva mangler vi? (= need_type)
--   - Origin:   hva trengs fra klienten? (requires_from_client[])
--   - Setup:    steg-for-steg-instruksjoner (steps[])
--   - Evidence: hvordan verifiserer vi at det virker? (verification[])
--
-- Steg-strukturen i steps[] JSONB:
--   { "step": 1, "title": "Opprett Meta Pixel i Events Manager",
--     "instructions": "Logg inn på business.facebook.com → ...",
--     "estimated_minutes": 10, "needs_client_input": false,
--     "action_type": "manual" | "code_paste" | "ext_link" | "verify" }
--
-- Standard-playbooks (is_system=true) seedes per need_type og kan
-- ikke slettes. Organisasjonen kan kopiere dem til egne varianter.
--
-- Når klient ber om fokus → markedsfører klikker «Sett i gang» →
-- backend lager project_deliverables-rad m/ playbook_id + initial
-- progress_data fra steps[]. Markedsfører markerer hvert steg som
-- ferdig; klient ser fremgang i sin portal.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS delivery_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                                       -- NULL = system-default tilgjengelig
                                       -- for alle org. Hvis satt = privat.

  need_type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(40),                -- 'analytics' | 'ads' | 'seo' |
                                       -- 'content' | 'brand' | 'social'

  -- Hva som må fås fra klienten før vi kan begynne
  requires_from_client JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "title": "Facebook Business Manager-tilgang",
  --    "description": "Som admin eller med Pixel-redigeringstilgang",
  --    "type": "access_grant" | "info" | "asset" }, ...]

  -- Selve stegene
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "step": 1, "title": "...", "instructions": "...",
  --    "estimated_minutes": 10, "needs_client_input": false,
  --    "action_type": "manual" | "code_paste" | "ext_link" | "verify" }, ...]

  -- Verifisering — hvordan vi vet at det virker
  verification JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "title": "Pixel fires ved sidevisning",
  --    "how": "Bruk Meta Pixel Helper i Chrome",
  --    "automated": false }, ...]

  estimated_total_minutes INT,
  difficulty VARCHAR(20)
    CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),

  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
                                       -- system-seeded; kan ikke slettes

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- Per (org, need_type) skal det max være én aktiv. Hvis organization_id
  -- IS NULL = systemets default for det need_type'et.
  UNIQUE NULLS NOT DISTINCT (organization_id, need_type)
);
CREATE INDEX IF NOT EXISTS idx_playbooks_need_org
  ON delivery_playbooks(need_type, organization_id);

-- ─── Utvid project_deliverables med playbook-link + progress ───
ALTER TABLE project_deliverables
  ADD COLUMN IF NOT EXISTS playbook_id UUID
    REFERENCES delivery_playbooks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS progress_data JSONB DEFAULT '{}'::jsonb,
  -- Form: { "steps": [{ "step": 1, "status": "done", "completed_at": "...",
  --                    "completed_by": "...", "notes": "..." }, ...],
  --         "requirements": [{ "title": "...", "received": true }, ...] }
  ADD COLUMN IF NOT EXISTS focus_request_id UUID;

DO $$
BEGIN
  ALTER TABLE project_deliverables
    ADD CONSTRAINT proj_deliv_focus_fkey
    FOREIGN KEY (focus_request_id) REFERENCES client_focus_requests(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- ─── Permission ────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('marketing.playbooks.view', 'Marketing', 'Se delivery playbooks'),
  ('marketing.playbooks.edit', 'Marketing', 'Lage/endre delivery playbooks (org-spesifikke)'),
  ('marketing.deliveries.execute', 'Marketing', 'Starte og kjøre delivery-prosesser')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef',          'marketing.playbooks.view'),
  ('markedssjef',          'marketing.playbooks.edit'),
  ('markedssjef',          'marketing.deliveries.execute'),
  ('markedskoordinator',   'marketing.playbooks.view'),
  ('markedskoordinator',   'marketing.deliveries.execute'),
  ('performance_marketer', 'marketing.playbooks.view'),
  ('performance_marketer', 'marketing.deliveries.execute'),
  ('seo_spesialist',       'marketing.playbooks.view'),
  ('seo_spesialist',       'marketing.deliveries.execute'),
  ('content_ansvarlig',    'marketing.playbooks.view'),
  ('content_ansvarlig',    'marketing.deliveries.execute'),
  ('markedsanalytiker',    'marketing.playbooks.view'),
  ('admin',                'marketing.playbooks.view'),
  ('admin',                'marketing.playbooks.edit'),
  ('admin',                'marketing.deliveries.execute')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
