-- Demo-byråer trenger logo + about-tekst for å vises i /discoverable-agencies.
-- Filteret krever logo_url IS NOT NULL.
--
-- Bruker dicebear (CC0, ingen API-nøkkel) for SVG-initials-logoer per byrå
-- med brand-fargekoder. Idempotent: setter bare hvis null.

UPDATE agency_orgs SET
  logo_url = COALESCE(logo_url, 'https://api.dicebear.com/9.x/initials/svg?seed=Northern+Lights+Casting&backgroundColor=1e3a8a&textColor=ffffff'),
  about = COALESCE(about, 'Frilans-caster spesialisert på nordlig film- og TV-produksjon. Stort talent-nettverk i Tromsø, Bodø og Lofoten.'),
  verified = TRUE,
  verified_at = COALESCE(verified_at, now())
WHERE id = 'a1111111-1111-1111-1111-1111111111a1';

UPDATE agency_orgs SET
  logo_url = COALESCE(logo_url, 'https://api.dicebear.com/9.x/initials/svg?seed=Stella+Casting&backgroundColor=7c3aed&textColor=ffffff'),
  about = COALESCE(about, 'Norges største casting-byrå. Fra TV-drama til reklame — vi finner riktige folk for hvert prosjekt.'),
  verified = TRUE,
  verified_at = COALESCE(verified_at, now())
WHERE id = 'a2222222-2222-2222-2222-2222222222a2';

UPDATE agency_orgs SET
  logo_url = COALESCE(logo_url, 'https://api.dicebear.com/9.x/initials/svg?seed=Nordic+Skuespillersenter&backgroundColor=059669&textColor=ffffff'),
  about = COALESCE(about, 'Skuespillerutdanning og talent-utvikling i Oslo. Vi representerer skuespillere på alle nivåer.'),
  verified = TRUE,
  verified_at = COALESCE(verified_at, now())
WHERE id = 'a3333333-3333-3333-3333-3333333333a3';

UPDATE agency_orgs SET
  logo_url = COALESCE(logo_url, 'https://api.dicebear.com/9.x/initials/svg?seed=Bergen+Film+Academy&backgroundColor=dc2626&textColor=ffffff'),
  about = COALESCE(about, 'Vest-Norges fremste filmutdanning. Workshops, mentoring og kobling mellom utdanning og produksjon.'),
  verified = TRUE,
  verified_at = COALESCE(verified_at, now())
WHERE id = 'a4444444-4444-4444-4444-4444444444a4';

UPDATE agency_orgs SET
  logo_url = COALESCE(logo_url, 'https://api.dicebear.com/9.x/initials/svg?seed=Dramatikkens+Hus&backgroundColor=ea580c&textColor=ffffff'),
  about = COALESCE(about, 'Møteplass for norsk samtidsdramatikk. Produksjonsselskap med fokus på nye stemmer og originalt manus.'),
  verified = TRUE,
  verified_at = COALESCE(verified_at, now())
WHERE id = 'a5555555-5555-5555-5555-5555555555a5';
