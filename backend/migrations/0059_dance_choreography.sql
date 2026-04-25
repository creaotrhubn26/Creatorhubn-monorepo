-- 0059_dance_choreography.sql
-- Choreography Builder — backend persistens.
--
-- Hvert dansestykke består av én rad i `dance_choreography` (header med
-- tittel, BPM, total varighet osv.) og N rader i
-- `dance_choreography_segment` med foreign-key tilbake.
--
-- Scoping: `owner_user_id` (matcher referansearkiv-mønsteret 0057). Når
-- prosjekt-modellen utvides senere kan `project_id` legges til som
-- nullable kolonne uten å bryte eksisterende rader.

CREATE TABLE IF NOT EXISTS dance_choreography (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Eierskap
  owner_user_id TEXT NOT NULL,

  -- Header-felt
  title TEXT NOT NULL,
  choreographer TEXT,
  music_title TEXT,
  music_url TEXT,                -- R2-URL etter audio-upload (null = ingen audio ennå)
  music_storage_key TEXT,        -- intern R2-nøkkel for refresh-signing
  bpm INTEGER,
  musical_key TEXT,
  total_duration_sec INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_choreography_owner_idx
  ON dance_choreography (owner_user_id, updated_at DESC);


CREATE TABLE IF NOT EXISTS dance_choreography_segment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  choreography_id UUID NOT NULL REFERENCES dance_choreography(id) ON DELETE CASCADE,

  -- Sekvens-index for stabil sortering hvis to segmenter har samme startSec
  -- (sjelden men mulig). Hovedsorteringen bruker start_sec.
  sequence INTEGER NOT NULL DEFAULT 0,

  -- Type + valgfri visningsetikett-override
  kind TEXT NOT NULL,             -- intro | verse | chorus | bridge | break | outro | freestyle | lift | formation_change
  label TEXT,

  -- Tider i sekunder fra koreografi-start
  start_sec INTEGER NOT NULL,
  end_sec INTEGER NOT NULL,

  -- Per-lag metadata (alle valgfrie)
  music_cue TEXT,
  formation TEXT,
  camera TEXT,
  lighting TEXT,
  costume TEXT,
  movement_notes TEXT,

  -- Energi + dansere + status
  energy TEXT NOT NULL DEFAULT 'medium',  -- low | controlled | medium | high | sharp | explosive
  dancers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  video_ref_url TEXT,
  approval TEXT NOT NULL DEFAULT 'draft', -- draft | review | approved | locked

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Sanity: end > start
  CONSTRAINT dance_choreography_segment_time_order
    CHECK (end_sec > start_sec)
);

-- Hovedindex for å hente segmenter sortert pr koreografi.
CREATE INDEX IF NOT EXISTS dance_choreography_segment_choreo_idx
  ON dance_choreography_segment (choreography_id, sequence, start_sec);
