-- 0098_wedding_timeline_events.sql
-- Photograph-kuratert timeline-events for wedding-timeline. Stine planlegger
-- "kl 14:00 Vielse-shots (40 min, ~80 bilder, foto-noter: 'Stå bakerst i
-- kirken under prosesjonen')". Maria & Anders kan kommentere på hver event
-- for å gi innspill ("Vi vil at far skal være med på prosesjonen-bildet").

-- 1. Foto-events kuratert av fotografen
CREATE TABLE IF NOT EXISTS wedding_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,           -- "Vielse-shots", "Brudepar-portretter"
  description TEXT,                       -- generell beskrivelse for brudeparet
  photo_notes TEXT,                       -- private foto-noter for Stine (komposisjon, lyssetting)
  category VARCHAR(32) DEFAULT 'photo_session', -- preparation | ceremony | photo_session | reception | transport
  scheduled_time TIMESTAMPTZ,             -- når event'et starter
  duration_minutes INTEGER DEFAULT 30,    -- varighet
  buffer_before_minutes INTEGER DEFAULT 0, -- buffer-tid før (transport, oppsett)
  buffer_after_minutes INTEGER DEFAULT 0,  -- buffer-tid etter
  estimated_shots INTEGER,                -- forventet antall bilder fra event'et
  location_id UUID,                       -- referanse til wedding_locations (valgfri)
  status VARCHAR(32) DEFAULT 'planned',    -- planned | in_progress | completed | skipped
  sort_order INTEGER DEFAULT 0,
  client_visible BOOLEAN DEFAULT TRUE,    -- om event'et vises i klient-form
  client_can_comment BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wedding_timeline_events_wedding_idx
  ON wedding_timeline_events (wedding_id, scheduled_time);
CREATE INDEX IF NOT EXISTS wedding_timeline_events_sort_idx
  ON wedding_timeline_events (wedding_id, sort_order);

-- 2. Toveis-kommentarer per event
CREATE TABLE IF NOT EXISTS wedding_event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  wedding_id VARCHAR(64) NOT NULL,         -- denormalized for raskere wedding-side queries
  author_type VARCHAR(16) NOT NULL,        -- 'photographer' | 'client'
  author_name VARCHAR(255),                -- "Stine Larsen" eller "Maria"
  author_email VARCHAR(255),
  content TEXT NOT NULL,
  parent_comment_id UUID,                  -- for nested replies (valgfri)
  is_resolved BOOLEAN DEFAULT FALSE,       -- fotograf kan markere som "håndtert"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wedding_event_comments_event_idx
  ON wedding_event_comments (event_id, created_at);
CREATE INDEX IF NOT EXISTS wedding_event_comments_wedding_idx
  ON wedding_event_comments (wedding_id, created_at DESC);

COMMENT ON TABLE wedding_timeline_events IS
  'Fotograf-kurerte foto-events med tid, varighet, foto-noter. Synlig for brudepar via client_visible-flagg.';
COMMENT ON COLUMN wedding_timeline_events.photo_notes IS
  'Private noter for fotografen (komposisjon, lys, vinkler). Vises IKKE for brudepar.';
COMMENT ON COLUMN wedding_timeline_events.description IS
  'Klient-synlig beskrivelse. F.eks. "Vi tar ca 80 bilder under vielsen, inkludert prosesjon og ringutveksling".';
COMMENT ON TABLE wedding_event_comments IS
  'Toveis kommentarer per timeline-event. author_type=photographer for Stine, client for brudepar.';
