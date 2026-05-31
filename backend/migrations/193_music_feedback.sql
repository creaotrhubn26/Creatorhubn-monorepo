-- Music universal læring — samme pattern som B-roll. (agent-kind ×
-- context-tag-sig × track-tag-sig × approved) aggregat brukes til å
-- boost'e music-suggestion-rangering på tvers av alle brukere.
--
-- I tillegg til samme tag-baserte signature lagrer vi også BPM-range
-- og key så fremtidige forslag kan vurdere "samme BPM-range som godkjent
-- tidligere = boost".

CREATE TABLE IF NOT EXISTS role_room_music_feedback (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  agent_kind text NOT NULL,
  chapter_id text,
  context_tag_signature text NOT NULL,
  track_tag_signature text NOT NULL,
  -- BPM bucket: rundes til nærmeste 10 (e.g. 124 → 120) for cross-track
  -- aggregat-matching
  track_bpm_bucket int,
  track_key text,
  track_mode text, -- 'major' | 'minor' | null
  approved boolean NOT NULL,
  user_id text,
  project_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_music_feedback_agent_context
  ON role_room_music_feedback(agent_kind, context_tag_signature,
                                track_tag_signature);
CREATE INDEX IF NOT EXISTS idx_music_feedback_bpm
  ON role_room_music_feedback(agent_kind, track_bpm_bucket, approved);

COMMENT ON TABLE role_room_music_feedback IS
  'Universal læring fra music-suggestion-approval/rejection. Lagrer '
  'tag/BPM/key-signaturer (ikke klipp-data) for å rangere fremtidige '
  'forslag bedre på tvers av brukere.';
