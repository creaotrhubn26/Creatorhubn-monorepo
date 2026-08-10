-- Abonnements-/forventningsvakt: oppdag faste kostnader som UTEBLIR.
-- Lærdommen fra Telia-funnet: en fast månedlig forpliktelse sluttet stille å
-- lande i bøkene i 18 mnd fordi den må hentes manuelt fra «Min side» (ingen
-- e-post/bank-auto-fangst) og ingen la merke til fraværet.
--
-- Selve FORVENTNINGEN modelleres som en lærd regel (rule_type='recurring_
-- expectation') — gjenbruker suggest→godkjenn-flyten, provenans og konsern-scope
-- fra læringssystemet. Denne migrasjonen utvider den tillatte regeltypen og
-- legger til en per-periode-status (håndtert/utsatt/avvist).

ALTER TABLE learned_rules DROP CONSTRAINT IF EXISTS learned_rules_rule_type_check;
ALTER TABLE learned_rules ADD CONSTRAINT learned_rules_rule_type_check CHECK (rule_type IN (
  'account_mapping',
  'project_mapping',
  'approver_requirement',
  'threshold_approval',
  'recurring_expectation'   -- leverandør → {kadens, forventet beløp, forfallsdag, kanal, konto}
));

-- Menneskets håndtering av én forventet forekomst (én måned/termin).
-- «handled» = hentet/bokført, «snoozed» = utsatt til dato, «dismissed» = ikke
-- relevant denne perioden. Fravær av rad = ubehandlet (vaktposten vurderer den).
CREATE TABLE recurring_status (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  rule_id UUID NOT NULL REFERENCES learned_rules(id) ON DELETE CASCADE,
  period TEXT NOT NULL,               -- forventet periode, f.eks. '2026-06'
  status TEXT NOT NULL CHECK (status IN ('handled','snoozed','dismissed')),
  snooze_until DATE,
  note TEXT,
  resolved_by UUID NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, rule_id, period)
);
CREATE INDEX recurring_status_rule_idx ON recurring_status (rule_id);
