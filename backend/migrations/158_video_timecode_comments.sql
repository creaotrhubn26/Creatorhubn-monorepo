-- Slice 9X.82 — Frame.io-stil video-kommentarer for Bjarne (videograf)
--
-- Klient (brudepar) kan kommentere på spesifikt tidspunkt i video-
-- leveransen: "ved 02:14, kan vi få mer av mor's tale her?". Bjarne
-- får varsel + ser kommentarene markert som prikker på progress-baren.
--
-- chapter_id linker kommentaren til en spesifikk video-chapter slik at
-- Bjarne ser konteksten ("denne er på Festen-klippet, ikke Vielsen").

CREATE TABLE IF NOT EXISTS video_timecode_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id      VARCHAR(64) NOT NULL,
  chapter_id      VARCHAR(64),
  -- Tidspunkt i sekunder fra start av videoen (millisek. presisjon)
  timecode_sec    NUMERIC(10,3) NOT NULL,
  comment         TEXT NOT NULL,
  client_email    VARCHAR(255) NOT NULL,
  client_name     VARCHAR(255),
  -- Status: 'open' (venter behandling), 'resolved' (Bjarne har handlet), 'archived'
  status          VARCHAR(32) NOT NULL DEFAULT 'open',
  -- resolved_at = NULL inntil Bjarne markerer som ferdig
  resolved_at     TIMESTAMPTZ,
  resolved_by     VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_timecode_comments_gallery
  ON video_timecode_comments (gallery_id, chapter_id, timecode_sec);
CREATE INDEX IF NOT EXISTS idx_video_timecode_comments_status
  ON video_timecode_comments (gallery_id, status)
  WHERE status = 'open';
