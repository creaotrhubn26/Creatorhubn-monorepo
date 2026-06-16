-- 0153_dance_instructor_card.sql
-- Utvider dance_instructor (0068) med presentasjons-felter for instruktør-kortet
-- i "instructors"-fanen: spesialitet, avatar, elevvurdering og neste klasse.
-- Alle NULLABLE — eksisterende rader påvirkes ikke.

ALTER TABLE dance_instructor
  -- Fagfelt/spesialitet, f.eks. "Samtidsdans & koreografi".
  ADD COLUMN IF NOT EXISTS specialty_text TEXT,
  -- Headshot/avatar (URL). NULL → kortet viser initialer.
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  -- Elevvurdering 0.0–5.0 + antall vurderinger.
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  -- Neste klasse som tekst, f.eks. "Tirsdag 18:30 · Sal A" (kan senere
  -- auto-utledes fra dance_class join; tekst nå for enkel redigering).
  ADD COLUMN IF NOT EXISTS next_class_text TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dance_instructor_rating_range') THEN
    ALTER TABLE dance_instructor
      ADD CONSTRAINT dance_instructor_rating_range
      CHECK (rating_avg IS NULL OR (rating_avg BETWEEN 0 AND 5));
  END IF;
END $$;
