-- 266_audio_review_easeverse_link.sql
--
-- Link-spine: kobler et Audio Showcase review-rom til en SongFlow/EaseVerse-track.
-- easeverse_track_id = intern CreatorHub-track (easeverse_tracks.id).
-- external_track_id  = nøkkelen delt med ekstern EaseVerse-app (/api/v1/collab/*).

ALTER TABLE audio_review_projects ADD COLUMN IF NOT EXISTS easeverse_track_id TEXT;
ALTER TABLE audio_review_projects ADD COLUMN IF NOT EXISTS external_track_id  TEXT;
CREATE INDEX IF NOT EXISTS idx_audio_projects_easeverse_track ON audio_review_projects (easeverse_track_id);
