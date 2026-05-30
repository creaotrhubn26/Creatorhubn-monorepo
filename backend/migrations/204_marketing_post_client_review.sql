-- 204_marketing_post_client_review.sql
-- Klient kan godkjenne eller be om endring på en marketing-plan-post
-- direkte i client-portal — etter at Bjarne har lastet opp en preview.
--
-- Status-flyt:
--   pending          (default, ingen review)
--   approved         (klient godkjente)
--   changes_requested (klient ba om endring; typisk pluss en kommentar)
--
-- En review forankres til client_portal_session_id slik at vi vet
-- hvilken magic-link-sesjon som godkjente (og at producer ser hvem
-- den faktiske klienten var, ikke bare "klient X").

ALTER TABLE role_room_marketing_plan_posts
  ADD COLUMN IF NOT EXISTS client_review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (client_review_status IN ('pending','approved','changes_requested')),
  ADD COLUMN IF NOT EXISTS client_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_review_session_id UUID,
  ADD COLUMN IF NOT EXISTS client_review_note TEXT;

CREATE INDEX IF NOT EXISTS role_room_marketing_plan_posts_review_idx
  ON role_room_marketing_plan_posts (client_review_status)
  WHERE client_review_status <> 'pending';

COMMENT ON COLUMN role_room_marketing_plan_posts.client_review_status IS
  'Klient sin review-status. Settes når klient klikker Godkjenn / Be om endring i client-portal.';
COMMENT ON COLUMN role_room_marketing_plan_posts.client_review_session_id IS
  'Hvilken client_portal_sessions-rad som registrerte review-en. Brukes for sporbarhet og audit.';
