-- 121_poster_composer.sql
-- Fundament for plakat-/social-format-composer (Holy Crust-pilot 2026-05-05)
--
-- 9-lags arkitektur: produktbilder, logo, palett, fonter, teksturer,
-- kampanje-konsept, produktnavn+pris, CTA, footer. Templates er statiske i
-- kode (registry-mønster); per-bruker/per-brand-state lever i poster_drafts.

BEGIN;

-- 1) Utvid business_profiles med palett + fonter + sosiale handler
ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS brand_colors JSONB,
  ADD COLUMN IF NOT EXISTS brand_fonts JSONB,
  ADD COLUMN IF NOT EXISTS social_handles JSONB,
  ADD COLUMN IF NOT EXISTS tagline TEXT,
  ADD COLUMN IF NOT EXISTS voice_description TEXT;

COMMENT ON COLUMN business_profiles.brand_colors IS
  'Strukturert palett: { "primary": "#C8102E", "secondary": "#1B2D5C", "accent": "#F4EBD8", "background": "#0E0E0E", "text": "#FFFFFF" }';

COMMENT ON COLUMN business_profiles.brand_fonts IS
  'Font-tilordning: { "display": "Bebas Neue", "body": "Inter", "script": "Caveat" }. Verdier matcher brand_fonts.font_family.';

COMMENT ON COLUMN business_profiles.social_handles IS
  'Sosial-handler: { "instagram": "@holycrust.no", "facebook": "holycrust", "tiktok": "@holycrust" }';

COMMENT ON COLUMN business_profiles.voice_description IS
  'Brand-stemme i fri tekst — feedes inn i Claude for å generere kampanje-konsepter (lag 6).';

-- 2) Felles font-bibliotek (lag 4). Brands velger fra dette via business_profiles.brand_fonts.
CREATE TABLE IF NOT EXISTS brand_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  font_family VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,           -- 'display' | 'body' | 'script' | 'mono'
  source VARCHAR(40) NOT NULL,             -- 'google' | 'r2' | 'system'
  asset_url TEXT,                          -- R2-URL eller Google Fonts CSS-URL
  weights INTEGER[] NOT NULL DEFAULT '{400,700}',
  supports_norwegian BOOLEAN NOT NULL DEFAULT TRUE,
  preview_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_fonts_category ON brand_fonts(category);

COMMENT ON TABLE brand_fonts IS 'Felles font-bibliotek for plakat-composer. Brands plukker fra dette.';

-- 3) Tekstur-bibliotek (lag 5). Felles for alle brands; merket med tags.
CREATE TABLE IF NOT EXISTS brand_textures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,           -- 'paper' | 'brush' | 'splatter' | 'grain' | 'tape' | 'starburst'
  asset_url TEXT NOT NULL,                 -- R2-URL til PNG (med alpha)
  preview_url TEXT,
  blend_mode VARCHAR(40) NOT NULL DEFAULT 'multiply',  -- 'multiply' | 'overlay' | 'screen' | 'soft-light'
  default_opacity NUMERIC(4,3) NOT NULL DEFAULT 0.500,
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_textures_category ON brand_textures(category);
CREATE INDEX IF NOT EXISTS idx_brand_textures_tags ON brand_textures USING GIN(tags);

COMMENT ON TABLE brand_textures IS
  'Felles tekstur-bibliotek (papir, børstestrøk, splatter, korn). Lastes inn over hovedlayout som overlay.';

-- 4) CTA-ikon-bibliotek (lag 8). SVG-strenger inline for rask render.
CREATE TABLE IF NOT EXISTS poster_cta_icons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,        -- 'delivery', 'pickup', 'phone', 'web', 'instagram', 'facebook', 'tiktok'
  display_name VARCHAR(120) NOT NULL,
  svg_path TEXT NOT NULL,                  -- inline SVG path-data (24×24 viewbox)
  category VARCHAR(40) NOT NULL,           -- 'action' | 'social' | 'contact'
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poster_cta_icons_category ON poster_cta_icons(category);

COMMENT ON TABLE poster_cta_icons IS
  'Inline SVG-ikoner for CTA-rad og footer (delivery, pickup, phone, IG, FB, TT).';

-- 5) Poster-drafts: per-bruker, per-brand. Innholder hele 9-lags-state som JSONB.
--    Format-feltet styrer aspect-ratio (1:1, 4:5, 9:16, 1.91:1, 2:3, etc.).
CREATE TABLE IF NOT EXISTS poster_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  -- Nullable: composer kan brukes uten en knyttet brand-profil i v1
  -- (Holy Crust-pilot bruker hardkodet brand-data inline). Fase 4 kobler
  -- på brand-picker som krever profil-id.
  -- NB: business_profiles.id er VARCHAR (lagrer UUID-strenger via gen_random_uuid()),
  -- ikke pg-native UUID. FK-typen må matche.
  brand_id VARCHAR REFERENCES business_profiles(id) ON DELETE SET NULL,
  template_id VARCHAR(60) NOT NULL,        -- statisk i kode-registry: 'monday-special' | 'weekly-special' | ...
  name VARCHAR(200) NOT NULL,
  format VARCHAR(20) NOT NULL,             -- '1x1' | '4x5' | '9x16' | '1.91x1' | '2x3' | 'a4'
  content JSONB NOT NULL,                  -- alle 9 layers + customLayers som strukturert JSON
  rendered_url TEXT,                       -- siste render som lever i R2
  rendered_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'archived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_poster_drafts_user ON poster_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_poster_drafts_brand ON poster_drafts(brand_id);
CREATE INDEX IF NOT EXISTS idx_poster_drafts_template ON poster_drafts(template_id);
CREATE INDEX IF NOT EXISTS idx_poster_drafts_updated ON poster_drafts(updated_at DESC);

COMMENT ON TABLE poster_drafts IS
  'Per-bruker plakat-utkast. content-feltet er sannhets-kilde for de 9 layerene; templates er kode-registry.';

COMMIT;

-- Seed: minimum CTA-ikoner som monday-special-template trenger
INSERT INTO poster_cta_icons (slug, display_name, svg_path, category) VALUES
  ('pickup',    'Hent i restaurant', 'M3 12h2l3-9h8l3 9h2v8H3v-8z M7 12h10', 'action'),
  ('delivery',  'Rask levering',     'M3 17V7h11v3h4l3 3v4h-3 M6 17a2 2 0 1 1 4 0 2 2 0 0 1-4 0 m10 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0', 'action'),
  ('web',       'Nettside',          'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 m-7 10h14 M12 2a13 13 0 0 1 0 20 M12 2a13 13 0 0 0 0 20', 'action'),
  ('phone',     'Telefon',           'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2z', 'contact'),
  ('instagram', 'Instagram',         'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.81.25 2.23.41.56.22.96.48 1.38.9s.68.82.9 1.38c.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.81-.41 2.23-.22.56-.48.96-.9 1.38s-.82.68-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.81-.25-2.23-.41-.56-.22-.96-.48-1.38-.9s-.68-.82-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.81.41-2.23.22-.56.48-.96.9-1.38s.82-.68 1.38-.9c.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07', 'social'),
  ('facebook',  'Facebook',          'M22 12a10 10 0 1 0-11.56 9.88V14.9H7.9V12h2.54V9.8c0-2.5 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.9h-2.34v6.98A10 10 0 0 0 22 12z', 'social'),
  ('tiktok',    'TikTok',            'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.8a8.16 8.16 0 0 0 4.77 1.52V6.87a4.85 4.85 0 0 1-1.84-.18z', 'social')
ON CONFLICT (slug) DO NOTHING;

-- Seed: en håndfull Google Fonts som dekker poster-typografi
INSERT INTO brand_fonts (font_family, display_name, category, source, asset_url, weights) VALUES
  ('Bebas Neue',     'Bebas Neue',     'display', 'google', 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', '{400}'),
  ('Anton',          'Anton',          'display', 'google', 'https://fonts.googleapis.com/css2?family=Anton&display=swap', '{400}'),
  ('Oswald',         'Oswald',         'display', 'google', 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap', '{400,700}'),
  ('Bowlby One',     'Bowlby One',     'display', 'google', 'https://fonts.googleapis.com/css2?family=Bowlby+One&display=swap', '{400}'),
  ('Inter',          'Inter',          'body',    'google', 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap', '{400,600,700}'),
  ('Manrope',        'Manrope',        'body',    'google', 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;700&display=swap', '{400,700}'),
  ('Caveat',         'Caveat',         'script',  'google', 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap', '{400,700}'),
  ('Permanent Marker','Permanent Marker','script','google', 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap', '{400}')
ON CONFLICT (font_family) DO NOTHING;
