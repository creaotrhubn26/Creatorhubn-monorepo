-- CMS seed: default-content for hovedflater så frontend har noe å
-- lese fra dag 1. Idempotent via ON CONFLICT — kan re-kjøres uten
-- å overskrive admin-redigeringer.

-- Field-definisjoner (hva slags input-felt CMS Admin viser per nøkkel)
INSERT INTO cms_fields (field_key, label, field_type, description) VALUES
  ('hero.heading', 'Hero-overskrift', 'text', 'Hovedoverskrift på dashboard hero-bånd'),
  ('hero.subheading', 'Hero-undertekst', 'longtext', 'Forklarende tekst under hero-overskrift'),
  ('hero.cta_label', 'Hero CTA-knapp', 'text', 'Tekst på primær-knapp i hero'),
  ('bi.section_title', 'BI-overskrift', 'text', 'Tittel i Business Intelligence-fanen'),
  ('bi.section_intro', 'BI-introtekst', 'longtext', 'Beskrivelse av BI-data-kilden'),
  ('gallery.empty_state', 'Galleri tom-tilstand', 'text', 'Tekst når klient ikke har galleries'),
  ('design.tokens', 'Design-tokens', 'json', 'Sentrale farger og typografi-overrides')
ON CONFLICT (field_key) DO NOTHING;

-- Innholdstyper (gruppering)
INSERT INTO cms_content_types (type_key, label, description, field_keys) VALUES
  ('dashboard_hero', 'Dashboard hero',
   'Hero-bånd øverst i UniversalDashboard',
   '["hero.heading", "hero.subheading", "hero.cta_label"]'::jsonb),
  ('bi_section', 'BI-fanen',
   'Business Intelligence-fanen header + intro',
   '["bi.section_title", "bi.section_intro"]'::jsonb),
  ('design_system', 'Design-tokens',
   'Sentrale farger og typografi-tokens som overrider landingTokens',
   '["design.tokens"]'::jsonb)
ON CONFLICT (type_key) DO NOTHING;

-- Default-content (generisk profession=NULL, locale=nb-NO)
INSERT INTO cms_content (content_key, content_type_key, profession, locale, payload) VALUES
  ('dashboard.hero.heading', 'dashboard_hero', NULL, 'nb-NO',
   '{"value": "Velkommen til CreatorHub"}'::jsonb),
  ('dashboard.hero.subheading', 'dashboard_hero', NULL, 'nb-NO',
   '{"value": "Alle dine prosjekter, kunder og leveranser i ett verktøy."}'::jsonb),
  ('dashboard.hero.cta_label', 'dashboard_hero', NULL, 'nb-NO',
   '{"value": "Nytt prosjekt"}'::jsonb),
  ('bi.section_title', 'bi_section', NULL, 'nb-NO',
   '{"value": "Business Intelligence"}'::jsonb),
  ('bi.section_intro', 'bi_section', NULL, 'nb-NO',
   '{"value": "Aktivitet på tvers av Galleri, Prosjekt, Betaling og Klient-events."}'::jsonb),
  ('gallery.empty_state', 'dashboard_hero', NULL, 'nb-NO',
   '{"value": "Ingen galleries ennå — opprett ditt første for å levere bilder til en klient."}'::jsonb)
ON CONFLICT (content_key, profession, locale) DO NOTHING;

-- Profesjon-spesifikk override-eksempler. Photographer holder default;
-- videograf og musikkprodusent får tilpasset copy.
INSERT INTO cms_content (content_key, content_type_key, profession, locale, payload) VALUES
  ('gallery.empty_state', 'dashboard_hero', 'videographer', 'nb-NO',
   '{"value": "Ingen video-galleri ennå — opprett ditt første for å levere klipp til en klient."}'::jsonb),
  ('gallery.empty_state', 'dashboard_hero', 'music_producer', 'nb-NO',
   '{"value": "Ingen lyd-galleri ennå — opprett ditt første for å levere spor til en klient."}'::jsonb)
ON CONFLICT (content_key, profession, locale) DO NOTHING;

-- Design-tokens som JSON-payload — overrider landingTokens på client-side.
-- Tom payload her; admin kan fylle inn i Visual CMS Admin når de vil
-- overstyre default-paletten.
INSERT INTO cms_content (content_key, content_type_key, profession, locale, payload) VALUES
  ('design.tokens', 'design_system', NULL, 'nb-NO', '{}'::jsonb)
ON CONFLICT (content_key, profession, locale) DO NOTHING;
