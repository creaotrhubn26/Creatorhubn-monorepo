-- 0663_reiseguide_hero_image_credit.sql
-- SenseAid Explore (lydguide-POC), ekte foto på stedene (Daniel 23.09.2026,
-- «får du lagt til noen bilder?»): heltebildene hentes fra Wikimedia Commons
-- med fri lisens (CC0, public domain, CC BY / CC BY-SA 2.0–4.0; aldri NC/ND),
-- og kreditering er påkrevd. Disse kolonnene holder krediteringen ved siden av
-- guide_pois.hero_image_key (som her er Commons-miniatyrens https-URL):
--   * hero_image_credit       = fotograf/opphav (Artist uten HTML)
--   * hero_image_license      = kort lisensnavn, f.eks. «CC BY-SA 4.0»
--   * hero_image_license_url  = lenke til lisensteksten (tom for public domain)
--   * hero_image_source_url   = filsiden på Commons (lenken i appen går hit)
-- Skrives av backend/scripts/reiseguide-commons-images.ts (workflowen
-- senseaid-seed-demo.yml, etter seed); alt-teksten ligger fortsatt per språk i
-- guide_poi_translations.hero_image_alt.
-- Additiv og nullbar; bygger på 0640_reiseguide_poc.sql og leses av
-- backend/server/reiseguide-routes.ts (heroImageCredit i POI-svaret).

ALTER TABLE guide_pois ADD COLUMN IF NOT EXISTS hero_image_credit TEXT;
ALTER TABLE guide_pois ADD COLUMN IF NOT EXISTS hero_image_license TEXT;
ALTER TABLE guide_pois ADD COLUMN IF NOT EXISTS hero_image_license_url TEXT;
ALTER TABLE guide_pois ADD COLUMN IF NOT EXISTS hero_image_source_url TEXT;

COMMENT ON COLUMN guide_pois.hero_image_credit IS
  'Lydguide-POC: opphav til heltebildet (fotograf), vist som «Foto: … · lisens» på detaljsiden. Null = ingen kreditering (appen viser da ingen linje).';
COMMENT ON COLUMN guide_pois.hero_image_license IS
  'Kort lisensnavn fra Commons (LicenseShortName), kun CC0, public domain eller CC BY / CC BY-SA 2.0–4.0.';
COMMENT ON COLUMN guide_pois.hero_image_license_url IS
  'Lenke til lisensteksten (LicenseUrl); null for public domain uten lenke.';
COMMENT ON COLUMN guide_pois.hero_image_source_url IS
  'Filsiden på Wikimedia Commons som bildet er hentet fra.';
