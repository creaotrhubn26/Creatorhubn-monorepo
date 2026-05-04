-- Phase 5.1 — voice-memo replies on captureReviews.
-- audioKey points at R2 under `reviews/<reviewId>/audio.m4a`.
-- audioDurationSeconds is the iPad's measured AVAudioRecorder
-- duration; server-trusted (we don't probe the bytes).
-- audioMimeType captures format negotiation flexibility (m4a today,
-- webm/opus from web client gallery later).

ALTER TABLE capture_reviews
  ADD COLUMN IF NOT EXISTS audio_key VARCHAR(512),
  ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS audio_mime_type VARCHAR(64);
