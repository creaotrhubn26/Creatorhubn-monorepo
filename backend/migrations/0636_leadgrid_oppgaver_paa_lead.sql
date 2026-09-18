-- Oppgaver på lead — og på salget.
--
-- Hva vi hadde:
--   leadgrid_oppgaver (mig 0500, prosjekt-scopet i mig 0549) — brukes bare av
--     møte-etterarbeid og canvas-notater. `frist` er FRITEKST fra en
--     AI-oppsummering («innen fredag»), så ingenting kan sortere eller varsle
--     på den. `user_id` er både den som opprettet og den som eier oppgaven.
--   workflow-handlingen create_task — skrev en rad i crm_lead_activities med
--     activity_type='task' og frist begravet i metadata-JSONB. INGEN kode
--     leser den raden. Slår du på en mal som lager oppgaver, skjer det
--     ingenting synlig. Samme feil som notify_channel hadde.
--
-- Denne migrasjonen utvider tabellen som allerede finnes i stedet for å lage
-- en ny ved siden av. To oppgavetabeller ville betydd to lister å huske på.
--
-- Salget, ikke bare bedriften: etter mig 0635 kan en bedrift ha flere
-- samtidige salg. «Ring daglig leder om kampanjen» hører til kampanjesalget,
-- ikke til bedriften som helhet.

ALTER TABLE leadgrid_oppgaver
  -- Den som skal GJØRE oppgaven. user_id blir stående som den som opprettet
  -- den; uten skillet kan ingen delegere.
  ADD COLUMN IF NOT EXISTS assigned_user_id VARCHAR(255)
    REFERENCES users(id) ON DELETE SET NULL,
  -- Ekte tidspunkt ved siden av fritekst-fristen, så oppgaver kan sorteres,
  -- forfalle og varsles. `frist` beholdes som det brukeren faktisk skrev.
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS task_type VARCHAR(16) NOT NULL DEFAULT 'todo'
    CHECK (task_type IN ('todo', 'call', 'email', 'meeting')),
  ADD COLUMN IF NOT EXISTS done_by VARCHAR(255)
    REFERENCES users(id) ON DELETE SET NULL,
  -- Hvilket salg oppgaven gjelder. NULL = oppgave på bedriften som helhet.
  ADD COLUMN IF NOT EXISTS deal_id UUID
    REFERENCES leadgrid_deals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS workflow_id UUID,
  ADD COLUMN IF NOT EXISTS hubspot_task_id TEXT;

-- Eksisterende oppgaver eies av den som lagde dem. Uten backfill ville
-- «mine oppgaver» vært tom for alt som finnes fra før.
UPDATE leadgrid_oppgaver
   SET assigned_user_id = user_id
 WHERE assigned_user_id IS NULL;

-- Fritekst-frister som tilfeldigvis ER en dato, kan reddes. Resten forblir
-- NULL heller enn å gjettes; en gjettet frist er verre enn ingen.
UPDATE leadgrid_oppgaver
   SET due_at = (frist::date + TIME '09:00') AT TIME ZONE 'Europe/Oslo'
 WHERE due_at IS NULL
   AND frist ~ '^\d{4}-\d{2}-\d{2}$';

-- «Mine åpne oppgaver, de som haster først.»
CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_mine
  ON leadgrid_oppgaver (organization_id, project_id, assigned_user_id, status, due_at)
  WHERE status = 'open';

-- «Hva skylder vi denne kunden?»
CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_lead
  ON leadgrid_oppgaver (lead_id, status, due_at)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_oppgaver_deal
  ON leadgrid_oppgaver (deal_id, status, due_at)
  WHERE deal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_oppgaver_hubspot
  ON leadgrid_oppgaver (organization_id, hubspot_task_id)
  WHERE hubspot_task_id IS NOT NULL;
