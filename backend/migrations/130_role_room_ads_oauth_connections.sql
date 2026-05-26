-- Migration 130: Dedicated OAuth connections for Role Room Ads platforms.
--
-- Google Ads (scope adwords) and LinkedIn Ads (r_ads/r_ads_reporting) need
-- ads-scoped tokens that are intentionally SEPARATE from the existing Google
-- Workspace login (role_room_google_connections) and LinkedIn login flows —
-- we must not force ads-consent on every login user. One unified table with a
-- platform discriminator; tokens are AES-256-GCM encrypted (same scheme as
-- role_room_instagram_connections).

CREATE TABLE IF NOT EXISTS role_room_ads_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('meta','google','tiktok','linkedin')),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  -- Platform account reference: Google customer id, LinkedIn org/account urn, etc.
  account_ref VARCHAR,
  connection_state VARCHAR(20) NOT NULL DEFAULT 'connected'
    CHECK (connection_state IN ('connected','revoked','error')),
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One connection per (user, platform).
CREATE UNIQUE INDEX IF NOT EXISTS uq_rr_ads_oauth_user_platform
  ON role_room_ads_oauth_connections(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_rr_ads_oauth_user
  ON role_room_ads_oauth_connections(user_id);

COMMENT ON TABLE role_room_ads_oauth_connections IS
  'Ads-scoped OAuth tokens (Google Ads adwords, LinkedIn r_ads). Separate from login/workspace OAuth. Read by buildPlatformTokenResolver → resolveAdsAccessToken.';
