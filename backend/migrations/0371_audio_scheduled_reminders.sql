-- 0371: Planlagte band-påminnelser fra produsenten.
--
-- Produsenten kan velge NÅR en påminnelse skal sendes («husk å øv», dagen
-- før økta kl. 18 osv.) i tillegg til send-nå og de automatiske 24t-/1t-
-- øktpåminnelsene. Forfalte rader leveres av samme cron som økt-påminnelsene
-- (POST /api/audio-showcase/sessions/run-reminders, hver halvtime) —
-- granularitet ≈ 30 min. project_id = audio_review_projects.id (lydrommet).

CREATE TABLE IF NOT EXISTS audio_scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  owner_user_id VARCHAR NOT NULL,
  message TEXT NOT NULL,
  target VARCHAR(60) DEFAULT 'all',
  only_not_warmed BOOLEAN DEFAULT false,
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  emails_sent INT DEFAULT 0,
  sms_sent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_sched_rem_due
  ON audio_scheduled_reminders (send_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audio_sched_rem_project
  ON audio_scheduled_reminders (project_id, created_at DESC);
