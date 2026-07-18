-- 0401: Dørsalg-utfall «ikke_hjemme» — den viktigste kategorien i felt:
-- gul pin + eget filter gjør kveldsrunden målrettet (bank kun dørene
-- der ingen var hjemme, ikke hele gata på nytt).

ALTER TABLE leadgrid_dorsalg_status
  DROP CONSTRAINT IF EXISTS leadgrid_dorsalg_status_status_check;
ALTER TABLE leadgrid_dorsalg_status
  ADD CONSTRAINT leadgrid_dorsalg_status_status_check
  CHECK (status IN ('vunnet', 'avslatt', 'ikke_hjemme'));
