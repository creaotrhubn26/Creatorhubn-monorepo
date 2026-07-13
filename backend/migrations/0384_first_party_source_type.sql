-- 0384_first_party_source_type.sql
-- Bevisst utvidelse av den lukkede source_type-enum-en med 'first_party':
-- egne systemdata (Leadgrid CRM won/lost) — verken eksternt API eller
-- import. Speiler SIGNAL_SOURCE_TYPES i normalized-signal-schema.ts.

ALTER TABLE normalized_signals
  DROP CONSTRAINT IF EXISTS normalized_signals_source_type_check;

ALTER TABLE normalized_signals
  ADD CONSTRAINT normalized_signals_source_type_check
  CHECK (source_type IN (
    'official_api','licensed_provider','user_imported',
    'manual_upload','public_data','first_party'
  ));
