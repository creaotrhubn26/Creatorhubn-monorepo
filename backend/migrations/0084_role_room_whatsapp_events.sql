-- 0084_role_room_whatsapp_events.sql
-- Strukturert event-log for ALLE Meta WhatsApp webhook-events.
--
-- BSP-krav: Meta vil at vi dokumenterer at vi mottar + handler hver
-- event-type. Denne tabellen gir oss:
--   1. Audit-trail for compliance/tilsyn
--   2. Data-grunnlag for kunde-dashbord (template-status, quality-rating
--      per nummer, account-alerts-historikk)
--   3. Bevis for BSP-søknaden — vi viser eksempler på rad-typer
--   4. Replay-evne hvis prosesseringen feiler første gang

CREATE TABLE IF NOT EXISTS role_room_whatsapp_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_field          VARCHAR(64) NOT NULL,
  event_subtype        VARCHAR(64),
  waba_id              VARCHAR(64),
  phone_number_id      VARCHAR(64),
  message_id           TEXT,
  template_name        VARCHAR(255),
  payload              JSONB NOT NULL,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at         TIMESTAMPTZ,
  processing_error     TEXT,
  retry_count          INTEGER NOT NULL DEFAULT 0
);

-- ── Indexes for vanlige spørringer ──────────────────────────────
CREATE INDEX IF NOT EXISTS rrwa_events_field_received_idx
  ON role_room_whatsapp_events (event_field, received_at DESC);

CREATE INDEX IF NOT EXISTS rrwa_events_waba_received_idx
  ON role_room_whatsapp_events (waba_id, received_at DESC)
  WHERE waba_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rrwa_events_phone_received_idx
  ON role_room_whatsapp_events (phone_number_id, received_at DESC)
  WHERE phone_number_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rrwa_events_message_idx
  ON role_room_whatsapp_events (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rrwa_events_template_idx
  ON role_room_whatsapp_events (template_name, received_at DESC)
  WHERE template_name IS NOT NULL;

-- For å finne uprosesserte events som trenger retry
CREATE INDEX IF NOT EXISTS rrwa_events_unprocessed_idx
  ON role_room_whatsapp_events (received_at)
  WHERE processed_at IS NULL AND retry_count < 5;

COMMENT ON TABLE role_room_whatsapp_events IS
  'Strukturert log av alle Meta WhatsApp webhook-events. Hver entry.changes-element fra Meta blir én rad. Brukes for audit, kunde-dashbord, og BSP-review-dokumentasjon.';

COMMENT ON COLUMN role_room_whatsapp_events.event_field IS
  'Meta-field-navnet: messages, message_template_status_update, phone_number_quality_update, account_alerts, account_review_update, account_update, business_capability_update, business_status_update, message_template_quality_update, template_category_update, partner_solution_provider_update, security, phone_number_name_update.';

COMMENT ON COLUMN role_room_whatsapp_events.event_subtype IS
  'Underkategori avledet fra payload: for messages = delivered/sent/read/failed; for template-status = APPROVED/REJECTED/PAUSED/PENDING; etc.';

COMMENT ON COLUMN role_room_whatsapp_events.payload IS
  'Full webhook value-objektet som Meta sendte oss, inkludert hele change-strukturen. Brukes for replay og audit.';

COMMENT ON COLUMN role_room_whatsapp_events.processed_at IS
  'Tidspunkt for når vår domain-spesifikke handler (eks. update casting_whatsapp_usage) ble kjørt vellykket. NULL = ikke prosessert ennå.';
