-- Review-kommentarer fra klient. Knyttet til review-session og
-- (optional) en spesifikk cut. Kommentarer kan også være på timestamp
-- innen en cut.

CREATE TABLE IF NOT EXISTS role_room_review_comments (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  session_id text NOT NULL REFERENCES role_room_review_sessions(id) ON DELETE CASCADE,
  -- Optional referanse til spesifikk cut (kan også være null for
  -- general session-feedback)
  cut_id text REFERENCES role_room_social_cuts(id) ON DELETE SET NULL,
  -- Hvis kommentaren er på en spesifikk tidspunkt i cuten
  timestamp_sec real,
  -- Klient identifiserer seg med navn (token verifies session, ikke
  -- bruker)
  client_name text NOT NULL,
  comment_text text NOT NULL CHECK (length(comment_text) <= 5000),
  -- Optional positiv/negativ tagging (klient kan klikke smiley/frown)
  sentiment text CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  -- Bjarne kan markere som "addressed" når han har handlet på
  addressed boolean NOT NULL DEFAULT false,
  addressed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_session
  ON role_room_review_comments(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_comments_cut
  ON role_room_review_comments(cut_id, created_at DESC);

COMMENT ON TABLE role_room_review_comments IS
  'Klient-kommentarer på review-sessions. Optional knyttet til en '
  'spesifikk cut og timestamp. Sentiment-tagging + addressed-flag '
  'for Bjarne workflow.';
