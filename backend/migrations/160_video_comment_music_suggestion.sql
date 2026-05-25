-- Slice 9X.82 — Musikk-forslag på timecode-kommentarer
--
-- Klient kan foreslå en sang (YouTube/Spotify/SoundCloud/Apple Music)
-- som skal brukes på et spesifikt sted i video-leveransen:
--   "Bjarne, kan vi bruke denne sangen fra 1:32 til 2:45 her?"
--
-- suggested_media_url    → URL til sangen (auto-detekteres provider)
-- suggested_media_label  → klient-skrevet beskrivelse ("A Thousand Years")
-- suggested_media_from   → start-tid i sangen (sek)
-- suggested_media_to     → slutt-tid i sangen (sek, NULL = til slutten)

ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS suggested_media_url TEXT;
ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS suggested_media_label VARCHAR(255);
ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS suggested_media_from_sec NUMERIC(10,3);
ALTER TABLE video_timecode_comments
  ADD COLUMN IF NOT EXISTS suggested_media_to_sec NUMERIC(10,3);
