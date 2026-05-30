-- Talents Registry (B2B2Talent) — talent eier sin egen profil uavhengig av
-- prosjekter. En talent registrerer seg ÉN gang; prosjekter linker til talent
-- via casting_candidates.talent_id (soft FK, ingen big-bang-migrasjon).
--
-- Strategisk vri: dagens casting_candidates er prosjekt-bundet (project_id NOT
-- NULL). Talents-tabellen er deres egen entitet — eier av profilen er en
-- bruker (users.id). Eksisterende casting_candidates fortsetter å fungere som
-- prosjekt-spesifikke "submissions" og kan nå (valgfritt) lenke til en talent
-- via talent_id-FK.
--
-- Sentralt: granular samtykke ligger i talent_consent_registry (migrasjon 210).
-- Denne tabellen er kun talent-profil-data + ownership.

CREATE TABLE IF NOT EXISTS talents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Eier-bruker (skuespilleren selv). NULL for "claimable" profiler opprettet
  -- av casting-team før talent har laget konto.
  owner_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  -- ── Basis-identitet ──
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  city VARCHAR(120),
  country VARCHAR(60) DEFAULT 'NO',
  bio TEXT,

  -- ── Representasjon ──
  agency_name VARCHAR(255),
  agency_contact VARCHAR(255),
  represented BOOLEAN DEFAULT FALSE,

  -- ── Media-portfolio ──
  headshot_url TEXT,
  headshot_alt_urls JSONB DEFAULT '[]',
  showreel_url TEXT,
  showreel_updated_at TIMESTAMPTZ,
  resume_url TEXT,
  resume_updated_at TIMESTAMPTZ,

  -- ── Demografi (selvrapportert; samtykke-styrt synlighet) ──
  age_range VARCHAR(20),       -- f.eks. "25-35"
  playing_age_min INTEGER,
  playing_age_max INTEGER,
  gender VARCHAR(60),
  ethnicity VARCHAR(120),
  height_cm INTEGER,
  hair_color VARCHAR(60),
  eye_color VARCHAR(60),

  -- ── Ferdigheter + språk ──
  -- skills: [{"id":"horseback_riding","label":"Hesteridning"},...]
  skills JSONB DEFAULT '[]',
  -- languages: [{"code":"nb","label":"Norsk","level":"native"}]
  languages JSONB DEFAULT '[]',
  -- dialects: ["Oslo","Bergen","Trøndersk"]
  dialects JSONB DEFAULT '[]',

  -- ── Tilgjengelighet ──
  availability_status VARCHAR(40) DEFAULT 'open',  -- open | limited | unavailable
  availability_notes TEXT,
  willing_to_travel BOOLEAN DEFAULT TRUE,

  -- ── Eksterne lenker (oppdaterbar) ──
  -- external_links: [{"label":"IMDb","url":"https://..."},...]
  external_links JSONB DEFAULT '[]',

  -- ── Profilstatus + verifiseringsmerker ──
  -- profile_status: 'draft' | 'active' | 'pending_review' | 'archived'
  profile_status VARCHAR(30) DEFAULT 'draft',
  -- badges: ['profile_complete','showreel_validated','castingklar','attended_workshop_2026']
  badges JSONB DEFAULT '[]',

  -- ── Audit ──
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talents_owner_user_id_idx ON talents (owner_user_id);
CREATE INDEX IF NOT EXISTS talents_profile_status_idx ON talents (profile_status);
CREATE INDEX IF NOT EXISTS talents_city_idx ON talents (city);

-- Trigger som auto-oppdaterer updated_at.
DROP TRIGGER IF EXISTS update_talents_updated_at ON talents;
CREATE TRIGGER update_talents_updated_at
  BEFORE UPDATE ON talents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Soft-kobling: casting_candidates kan (valgfritt) peke på en talent.
-- Eksisterende rader får talent_id = NULL og fortsetter å fungere.
ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS talent_id UUID REFERENCES talents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS casting_candidates_talent_id_idx ON casting_candidates (talent_id);
