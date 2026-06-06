-- Klient-samtykke for at innholdsprodusenten får publiseringstilgang til
-- en plattform-konto (Instagram/Facebook/TikTok/LinkedIn/Google).
--
-- Hver rad er et sporbart bevis (GDPR) på at klienten EKSPLISITT tillot at
-- en navngitt produsent (+ firma) fikk tilgang — hvem, hva, når, fra hvor.
-- Skrives rett før OAuth-redirecten når klienten bekrefter samtykke-skjermen.

CREATE TABLE IF NOT EXISTS role_room_client_oauth_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  producer_user_id VARCHAR(255) NOT NULL,
  producer_name VARCHAR(255),
  producer_agency VARCHAR(255),
  platform VARCHAR(32) NOT NULL,            -- instagram|facebook|tiktok|linkedin|google
  scopes_summary TEXT,                      -- menneskelesbar beskrivelse vist ved samtykke
  ip_address VARCHAR(64),
  user_agent TEXT,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_client_oauth_consents_project_idx
  ON role_room_client_oauth_consents (project_id);
CREATE INDEX IF NOT EXISTS role_room_client_oauth_consents_producer_idx
  ON role_room_client_oauth_consents (producer_user_id);
