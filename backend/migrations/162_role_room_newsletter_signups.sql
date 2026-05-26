-- Norwegian Casting Brief — newsletter-påmeldinger fra theroleroom.com
--
-- Driver "Newsletter open rate"-, "CTR"- og "Signups attributed to social"-
-- metrics fra Content Marketing-planen (side 26). Source-feltet er
-- UTM-/landing-tagget slik at vi vet hvilken pillar-side som konverterer best.
--
-- GDPR: e-post lagres i klartekst (legitimt behov), ip_hash er sha256(ip+salt)
-- slik at vi kan rate-limit uten å lagre rå IP. consented_at og unsubscribed_at
-- sporer samtykke-tidspunkt for Datatilsynet-ready audit.

CREATE TABLE IF NOT EXISTS role_room_newsletter_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'unknown',
  status VARCHAR(20) NOT NULL DEFAULT 'pending_double_optin',
  ip_hash VARCHAR(64),
  user_agent VARCHAR(500),
  locale VARCHAR(10) DEFAULT 'no',
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_room_newsletter_email
  ON role_room_newsletter_signups (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_source
  ON role_room_newsletter_signups (source);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_status
  ON role_room_newsletter_signups (status);

CREATE INDEX IF NOT EXISTS idx_role_room_newsletter_consented_at
  ON role_room_newsletter_signups (consented_at DESC);
