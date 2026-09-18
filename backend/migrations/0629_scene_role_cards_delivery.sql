-- Utsending av rollekort.
--
-- Kortene har fungert siden 0628, men lenkene måtte kopieres én og én. På
-- et sett med tjue statister er det tjue anledninger til å sende feil lenke
-- til feil person — og den feilen oppdages først når noen står på feil sted.
--
-- To kolonner, og begge er der for å unngå hver sin feil:
--
--   contact_email  hvem lenken skal til. Statister har ofte ikke profil i
--                  registeret, så adressen må kunne stå på kortet selv.
--                  Har personen talent_id, brukes profilens adresse — da
--                  har vi én kilde i stedet for to som kan sprike.
--
--   sent_at        når lenken sist ble sendt. «Send til alle» skal ikke
--                  spamme dem som alt har fått; de som har fått noe skal
--                  kunne få det igjen bevisst, ikke ved et uhell.

ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE scene_role_cards ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- «Hvem mangler adresse?» er spørsmålet flaten stiller hver gang noen skal
-- sende. Delvis indeks: bare radene uten adresse er interessante.
CREATE INDEX IF NOT EXISTS scene_role_cards_mangler_epost_idx
  ON scene_role_cards (project_id, scene_id)
  WHERE contact_email IS NULL AND talent_id IS NULL;
