-- Thumbnail-templates — gjenbrukbare design-presets per prosjekt.
--
-- Bjarne kan lagre en thumbnail-design (layout, branding, frie elementer,
-- logo-plassering, plattform, bakgrunns-kilde) som en navngitt template,
-- og deretter velge den når han åpner Thumbnail Creator igjen.
--
-- Templates er prosjekt-scope (matcher brand_assets-mønster). For å
-- dele templates på tvers av prosjekter senere kan vi addere et
-- team_id-felt + "synlighet"-flag.

CREATE TABLE IF NOT EXISTS role_room_thumbnail_templates (
  id text PRIMARY KEY DEFAULT (lower(replace(gen_random_uuid()::text, '-', ''))),
  project_id text NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) <= 120),
  -- Hele design-konfigurasjonen som JSONB. UI eier formatet — backend
  -- validerer kun shape ikke spesifikt innhold.
  design jsonb NOT NULL,
  -- Forhåndsvisningsbilde (data:URL) generert ved lagring.
  preview_data_url text CHECK (length(preview_data_url) <= 500000),
  -- Hvor mange ganger denne template-en har blitt brukt.
  use_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  tags text[] DEFAULT '{}',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thumbnail_templates_project
  ON role_room_thumbnail_templates(project_id, last_used_at DESC NULLS LAST);

COMMENT ON TABLE role_room_thumbnail_templates IS
  'Gjenbrukbare thumbnail-design-presets per prosjekt. Brukes av '
  'Thumbnail Creator for å lagre + pikke fra tidligere design.';
