-- 0081_casting_whatsapp.sql
-- Utvider audition-reminder-stacken med WhatsApp Cloud API som 3. kanal.
--
-- 1) Default-utvidelse av casting_candidates.reminder_prefs slik at NYE rader
--    får whatsapp24h/whatsapp1h som true. Eksisterende rader oppdateres
--    in-place — manglende keys merges inn med true (matching opt-in pattern).
-- 2) casting_whatsapp_usage: billing-audit-tabell som speiler casting_sms_usage,
--    men sporer per-melding (ikke per-conversation). Pris stemples ved send.

ALTER TABLE casting_candidates
  ALTER COLUMN reminder_prefs SET DEFAULT
    '{"sms24h":true,"sms1h":true,"email24h":true,"email1h":true,"whatsapp24h":true,"whatsapp1h":true}'::jsonb;

UPDATE casting_candidates
   SET reminder_prefs = COALESCE(reminder_prefs, '{}'::jsonb)
                     || '{"whatsapp24h":true,"whatsapp1h":true}'::jsonb
 WHERE NOT (reminder_prefs ? 'whatsapp24h' AND reminder_prefs ? 'whatsapp1h');

CREATE TABLE IF NOT EXISTS casting_whatsapp_usage (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  schedule_id            VARCHAR(255) REFERENCES casting_schedules(id) ON DELETE SET NULL,
  candidate_id           VARCHAR(255) REFERENCES casting_candidates(id) ON DELETE SET NULL,
  sent_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  threshold              VARCHAR(8) NOT NULL,
  brand                  VARCHAR(32) NOT NULL,
  template_name          TEXT,
  whatsapp_message_id    TEXT,
  conversation_id        TEXT,
  unit_price_nok_ex_vat  NUMERIC(10, 4) NOT NULL,
  vat_rate               NUMERIC(5, 4) NOT NULL DEFAULT 0.25,
  total_nok_ex_vat       NUMERIC(10, 4) NOT NULL,
  total_nok_incl_vat     NUMERIC(10, 4) NOT NULL,
  stripe_invoice_item_id TEXT,
  billing_period         VARCHAR(7) GENERATED ALWAYS AS (to_char(sent_at, 'YYYY-MM')) STORED
);

CREATE INDEX IF NOT EXISTS casting_whatsapp_usage_project_period_idx
  ON casting_whatsapp_usage (project_id, billing_period);

CREATE INDEX IF NOT EXISTS casting_whatsapp_usage_period_idx
  ON casting_whatsapp_usage (billing_period)
  WHERE stripe_invoice_item_id IS NULL;

COMMENT ON TABLE casting_whatsapp_usage IS
  'Audit + billing for fakturerbar WhatsApp-bruk. Pris stemples per rad ved send-tidspunkt. conversation_id lagres for fremtidig dedup mot Metas 24-timers-conversation-window (v1 fakturerer per melding for enkelhet).';

COMMENT ON COLUMN casting_whatsapp_usage.unit_price_nok_ex_vat IS
  'Retail-pris per WhatsApp-melding i NOK eks. mva. Konfigureres via CASTING_WHATSAPP_RETAIL_PRICE_NOK_EX_VAT (default 0.80).';

COMMENT ON COLUMN casting_whatsapp_usage.template_name IS
  'Meta-godkjent template-navn (f.eks. audition_reminder_24h_no). Kan brukes for analyse av template-effektivitet.';
