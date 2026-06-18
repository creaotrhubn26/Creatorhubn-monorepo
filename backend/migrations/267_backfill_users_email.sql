-- 267_backfill_users_email.sql
-- Login-bugen «Token utløpt tross paring» kom av at users.email var TOM for
-- enkelte kontoer (OAuth/migrerte), mens innloggings-sesjonen alltid har en
-- validert email. /me har en sesjons-fallback (PR #412/#415), men her fyller
-- vi inn kolonnen permanent fra den nyeste sesjonens email i
-- creatorhub_auth_sessions.session_data → forhindrer hele klassen feil.
--
-- Idempotent + defensiv: kun rader med tom email, kun hvis tabellene finnes,
-- og tar nyeste sesjon per bruker.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'creatorhub_auth_sessions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email')
  THEN
    UPDATE users u
    SET email = sub.email
    FROM (
      SELECT DISTINCT ON (session_data->>'userId')
             session_data->>'userId' AS uid,
             session_data->>'email'  AS email
      FROM creatorhub_auth_sessions
      WHERE session_data->>'userId' IS NOT NULL
        AND COALESCE(session_data->>'email', '') <> ''
      ORDER BY session_data->>'userId', updated_at DESC
    ) sub
    WHERE u.id::text = sub.uid
      AND COALESCE(u.email, '') = '';
  END IF;
END $$;
