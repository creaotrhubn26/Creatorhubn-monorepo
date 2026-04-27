-- 0068_dance_studio_ops.sql
-- Studio-driftens 4 hovedressurser: classes, instructors, rooms, movement_vocab.
-- Holder hver entitet i sin egen tabell men i samme migration siden de
-- ofte refererer hverandre (class.instructor_id, class.room_id).

-- ─── dance_class — semester/drop-in/workshop ───────────────────
CREATE TABLE IF NOT EXISTS dance_class (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  title TEXT NOT NULL,
  -- 'semester' | 'drop_in' | 'workshop' | 'private'
  kind TEXT NOT NULL DEFAULT 'semester',
  -- Free-text mønster for nå: "Mandag 18:00–19:30, Onsdag 18:00–19:30"
  schedule_pattern TEXT,
  -- Soft-FK; bevares ved sletting av instruktør (NULL).
  instructor_id TEXT,
  room_id TEXT,
  -- Spennvidde for semester. Drop-in/workshops har bare start.
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_students INTEGER,
  price_kr INTEGER,
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_class_kind_values
    CHECK (kind IN ('semester','drop_in','workshop','private'))
);

CREATE INDEX IF NOT EXISTS dance_class_owner_project_idx
  ON dance_class (owner_user_id, project_id, starts_at DESC NULLS LAST);

-- Påmeldinger til en class.
CREATE TABLE IF NOT EXISTS dance_class_enrollment (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  class_id TEXT NOT NULL REFERENCES dance_class(id) ON DELETE CASCADE,
  -- soft-ref til dancer_profile_extras.dancer_id
  student_dancer_id TEXT NOT NULL,
  -- 'unpaid' | 'invoiced' | 'paid' | 'comp'  (comp = friplass)
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,

  CONSTRAINT dance_class_enrollment_payment_values
    CHECK (payment_status IN ('unpaid','invoiced','paid','comp'))
);

CREATE INDEX IF NOT EXISTS dance_class_enrollment_class_idx
  ON dance_class_enrollment (class_id, payment_status);

-- ─── dance_instructor — frilans ENK + studio-ansatt ─────────────
CREATE TABLE IF NOT EXISTS dance_instructor (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  -- 'enk_freelance' | 'employee' | 'guest'
  contract_kind TEXT NOT NULL DEFAULT 'enk_freelance',
  hourly_rate_kr INTEGER,
  -- styles (JSON-array av tags)
  styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Logg: [{ ymd: '2026-04-30', hours: 6, classId?, note? }]
  hours_logged JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_instructor_contract_values
    CHECK (contract_kind IN ('enk_freelance','employee','guest'))
);

CREATE INDEX IF NOT EXISTS dance_instructor_owner_project_idx
  ON dance_instructor (owner_user_id, project_id);

-- ─── dance_room — sal/studio ───────────────────────────────────
CREATE TABLE IF NOT EXISTS dance_room (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  name TEXT NOT NULL,
  -- 'mirror_studio' | 'sprung_floor' | 'ballet' | 'rehearsal' | 'theater'
  room_kind TEXT NOT NULL DEFAULT 'mirror_studio',
  capacity INTEGER,
  has_sprung_floor BOOLEAN NOT NULL DEFAULT FALSE,
  has_mirror BOOLEAN NOT NULL DEFAULT TRUE,
  has_sound_system BOOLEAN NOT NULL DEFAULT FALSE,
  address TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dance_room_owner_project_idx
  ON dance_room (owner_user_id, project_id);

-- Bookings — hvem bruker rommet når.
CREATE TABLE IF NOT EXISTS dance_room_booking (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES dance_room(id) ON DELETE CASCADE,
  -- soft-FK til dance_choreography eller dance_class
  choreography_id TEXT,
  class_id TEXT,
  -- Fri-tekst dersom booking ikke peker på et stykke/klasse.
  purpose TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_room_booking_time_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS dance_room_booking_room_time_idx
  ON dance_room_booking (room_id, starts_at);

CREATE INDEX IF NOT EXISTS dance_room_booking_owner_time_idx
  ON dance_room_booking (owner_user_id, starts_at DESC);

-- ─── dance_movement_vocab — bevegelsesterminologi ──────────────
CREATE TABLE IF NOT EXISTS dance_movement_vocab (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  term TEXT NOT NULL,
  -- 'turn' | 'leap' | 'lift' | 'extension' | 'partnering' | 'improv' | 'other'
  category TEXT NOT NULL DEFAULT 'other',
  definition TEXT NOT NULL,
  -- Vimeo/YouTube/direkte URL eller R2 storage key for instruksjon.
  reference_video_url TEXT,
  -- Aliaser (forskjellige skoler bruker forskjellig terminologi).
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Skill-level for å lære: 'beginner' | 'intermediate' | 'advanced' | 'pro'
  difficulty TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dance_movement_vocab_difficulty_values
    CHECK (difficulty IS NULL OR difficulty IN ('beginner','intermediate','advanced','pro'))
);

CREATE INDEX IF NOT EXISTS dance_movement_vocab_owner_project_idx
  ON dance_movement_vocab (owner_user_id, project_id);

CREATE INDEX IF NOT EXISTS dance_movement_vocab_term_idx
  ON dance_movement_vocab (owner_user_id, term);
