-- 265_audio_review_members_meta.sql
--
-- Prosjektmedlemmer (band/crew) + rolle/reaksjon på kommentarer, slik at
-- feedback-studioet kan vise ekte medlemmer, roller per kommentar og likes —
-- alt fullt funksjonelt (ingen placeholder-data).

CREATE TABLE IF NOT EXISTS audio_review_members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  user_id      TEXT,
  name         TEXT        NOT NULL,
  role         TEXT,
  avatar_color TEXT,
  is_owner     BOOLEAN     NOT NULL DEFAULT FALSE,
  order_index  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_members_project ON audio_review_members (project_id);

-- Rolle denormalisert på kommentaren (så raden viser «Ethan (Guitarist)») + likes.
ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS author_role TEXT;
ALTER TABLE audio_review_comments ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- Albumcover + cover-bilde for prosjektet (vises i sidebar).
ALTER TABLE audio_review_projects ADD COLUMN IF NOT EXISTS cover_url TEXT;
