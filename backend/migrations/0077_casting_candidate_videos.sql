-- 0077_casting_candidate_videos.sql
-- Video review for casting candidates (audition tapes, agent reels).
-- Lagrer R2/S3-URL + metadata + tidskodede kommentarer/rating.

CREATE TABLE IF NOT EXISTS casting_candidate_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id VARCHAR(255) NOT NULL REFERENCES casting_candidates(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title TEXT,
  -- R2/S3-URL (signed på read-time hvis privat bucket)
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(8,3),
  file_size_bytes BIGINT,
  mime_type VARCHAR(80),
  -- 1-5 stjerner; null = ikke vurdert
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  -- Status: 'pending' (URL utstedt, fil ikke bekreftet), 'ready' (uploaded), 'failed'
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'failed')),
  uploaded_by VARCHAR(255),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS casting_candidate_videos_candidate_idx
  ON casting_candidate_videos(candidate_id);
CREATE INDEX IF NOT EXISTS casting_candidate_videos_project_idx
  ON casting_candidate_videos(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS casting_video_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES casting_candidate_videos(id) ON DELETE CASCADE,
  -- Tidsstempel i video — sekunder med 3 desimaler (ms-presisjon)
  timestamp_seconds NUMERIC(8,3) NOT NULL,
  comment TEXT NOT NULL,
  author_user_id VARCHAR(255),
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS casting_video_annotations_video_idx
  ON casting_video_annotations(video_id, timestamp_seconds);
