-- 304_role_room_message_visibility.sql
-- Multi-parts chat: «Rom & roller» (intern vs delt). Hver melding er enten
-- delt med klient eller kun intern (produsent + assistenter). Backend-håndhevet
-- så klienten ALDRI ser intern prat. Additivt + bakoverkompatibelt: alle
-- eksisterende meldinger blir 'shared' (= dagens oppførsel).

ALTER TABLE role_room_messages
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'shared'; -- shared | internal

-- Klient-lesefilter henter kun delte meldinger raskt.
CREATE INDEX IF NOT EXISTS idx_rr_messages_project_visibility
  ON role_room_messages (project_id, visibility, created_at DESC);

COMMENT ON COLUMN role_room_messages.visibility IS
  'shared = synlig for klient, internal = kun produsent-team. Klient-lesefilter gater på dette.';
