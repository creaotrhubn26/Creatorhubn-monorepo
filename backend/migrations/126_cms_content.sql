-- CMS-foundation: tre tabeller som driver Visual CMS Admin og lar
-- alle CreatorHub-flater (landing, dashboard, BI, klient-galleri)
-- lese fra én sentralisert content-store.
--
-- cms_fields: feltdefinisjon (key, type, label, validation)
-- cms_content_types: gruppering (page, section, component)
-- cms_content: faktiske verdier per (content_type, key, profession)
-- locale: nb-NO|en-US støttes for fremtidig i18n

CREATE TABLE IF NOT EXISTS cms_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key VARCHAR(128) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(32) NOT NULL DEFAULT 'text',
  description TEXT,
  validation JSONB DEFAULT '{}'::jsonb,
  default_value TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_content_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  field_keys JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key VARCHAR(128) NOT NULL,
  content_type_key VARCHAR(64),
  profession VARCHAR(64),
  locale VARCHAR(16) DEFAULT 'nb-NO',
  payload JSONB DEFAULT '{}'::jsonb,
  is_published BOOLEAN DEFAULT true,
  created_by VARCHAR(64),
  updated_by VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (content_key, profession, locale)
);

CREATE INDEX IF NOT EXISTS cms_content_key_idx ON cms_content (content_key);
CREATE INDEX IF NOT EXISTS cms_content_type_idx ON cms_content (content_type_key);
CREATE INDEX IF NOT EXISTS cms_content_profession_idx ON cms_content (profession);
