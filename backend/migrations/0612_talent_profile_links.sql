-- Feltene casting-byråer faktisk spør om.
--
-- Byråene ber gjennomgående om det samme settet: byråets nettside og
-- profillenke, to showreels, en «about me»-video, egen nettside, IMDb eller
-- annen CV-lenke, Wikipedia, dramaskole, Facebook, Instagram og en ekstra
-- lenke. talents hadde bare showreel_url og en generisk external_links-liste,
-- så disse måtte skrives inn som fritekst-lenker uten fast betydning.
--
-- Hvorfor delt slik:
--   * showreel_url_2 og about_video_url er EGNE kolonner fordi de maskeres
--     under media_portfolio-scopet sammen med showreel_url. Ligger de i en
--     JSONB-blob må maskeringen enten dele blobben eller gi alt/ingenting.
--   * drama_school er egen kolonne fordi byråer filtrerer på skole. Den er
--     selvrapportert og erstatter ikke den skole-verifiserte utdanningen i
--     metadata.education (se 0429/0430).
--   * Resten er lenker uten søkeverdi og ligger i profile_links med faste
--     nøkler. Ukjente nøkler forkastes server-side.
--
-- profile_links-nøkler: website, imdb, wikipedia, facebook, instagram,
--                       additional, agency_website, agency_profile

ALTER TABLE talents ADD COLUMN IF NOT EXISTS showreel_url_2 TEXT;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS about_video_url TEXT;
ALTER TABLE talents ADD COLUMN IF NOT EXISTS drama_school VARCHAR(255);
ALTER TABLE talents ADD COLUMN IF NOT EXISTS profile_links JSONB DEFAULT '{}'::jsonb;

-- Byråer filtrerer på skole; uten indeks blir det full tabellskann når
-- registeret vokser.
CREATE INDEX IF NOT EXISTS talents_drama_school_idx
  ON talents (LOWER(drama_school))
  WHERE drama_school IS NOT NULL;
