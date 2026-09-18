-- 0628_reiseguide_poc.sql
-- Lydguide-POC («Interaktiv reiseguide med tilgjengelighet»), steg 1:
-- datamodell for områder, severdigheter (POI), manus per språk og variant,
-- lydfiler, teksting og (mock-)kjøp. Leses av backend/server/reiseguide-routes.ts.
--
-- Prinsipper (POC-skisse 17.09.2026 + UI-spesifikasjon 18.09.2026):
--   * Synstolking og teksting er varianter av samme severdighet, ikke egne steder.
--   * Presentasjonstekst (tittel, ingress, praktisk) ligger per språk i
--     guide_poi_translations. Manus ligger per (språk, variant, kapittel) i
--     guide_poi_scripts, fordi synstolking er et eget manus, ikke fortelling
--     med tillegg.
--   * Lyd genereres kun fra en manus-versjon; guide_poi_audio.script_version
--     gjør regenerering reproduserbar (hash av tekst + stemme = cache-nøkkel).
--   * Teksting (VTT/cues) hører til lydfilen, ikke manuset, fordi ordtidene
--     kommer fra Soniox-transkribering av den ferdige lydfilen.
--   * Betaling er mock i POC; guide_purchases beholder provider/external_id
--     så StoreKit 2 kan kobles på senere uten ny modell.
--   * Ingen PostGIS: bounding-box på lat/lng holder for < noen hundre POI-er.
-- Prefiks guide_ fordi skjemaet deles med 600+ andre tabeller.

CREATE TABLE IF NOT EXISTS guide_areas (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE
    CONSTRAINT guide_areas_slug_chk CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  default_lang TEXT NOT NULL DEFAULT 'nb'
    CONSTRAINT guide_areas_default_lang_chk CHECK (default_lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  center_lat DOUBLE PRECISION NOT NULL
    CONSTRAINT guide_areas_center_lat_chk CHECK (center_lat BETWEEN -90 AND 90),
  center_lng DOUBLE PRECISION NOT NULL
    CONSTRAINT guide_areas_center_lng_chk CHECK (center_lng BETWEEN -180 AND 180),
  bbox_south DOUBLE PRECISION NOT NULL,
  bbox_west DOUBLE PRECISION NOT NULL,
  bbox_north DOUBLE PRECISION NOT NULL,
  bbox_east DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_areas_status_chk CHECK (status IN ('draft', 'published', 'archived')),
  price_nok INTEGER
    CONSTRAINT guide_areas_price_nok_chk CHECK (price_nok IS NULL OR price_nok >= 0),
  price_plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_areas_bbox_chk CHECK (
    bbox_south BETWEEN -90 AND 90 AND bbox_north BETWEEN -90 AND 90
    AND bbox_west BETWEEN -180 AND 180 AND bbox_east BETWEEN -180 AND 180
    AND bbox_south < bbox_north AND bbox_west < bbox_east
  )
);
CREATE INDEX IF NOT EXISTS guide_areas_status_idx ON guide_areas (status);

CREATE TABLE IF NOT EXISTS guide_categories (
  id TEXT PRIMARY KEY
    CONSTRAINT guide_categories_id_chk CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guide_pois (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES guide_areas(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE
    CONSTRAINT guide_pois_slug_chk CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id TEXT REFERENCES guide_categories(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL
    CONSTRAINT guide_pois_lat_chk CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL
    CONSTRAINT guide_pois_lng_chk CHECK (lng BETWEEN -180 AND 180),
  trigger_radius_m INTEGER NOT NULL DEFAULT 60
    CONSTRAINT guide_pois_trigger_radius_chk CHECK (trigger_radius_m BETWEEN 10 AND 1000),
  priority INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  hero_image_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_pois_status_chk CHECK (status IN ('draft', 'published', 'archived')),
  source_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guide_pois_area_status_idx
  ON guide_pois (area_id, status, sort_order);
CREATE INDEX IF NOT EXISTS guide_pois_lat_lng_idx
  ON guide_pois (lat, lng);

CREATE TABLE IF NOT EXISTS guide_poi_translations (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  lang TEXT NOT NULL
    CONSTRAINT guide_poi_translations_lang_chk CHECK (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  location_label TEXT,
  hero_image_alt TEXT,
  practical_info JSONB NOT NULL DEFAULT '[]'::jsonb,
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_poi_translations_editorial_chk CHECK (editorial_status IN ('draft', 'approved', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_translations_poi_lang_key UNIQUE (poi_id, lang)
);

CREATE TABLE IF NOT EXISTS guide_poi_scripts (
  id TEXT PRIMARY KEY,
  poi_id TEXT NOT NULL REFERENCES guide_pois(id) ON DELETE CASCADE,
  lang TEXT NOT NULL
    CONSTRAINT guide_poi_scripts_lang_chk CHECK (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  kind TEXT NOT NULL
    CONSTRAINT guide_poi_scripts_kind_chk CHECK (kind IN ('narration', 'audio_description')),
  chapter_no INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guide_poi_scripts_chapter_no_chk CHECK (chapter_no >= 1),
  title TEXT,
  script_text TEXT NOT NULL,
  image_key TEXT,
  image_alt TEXT,
  version INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guide_poi_scripts_version_chk CHECK (version >= 1),
  editorial_status TEXT NOT NULL DEFAULT 'draft'
    CONSTRAINT guide_poi_scripts_editorial_chk CHECK (editorial_status IN ('draft', 'approved', 'auto')),
  estimated_duration_s INTEGER
    CONSTRAINT guide_poi_scripts_estimated_duration_chk CHECK (estimated_duration_s IS NULL OR estimated_duration_s > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_scripts_poi_lang_kind_chapter_key UNIQUE (poi_id, lang, kind, chapter_no)
);
CREATE INDEX IF NOT EXISTS guide_poi_scripts_poi_lang_idx
  ON guide_poi_scripts (poi_id, lang, kind, chapter_no);

CREATE TABLE IF NOT EXISTS guide_poi_audio (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES guide_poi_scripts(id) ON DELETE CASCADE,
  script_version INTEGER NOT NULL
    CONSTRAINT guide_poi_audio_script_version_chk CHECK (script_version >= 1),
  storage_key TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'm4a'
    CONSTRAINT guide_poi_audio_format_chk CHECK (format IN ('m4a', 'mp3')),
  bitrate_kbps INTEGER
    CONSTRAINT guide_poi_audio_bitrate_chk CHECK (bitrate_kbps IS NULL OR bitrate_kbps > 0),
  duration_s NUMERIC(8, 2) NOT NULL
    CONSTRAINT guide_poi_audio_duration_chk CHECK (duration_s > 0),
  tts_provider TEXT NOT NULL DEFAULT 'soniox',
  voice_id TEXT NOT NULL,
  checksum_sha256 CHAR(64)
    CONSTRAINT guide_poi_audio_checksum_chk CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guide_poi_audio_one_active_per_script_idx
  ON guide_poi_audio (script_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS guide_poi_captions (
  id TEXT PRIMARY KEY,
  audio_id TEXT NOT NULL UNIQUE REFERENCES guide_poi_audio(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'vtt'
    CONSTRAINT guide_poi_captions_format_chk CHECK (format IN ('vtt')),
  storage_key TEXT,
  cues JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'soniox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_poi_captions_content_chk CHECK (
    storage_key IS NOT NULL OR jsonb_typeof(cues) = 'array' AND jsonb_array_length(cues) > 0
  )
);

CREATE TABLE IF NOT EXISTS guide_purchases (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  area_id TEXT NOT NULL REFERENCES guide_areas(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mock'
    CONSTRAINT guide_purchases_provider_chk CHECK (provider IN ('mock', 'storekit', 'stripe')),
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guide_purchases_device_area_key UNIQUE (device_id, area_id)
);

COMMENT ON TABLE guide_areas IS
  'Lydguide-POC: demo-område (Kvadraturen, Akershus festning, Operaen). Kjøp og nedlasting skjer per område. price_nok vises i mock-paywall.';
COMMENT ON TABLE guide_categories IS
  'Lydguide-POC: filterkategorier (museum, historisk, natur …). labels = {"nb": "...", "en": "..."}; appen skal ikke hardkode kategoriene.';
COMMENT ON TABLE guide_pois IS
  'Lydguide-POC: severdighet med geodata. trigger_radius_m 30–80 m i by, 150–300 m i åpent landskap; priority avgjør rekkefølge når radiuser overlapper. free_preview = alltid åpen uten kjøp.';
COMMENT ON TABLE guide_poi_translations IS
  'Lydguide-POC: presentasjonstekst per språk (tittel, undertittel, ingress, stedsetikett, bildebeskrivelse for VoiceOver, praktisk info som [{label, value}]). editorial_status auto = maskinoversatt.';
COMMENT ON TABLE guide_poi_scripts IS
  'Lydguide-POC: manus per (språk, variant, kapittel). kind narration = fortelling, audio_description = synstolking (eget manus). Lyd genereres kun fra version som er approved eller auto.';
COMMENT ON TABLE guide_poi_audio IS
  'Lydguide-POC: én aktiv lydfil per manus. storage_key i R2 (eller absolutt URL). voice_id + script_version gjør regenerering reproduserbar.';
COMMENT ON TABLE guide_poi_captions IS
  'Lydguide-POC: tidskodet teksting for én lydfil. cues = [{startS, endS, text}] fra Soniox-ordtider justert mot manuset; storage_key peker på VTT-fil hvis den finnes.';
COMMENT ON TABLE guide_purchases IS
  'Lydguide-POC: kjøpsstatus per enhet og område. provider mock i POC; storekit/stripe reservert for senere.';
