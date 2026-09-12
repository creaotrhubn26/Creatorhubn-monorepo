-- 262_photographer_reviews.sql
--
-- Klient-innsendte omtaler/anmeldelser per fotograf. Omtaler skrives av
-- fotografens KUNDER (ikke fotografen selv) og vises i «Det kunder sier» på
-- showcaset. Fotografen modererer (publiserer/skjuler), men authorer ikke.
--
--   * status: 'pending' (nytt) | 'published' (synlig) | 'hidden' (skjult av eier)
--   * photographer_id = users/local-admin id-streng (samme som photographer_client_galleries)
--   * rating 1–5

CREATE TABLE IF NOT EXISTS photographer_reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id TEXT        NOT NULL,
  author          TEXT        NOT NULL,
  role            TEXT,
  review_text     TEXT        NOT NULL,
  rating          INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  -- Per-aspekt stjerner ({ "Kommunikasjon": 5, "Kvalitet": 4 }) når fotografen
  -- har konfigurert veiledningspunkter. `rating` = gjennomsnittet.
  aspect_ratings  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- TRUE når omtalen kom fra en verifisert galleri-kunde (gyldig access-token).
  verified        BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Fotografens offentlige svar på omtalen (#5).
  photographer_reply TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending',
  client_email    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photographer_reviews_pid_status
  ON photographer_reviews (photographer_id, status);
