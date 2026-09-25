-- 0680_reiseguide_audio_per_voice.sql
-- SenseAid Explore (lydguide-POC): flere stemmer per språk (Daniel 25.09.2026).
-- Norsk får to stemmer med norsk aksent, Hazel og Walter, og brukeren velger
-- i appen. Et manus kan derfor ha én aktiv lydfil per stemme i stedet for én
-- totalt. API-et velger stemmen appen ber om, ellers språkets standardstemme.
-- Bygger på 0640_reiseguide_poc.sql. Eksisterende data bryter ikke den nye
-- indeksen, fordi den gamle var strengere.

CREATE UNIQUE INDEX IF NOT EXISTS guide_poi_audio_one_active_per_script_voice_idx
  ON guide_poi_audio (script_id, voice_id) WHERE is_active;

DROP INDEX IF EXISTS guide_poi_audio_one_active_per_script_idx;

COMMENT ON TABLE guide_poi_audio IS
  'Lydguide-POC: én aktiv lydfil per (manus, stemme). storage_key i S3 (eller absolutt URL). voice_id + script_version gjør regenerering reproduserbar; API-et velger stemmen appen ber om, ellers språkets standardstemme.';
