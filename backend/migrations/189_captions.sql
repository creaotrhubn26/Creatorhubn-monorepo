-- Captions / Transcripts — per-prosjekt collection av transkript-segmenter
-- med caption-style og export-state. Skiller seg fra lower-thirds ved at
-- captions er kontinuerlig (hver sekund av tale-tid har en caption) mens
-- lower-thirds er sporadiske (navn-overlays ved punkter).
--
-- Brukes som data-foundation for:
--   - Caption Studio (rediger + style + export SRT/VTT/burnt-in)
--   - Transkript-aware Director-chat
--   - Søk-i-prosjekt + auto-chapter-detection
--   - Highlight-cutdowns basert på sitater

CREATE TABLE IF NOT EXISTS role_room_captions (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  source_video_path text,
  -- Whisper-output: { language, languageProbability, durationSec,
  -- segments[], fullText, method, model }
  transcript jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Caption-style-overrider (font, color, position, max-line-width,
  -- per-style-preset-id). Bjarne kan tweake transkript-styling uten
  -- å re-transcribe.
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Hvilken style-preset captions er basert på
  style_preset_id text,
  -- Whisper-model brukt (base/small/medium/large-v3) for sporing
  whisper_model text,
  -- Hvilket språk transkriptet er på (no/en/...)
  language text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_captions_project
  ON role_room_captions(project_id, updated_at DESC);

COMMENT ON TABLE role_room_captions IS
  'Per-prosjekt transkript + caption-style for Caption Studio. Lagrer '
  'Whisper-output som JSONB med segments/words/timestamps, sammen med '
  'editor-justerbar style-preset.';
