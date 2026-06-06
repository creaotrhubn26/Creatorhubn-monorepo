-- Migration 238 — MCC-link-status-snapshot per (produsent, kunde-customer-id)
--
-- Cron-jobben role-room-mcc-link-detector poller Google Ads MCC for å se
-- når en invitasjon endrer status (PENDING → ACTIVE / REFUSED / CANCELED).
-- Denne tabellen er state-snapshot vi sammenligner mot ved hver kjøring —
-- nye/endrede statuser trigger en producer-notifikasjon. Etter
-- producer_notified_at er satt for en gitt (producer, customer, status)-trippel
-- spammer vi ikke samme notifikasjon på nytt.

CREATE TABLE IF NOT EXISTS role_room_mcc_link_state (
  -- Sammensatt PK: én rad per (produsent + kunde-customer-id).
  producer_user_id   TEXT NOT NULL,
  client_customer_id TEXT NOT NULL,

  -- MCC-en produsenten opererer fra (= GOOGLE_ADS_LOGIN_CUSTOMER_ID).
  -- Tas vare på i tilfelle vi senere må håndtere produsenter med flere MCC-er.
  login_customer_id  TEXT NOT NULL,

  -- Siste statuser observert av cron — bruk samme labels som Google Ads API
  -- ('PENDING' | 'ACTIVE' | 'REFUSED' | 'CANCELED' | 'INACTIVE' | 'UNKNOWN').
  last_status               TEXT NOT NULL,
  last_status_changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_checked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Tracker for å unngå spam: én rad per (state, status). Settes når cron har
  -- fyrt notifikasjon på denne nye statusen. Vi krymper aldri timestamp-en —
  -- ny status = ny timestamp.
  last_notified_status      TEXT,
  producer_notified_at      TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (producer_user_id, client_customer_id)
);

-- Indeks som cron-en bruker for å finne rader klare for re-sjekk.
CREATE INDEX IF NOT EXISTS idx_role_room_mcc_link_state_recheck
  ON role_room_mcc_link_state (last_checked_at);

-- Indeks for "alle aktive links per produsent" (UI/dashboard-spørringer).
CREATE INDEX IF NOT EXISTS idx_role_room_mcc_link_state_producer_status
  ON role_room_mcc_link_state (producer_user_id, last_status);
