-- Migration 237 — Klient-kommentarer på ads-kampanjer
--
-- Lar klient (client_reviewer-rolle) be om endringer på en kampanje uten
-- selv å ha skrive-tilgang. Produsenten får notifikasjon når en kommentar
-- legges inn, kan svare og/eller markere som "løst".
--
-- Brukt av ClientAdsPerformancePanel (read-only kampanje-liste i
-- ClientEconomyPanel) for transparent dialog mellom kunde og produsent.

CREATE TABLE IF NOT EXISTS client_ads_campaign_comments (
  id BIGSERIAL PRIMARY KEY,

  -- Foreign keys (campaign + project + author).
  -- ads_campaigns og role_room_projects bruker TEXT-id pga ekstern-id-mønster.
  campaign_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,

  -- "client" når klienten ber om noe, "producer" når produsenten svarer.
  -- Vi tillater begge så tråden kan bli en ekte dialog.
  author_role TEXT NOT NULL CHECK (author_role IN ('client', 'producer')),

  -- Selve meldingen. Maks 4000 tegn — lange dokumenter hører hjemme i
  -- en delt drive-mappe, ikke en kommentar-tråd.
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),

  -- Strukturert intent — gir produsenten et signal om hva klienten ønsker.
  -- Frontend kan tilby quick-actions (øk budsjett, pause, juster mål).
  intent TEXT CHECK (intent IN (
    'increase_budget',
    'decrease_budget',
    'pause',
    'resume',
    'change_targeting',
    'change_creative',
    'general_feedback',
    'producer_reply'
  )),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Markeres som løst når produsenten har utført ønsket handling eller
  -- avklart i annen kanal. Holder UI-en ren (kun aktive tråder vises).
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id TEXT,

  -- Når produsenten faktisk fikk notifikasjon (for å unngå duplikat-spam
  -- fra crons + admin-redeploys).
  producer_notified_at TIMESTAMPTZ
);

-- Indekser for typiske spørringer (vis tråder per kampanje, nye usynlige).
CREATE INDEX IF NOT EXISTS idx_client_ads_comments_campaign
  ON client_ads_campaign_comments (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ads_comments_project
  ON client_ads_campaign_comments (project_id, resolved_at NULLS FIRST, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_ads_comments_unnotified
  ON client_ads_campaign_comments (producer_notified_at, created_at)
  WHERE producer_notified_at IS NULL AND author_role = 'client';
