-- =====================================================================
-- 0328_agency_leads_b2b_and_conversion.sql
--
-- Utvider agency_leads (CRM-en bak /for-byraer + "Book demo" på
-- theroleroom.com) med:
--   1. B2B-intake-felt — all viktig bedrifts-info en demo-booking trenger
--      (org.nr, nettside, tittel, team-størrelse, dagens verktøy, bruksområde,
--       ønsket demo-tid, demo-språk).
--   2. Konverterings-felt — sporer "demo → betalende kunde"-flyten når en
--      lead auto-provisjoneres til Role Room-abonnement (bruker + Stripe).
--
-- Bevisst gjenbruk av agency_leads (ÉN CRM) framfor egen demo_bookings-tabell.
-- "Book demo" = source='book_demo', status='demo_booked'.
-- =====================================================================

BEGIN;

-- ── 1. B2B-intake-felt ────────────────────────────────────────────────
ALTER TABLE agency_leads
  ADD COLUMN IF NOT EXISTS org_number          VARCHAR(40),   -- norsk org.nr (9 siffer) — fri tekst for intl.
  ADD COLUMN IF NOT EXISTS website             VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_title       VARCHAR(120),  -- rolle/tittel hos kontakten
  ADD COLUMN IF NOT EXISTS team_size           VARCHAR(60),   -- antall i teamet ("1-3", "10+", fri tekst)
  ADD COLUMN IF NOT EXISTS current_tools       TEXT,          -- hva de bruker i dag
  ADD COLUMN IF NOT EXISTS use_case            TEXT,          -- hva de vil løse / bruksområde
  ADD COLUMN IF NOT EXISTS preferred_demo_time VARCHAR(120),  -- fri tekst ("tirsdager før 12", dato)
  ADD COLUMN IF NOT EXISTS demo_language       VARCHAR(20) DEFAULT 'nb';  -- 'nb' | 'en'

-- ── 2. Konverterings-/provisjonerings-felt ────────────────────────────
-- Fylles av admin "Konverter til kunde"-handlingen. converted_user_id peker
-- på den auto-provisjonerte Role Room-brukeren; stripe_*-feltene knytter
-- leaden til abonnementet (settes når Stripe-checkout fullføres via webhook).
ALTER TABLE agency_leads
  ADD COLUMN IF NOT EXISTS converted_user_id            VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversion_persona           VARCHAR(40),   -- 'production_team' | 'content_producer'
  ADD COLUMN IF NOT EXISTS conversion_checkout_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_customer_id           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS conversion_initiated_at      TIMESTAMPTZ;

-- Rask oppslag på de auto-provisjonerte (admin "demo-bruker"-håndtering).
CREATE INDEX IF NOT EXISTS idx_agency_leads_converted_user
  ON agency_leads(converted_user_id)
  WHERE converted_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agency_leads_source
  ON agency_leads(source, status, created_at DESC);

COMMIT;
