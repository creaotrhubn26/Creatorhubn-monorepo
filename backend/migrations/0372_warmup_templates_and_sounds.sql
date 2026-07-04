-- 0372: Rutine-maler + «Mine lyder» for Oppvarming & fokus.
--
-- 1) audio_warmup_templates — produsentens rutine-maler på tvers av
--    prosjekter («Vokal før opptak» bygges én gang, brukes i alle lydrom).
--    steps har samme JSONB-form som audio_warmup_routines.steps.
-- 2) audio_user_sounds — produsentens eget lydbibliotek (mindfulness-musikk
--    og voice-over lastet opp via /api/upload/audio → B2). Registreres ved
--    opplasting fra WarmupDialog; sletting fjerner kun bibliotek-raden
--    (B2-objektet består — det kan være i bruk i eksisterende rutiner).

CREATE TABLE IF NOT EXISTS audio_warmup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL,
  title TEXT NOT NULL,
  target VARCHAR(60) DEFAULT 'all',
  steps JSONB NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_warmup_templates_owner
  ON audio_warmup_templates (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audio_user_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  kind VARCHAR(20) DEFAULT 'music', -- 'music' | 'voice'
  duration_sec INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sounds_owner
  ON audio_user_sounds (owner_user_id, created_at DESC);
