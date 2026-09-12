-- 0380: Tilbakemeldings-anker (2026-07-17) — leder kan knagge tilbake-
-- meldingen til en konkret replikk i transkriptet (transcript_index =
-- posisjon i transcript-arrayen) og/eller tidspunkt (at_sec, for fase 2-
-- eksempler med ekte lyd). Begge valgfrie — generell tilbakemelding
-- forblir uendret.

ALTER TABLE leadbook_example_feedback
  ADD COLUMN IF NOT EXISTS transcript_index INT,
  ADD COLUMN IF NOT EXISTS at_sec INT;
