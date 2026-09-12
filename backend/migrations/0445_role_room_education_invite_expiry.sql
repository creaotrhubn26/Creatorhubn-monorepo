-- Role Room Utdanning: invitasjons-token må ha utløp.
-- Uten expires_at har en lekket invitasjonslenke uendelig levetid (kontoovertakelse).
-- Utløp håndheves kun mens invitasjonen er 'pending' — når den er akseptert er
-- den studentens varige re-claim-credential (sesjoner er harde 30-dagers vinduer).

ALTER TABLE role_room_education_student_invites
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill eksisterende ikke-aksepterte invitasjoner til et bundet vindu.
UPDATE role_room_education_student_invites
   SET expires_at = created_at + INTERVAL '7 days'
 WHERE expires_at IS NULL AND status = 'pending';
