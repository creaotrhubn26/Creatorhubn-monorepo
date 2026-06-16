-- 284_role_room_agent_recommendations.sql
-- Agent-anbefalinger: AI-innsikt-kort fra The Role Room Agent (rr-agent-in-*).
-- Hvert kort er en handlingsrettet anbefaling (publiser nå, kjør quiz, boost,
-- juster budsjett, …) med en innsikt, et nøkkeltall og en CTA. Talenten/
-- produsenten kan «Utfør» (done) eller avvise (dismissed).
--
-- Soft-refs (TEXT) som resten av role-room/dance-tabellene — ingen hard FK,
-- så rekkefølge i migrate-runneren er uproblematisk. id genereres i service.

CREATE TABLE IF NOT EXISTS role_room_agent_recommendation (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,

  -- Maskin-lesbar type, f.eks. 'quiz', 'publiser_naa', 'boost', 'budsjett'.
  type TEXT NOT NULL DEFAULT 'insight',
  title TEXT NOT NULL,
  insight TEXT,
  stat_value TEXT,
  stat_label TEXT,
  cta_label TEXT,
  icon TEXT,

  -- 'new' | 'done' | 'dismissed'.
  status TEXT NOT NULL DEFAULT 'new',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT role_room_agent_recommendation_status_values
    CHECK (status IN ('new','done','dismissed'))
);

-- Hot-path: åpne anbefalinger per (owner, project), nyeste først.
CREATE INDEX IF NOT EXISTS role_room_agent_recommendation_owner_project_idx
  ON role_room_agent_recommendation (owner_user_id, COALESCE(project_id, ''), status, created_at DESC);
