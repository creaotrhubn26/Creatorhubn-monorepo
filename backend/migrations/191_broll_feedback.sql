-- B-roll universal læring — på tvers av alle brukere/prosjekter.
--
-- Hver gang Bjarne godkjenner eller avviser en AI-foreslått B-roll,
-- lagrer vi (context-signature × clip-tag-signature × approval) som
-- aggregat-rad. Læringen brukes til å boost'e fremtidige forslag som
-- har høy aggregat-approval-rate på lignende (kontekst, tags).
--
-- Personvern: vi lagrer ikke selve klippene eller fulltext av context,
-- bare HASH'ede + tag-signaturer. Brukernavn lagres for å kunne
-- filtrere bort egen-feedback fra eget projekt-suggestion-rangering
-- (vi vil ikke at en bruker overrider sin egen profile).

CREATE TABLE IF NOT EXISTS role_room_broll_feedback (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  -- Context-signatur: kapittel-id, agent-kind, og hash av context-tekst
  -- (f.eks. "intervju-segment + kontorlokale + emosjonell tone")
  agent_kind text NOT NULL,
  chapter_id text,
  context_tag_signature text NOT NULL, -- f.eks. "interior+office+talking-head"
  -- Klipp-signatur: dominerende tags
  clip_tag_signature text NOT NULL,    -- f.eks. "coffee+table+close-up+warm"
  -- Approval status
  approved boolean NOT NULL,
  -- Bruker-tracking (men ikke kontekst-tekst)
  user_id text,
  project_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Aggregat-view for kjapp suggestion-ranking. Vi kan bruke denne i
-- backend-rangering uten å scanne hele feedback-tabellen.
CREATE INDEX IF NOT EXISTS idx_broll_feedback_agent_context
  ON role_room_broll_feedback(agent_kind, context_tag_signature,
                               clip_tag_signature);
CREATE INDEX IF NOT EXISTS idx_broll_feedback_recent
  ON role_room_broll_feedback(created_at DESC);

COMMENT ON TABLE role_room_broll_feedback IS
  'Universal læring fra B-roll-suggestion-approval/rejection på tvers '
  'av alle brukere. (context-tag-sig × clip-tag-sig × approved)-aggregat '
  'driver fremtidig suggestion-rangering. Bare hash/tag-signaturer '
  'lagres — ingen klipp-data, ingen klar-tekst-context.';
