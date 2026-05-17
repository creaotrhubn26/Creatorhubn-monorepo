-- 0104_wedding_overtime.sql
-- Overtid-tracking for wedding-day. Stine har kontraktfestet f.eks. 6 timer
-- bryllup-dekning. Hvis dagen utsetter seg, kan hun "aktivere overtid" på
-- mobilen → systemet logger tid + minner om å fakturere ekstra.

ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS contracted_hours NUMERIC(4,1);

ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS overtime_activated_at TIMESTAMPTZ;

ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS overtime_hourly_rate NUMERIC(10,2);

ALTER TABLE wedding_timelines
  ADD COLUMN IF NOT EXISTS overtime_ended_at TIMESTAMPTZ;

COMMENT ON COLUMN wedding_timelines.contracted_hours IS
  'Avtalt antall timer dekning. F.eks. 6.0 timer. NULL = ingen grense satt.';
COMMENT ON COLUMN wedding_timelines.overtime_activated_at IS
  'Tidspunkt fotograf tappet "aktiver overtid" når kontraktstiden ble overskredet.';
COMMENT ON COLUMN wedding_timelines.overtime_hourly_rate IS
  'Pris per overtidstime (NOK). Defaultet fra fotograf-settings hvis satt.';
COMMENT ON COLUMN wedding_timelines.overtime_ended_at IS
  'Tidspunkt overtid stoppet (når Stine markerer dagen ferdig). NULL = pågår.';
