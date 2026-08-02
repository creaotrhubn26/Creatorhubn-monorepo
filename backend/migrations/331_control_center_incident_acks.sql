-- 331_control_center_incident_acks.sql
--
-- CreatorHub Control Center — tynn ack/assign-layer over hendelser.
--
-- Cockpiten aggregerer hendelser fra to kilder som IKKE er våre å skrive til
-- direkte: Sentry issues (frontend + backend, via read-API) og backend
-- `error_log`. For å la en operatør kvittere/ta ansvar for en hendelse *i
-- cockpiten* — uten å røre Sentrys egen workflow — lagrer vi et tynt
-- ack-lag her, keyet på en stabil ekstern hendelse-ID.
--
--   incident_id: stabil nøkkel på tvers av kilder:
--     - Sentry:     "sentry:<issue-id>"
--     - error_log:  "error_log:<uuid>"
--
-- Full custom incident-workflow er BEVISST utsatt (jf. byggeplanen Fase 1b):
-- dette er kun ack/assign/note, ikke en egen incident-motor.

CREATE TABLE IF NOT EXISTS control_center_incident_acks (
  incident_id       TEXT PRIMARY KEY,
  source            TEXT NOT NULL,                    -- 'sentry' | 'error_log'
  acked_at          TIMESTAMPTZ,
  acked_by_user_id  UUID,
  assigned_to       TEXT,                             -- fritekst/e-post; ikke FK (kan være ekstern)
  note              TEXT,
  resolved_at       TIMESTAMPTZ,                      -- cockpit-lokal lukking (speiler ev. kilde-resolve)
  resolved_by_user_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_incident_acks_source
  ON control_center_incident_acks (source);
CREATE INDEX IF NOT EXISTS idx_cc_incident_acks_assigned
  ON control_center_incident_acks (assigned_to)
  WHERE assigned_to IS NOT NULL;
