-- 0045_role_room_agent_threads.sql
-- Persistent chat threads for The Role Room Agent.
--
-- A thread belongs to (project_id, user_id). Messages are append-only;
-- responses from Claude store the full normalized payload so the UI can
-- re-render transparency banner + tool_use buttons when the thread is
-- resumed days later.

CREATE TABLE IF NOT EXISTS role_room_agent_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_agent_threads_project_user_idx
  ON role_room_agent_threads (project_id, user_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS role_room_agent_threads_user_active_idx
  ON role_room_agent_threads (user_id, last_active_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS role_room_agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES role_room_agent_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  text TEXT NOT NULL DEFAULT '',
  -- Full RoleRoomAgentResponse payload (text + toolUses + transparency +
  -- usage + model + consentId + latencyMs). Null for user messages.
  response JSONB,
  -- Pointer to the audit row created for this message so GDPR deletion
  -- cascades cleanly.
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_agent_messages_thread_idx
  ON role_room_agent_messages (thread_id, created_at);

COMMENT ON TABLE role_room_agent_threads IS
  'Persistent conversation threads between a user and the Role Room Agent. Scope: per (project, user). Archived threads are retained but hidden from the default list.';

COMMENT ON TABLE role_room_agent_messages IS
  'Append-only message log inside a thread. Assistant messages store the full agent response JSON so transparency UI can be re-rendered on resume.';
