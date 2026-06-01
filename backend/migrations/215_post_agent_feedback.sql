-- post_agent_feedback — Irlin/Daniel sender bug, forslag, eller spørsmål
-- direkte fra Post Agent's "📨 Send feedback"-dialog. Lagres her så vi
-- har søkbar historikk + sender også e-post til daniel@creatorhubn.com.

CREATE TABLE IF NOT EXISTS post_agent_feedback (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  category        VARCHAR(40) NOT NULL,
  message         TEXT NOT NULL,
  bridge_status   JSONB,        -- snapshot av Photoshop bridge-tilstand
  platform        VARCHAR(120), -- macOS-versjon / arch
  user_agent      TEXT,
  client_version  VARCHAR(40),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS post_agent_feedback_user_id_idx
  ON post_agent_feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_agent_feedback_category_idx
  ON post_agent_feedback (category, created_at DESC);
